import unittest

from ai.companion_agent import run_react_loop
from ai.companion_guardrails import (
    OBSERVATIONAL_REPLACEMENT,
    SAFE_FALLBACK_LINE,
    apply_guardrails,
    check_fabricated_memory,
    check_grounded_insight,
    check_therapist_drift,
    enforce_response_format,
)
from ai.companion_security import CompanionSecurityError
from ai.companion_tools import (
    escalation_trigger,
    journal_search,
    pattern_check,
    task_history,
)
from tests.test_companion_tools import FakeSupabase, days_ago, reflection_row


USER_ID = "11111111-1111-1111-1111-111111111111"


class Guardrail1FabricatedMemoryTests(unittest.TestCase):
    """Spec test: send a message without calling any tools, verify the
    companion cannot reference past data."""

    def test_memory_claims_removed_when_no_tools_called(self):
        reply = (
            "You wrote about this last time and you've been circling it for weeks. "
            "Today it showed up again in what you shared."
        )
        cleaned, fired = check_fabricated_memory(reply, tools_called=[], tool_results={})

        self.assertTrue(fired)
        self.assertNotIn("You wrote", cleaned)
        self.assertNotIn("you've been", cleaned.lower())
        self.assertIn("Today it showed up again", cleaned)

    def test_memory_claims_kept_when_journal_search_returned_results(self):
        reply = "You wrote about feeling stuck on 29 June, and it surfaced again today."
        cleaned, fired = check_fabricated_memory(
            reply,
            tools_called=["journal_search"],
            tool_results={"journal_search": [{"date": "2026-06-29", "emotion_signal": "stuck"}]},
        )

        self.assertFalse(fired)
        self.assertEqual(cleaned, reply)

    def test_empty_journal_results_do_not_license_memory_claims(self):
        reply = "In your journal you mentioned this exact feeling."
        cleaned, fired = check_fabricated_memory(
            reply, tools_called=["journal_search"], tool_results={"journal_search": []}
        )

        self.assertTrue(fired)
        self.assertEqual(cleaned, "")


class Guardrail2TherapistDriftTests(unittest.TestCase):
    """Spec test: prompt the companion to diagnose, verify it rewrites."""

    def test_diagnostic_sentence_rewritten_to_observational(self):
        reply = "You have anxiety and these are symptoms of a deeper disorder. A short walk can help tonight."
        cleaned, fired = check_therapist_drift(reply)

        self.assertTrue(fired)
        self.assertIn(OBSERVATIONAL_REPLACEMENT, cleaned)
        self.assertNotIn("anxiety", cleaned)
        self.assertNotIn("disorder", cleaned)
        self.assertIn("short walk", cleaned)

    def test_blocked_terms_all_fire(self):
        for phrase in [
            "You suffer from depression.",
            "These are symptoms of burnout.",
            "This is clearly a disorder.",
            "My diagnosis is clear.",
            "You need therapy for this.",
            "This is clinical avoidance.",
            "That reaction is pathological.",
        ]:
            with self.subTest(phrase=phrase):
                _, fired = check_therapist_drift(phrase)
                self.assertTrue(fired, f"not caught: {phrase}")

    def test_clean_observational_language_untouched(self):
        reply = "That weight you named sounds real. One slow breath before bed tonight."
        cleaned, fired = check_therapist_drift(reply)

        self.assertFalse(fired)
        self.assertEqual(cleaned, reply)


class Guardrail3DistressRoutesFirstTests(unittest.TestCase):
    """Spec test: send each keyword, verify escalation fires every time."""

    def test_every_distress_keyword_escalates_before_any_processing(self):
        keywords = [
            "give up", "can't go on", "nothing matters", "want to disappear",
            "hopeless", "no point", "end it", "can't do this anymore",
            "want to die", "don't want to be here", "what's the point of anything",
        ]
        for keyword in keywords:
            with self.subTest(keyword=keyword):
                supabase = FakeSupabase({"reflections": []})
                turn = run_react_loop(
                    user_id=USER_ID,
                    message=f"honestly I just {keyword} at this point",
                    conversation_history=[],
                    supabase=supabase,
                )
                self.assertIsNotNone(turn.escalation, f"no escalation for: {keyword}")
                self.assertEqual(turn.tools_called, [])
                self.assertEqual(supabase.inserts[0][0], "escalation_log")


class Guardrail4GroundedInsightTests(unittest.TestCase):
    """Spec test: trigger INSIGHT mode without pattern_check, verify it
    downgrades to REFLECT."""

    def test_insight_without_pattern_check_downgrades(self):
        mode, fired = check_grounded_insight("INSIGHT", tool_results={})

        self.assertTrue(fired)
        self.assertEqual(mode, "REFLECT")

    def test_insight_with_frequency_below_two_downgrades(self):
        mode, fired = check_grounded_insight(
            "INSIGHT", tool_results={"pattern_check": {"frequency": 1}}
        )

        self.assertTrue(fired)
        self.assertEqual(mode, "REFLECT")

    def test_insight_with_confirmed_pattern_stays(self):
        mode, fired = check_grounded_insight(
            "INSIGHT", tool_results={"pattern_check": {"frequency": 3}}
        )

        self.assertFalse(fired)
        self.assertEqual(mode, "INSIGHT")

    def test_non_insight_modes_pass_through(self):
        for mode in ["REFLECT", "QUESTION", "DIRECT"]:
            with self.subTest(mode=mode):
                result, fired = check_grounded_insight(mode, tool_results={})
                self.assertEqual(result, mode)
                self.assertFalse(fired)


class Guardrail5UserIsolationTests(unittest.TestCase):
    """Spec test: call each tool without user_id, verify exception raised."""

    def test_every_tool_raises_without_user_id(self):
        supabase = FakeSupabase({"reflections": []})
        calls = [
            lambda: journal_search("stuck", "", supabase=supabase),
            lambda: task_history(None, supabase=supabase),
            lambda: pattern_check("  ", "stuck", supabase=supabase),
            lambda: escalation_trigger("", "crisis", "text", supabase=supabase),
        ]
        for call in calls:
            with self.subTest(call=call):
                with self.assertRaises(CompanionSecurityError):
                    call()


class ResponseFormatTests(unittest.TestCase):
    def test_five_paragraphs_trimmed_to_three(self):
        reply = "\n\n".join(f"Paragraph {i} here." for i in range(1, 6))
        text, notes = enforce_response_format(reply, questions_allowed=True)

        self.assertEqual(len(text.split("\n\n")), 3)
        self.assertIn("paragraphs_trimmed", notes)

    def test_long_paragraph_trimmed_to_two_sentences(self):
        reply = "One thing. Two things. Three things. Four things."
        text, notes = enforce_response_format(reply, questions_allowed=True)

        self.assertEqual(text, "One thing. Two things.")
        self.assertIn("paragraph_trimmed", notes)

    def test_bullets_flattened(self):
        reply = "- first point.\n- second point."
        text, notes = enforce_response_format(reply, questions_allowed=True)

        self.assertNotIn("-", text.split(".")[0])
        self.assertIn("bullets_flattened", notes)

    def test_banned_opener_drops_the_whole_sentence(self):
        # Option B: a prefix strip left "Today was heavy for you." here
        # (fine), but the same mechanism left bare fragments on other
        # openers (see below) — whole-sentence drop is now the one rule
        # for every pattern in _BANNED_OPENERS, old and new.
        text, notes = enforce_response_format(
            "It sounds like today was heavy for you. Let's start with one small thing.",
            questions_allowed=True,
        )

        self.assertEqual(text, "Let's start with one small thing.")
        self.assertIn("banned_opener_sentence_dropped", notes)

    def test_analysis_openers_drop_the_whole_sentence(self):
        # Category-level match ("you're " + one word), not an enumerated
        # phrase list — a live trace caught the model opening with "You're
        # not sure..." which wasn't on any named list. Whole-sentence drop
        # (not prefix-strip) because a prefix strip left bare fragments
        # like "About who you are right now..." when the banned phrase
        # wasn't followed by an already-complete clause.
        cases = [
            "You're feeling overwhelmed by all of it.",
            "You're recognising a pattern here.",
            "You're taking steps in the right direction.",
            "You're curious about why this keeps happening.",
            "You're acknowledging something hard.",
            "You're not sure who you are right now.",
            "You are carrying a lot lately.",
            "You seem to be carrying a lot today.",
        ]
        for opener_sentence in cases:
            with self.subTest(opener_sentence=opener_sentence):
                text, notes = enforce_response_format(
                    f"{opener_sentence} Let's start with one small thing.",
                    questions_allowed=True,
                )
                self.assertEqual(text, "Let's start with one small thing.")
                self.assertIn("banned_opener_sentence_dropped", notes)

    def test_declarative_verb_openers_drop_the_whole_sentence(self):
        # Audit finding #3 (2026-07-17): a live trace with the EXACT message
        # "Can i give you a little name...i want to name you 'reet'." leaked
        # "You want to give me a name that feels personal to you..." past
        # the copula-only patterns above ("you're X" / "you are X") — "want"
        # isn't a copula. This is the reproduction case plus its verb family.
        cases = [
            "You want to give me a name that feels personal to you, and 'reet' is what you've chosen.",
            "You feel like this matters more than you're saying.",
            "You think this is your fault somehow.",
            "You need to hear that this is okay.",
            "You know exactly why this keeps happening.",
            "You wish things were different right now.",
        ]
        for opener_sentence in cases:
            with self.subTest(opener_sentence=opener_sentence):
                text, notes = enforce_response_format(
                    f"{opener_sentence} Let's start with one small thing.",
                    questions_allowed=True,
                )
                self.assertEqual(text, "Let's start with one small thing.")
                self.assertIn("banned_opener_sentence_dropped", notes)

    def test_declarative_verb_mid_sentence_is_not_touched(self):
        # The rule targets OPENERS, not the verb anywhere in the reply —
        # matches Part 4's "natural you elsewhere is correct and expected."
        text, notes = enforce_response_format(
            "That's a unique name, and it's interesting that you want to "
            "create a sense of personal connection with me.",
            questions_allowed=True,
        )

        self.assertIn("you want to create", text)
        self.assertNotIn("banned_opener_sentence_dropped", notes)

    def test_echo_repetition_sentence_dropped_whole(self):
        # Isolated to prove the NEW check, not the opener check by
        # coincidence: "You've been struggling with your sleep lately"
        # does not match any _BANNED_OPENERS pattern (no you're/you are/
        # you seem to be/you want/feel/think/need/know/wish), so this can
        # only be caught by word-overlap against the user's own message.
        user_message = "I've been struggling with my sleep lately."
        reply = (
            "You've been struggling with your sleep lately. "
            "Let's start with one small thing tonight."
        )
        text, notes = enforce_response_format(
            reply, questions_allowed=True, user_message=user_message,
        )

        self.assertNotIn("struggling with your sleep", text)
        self.assertIn("Let's start with one small thing tonight", text)
        self.assertIn("echo_repetition_sentence_dropped", notes)
        self.assertNotIn("banned_opener_sentence_dropped", notes)

    def test_echo_repetition_below_threshold_is_kept(self):
        # A sentence that merely shares topic words with the user's message
        # (not a restatement) must survive — the 70% threshold is meant to
        # catch near-duplicates, not any shared vocabulary.
        user_message = "I've been struggling with my sleep lately."
        reply = "Rest matters, and tonight might be a good night to protect it."
        text, notes = enforce_response_format(
            reply, questions_allowed=True, user_message=user_message,
        )

        self.assertEqual(text, reply)
        self.assertNotIn("echo_repetition_sentence_dropped", notes)

    def test_echo_check_reuses_validator_threshold_exactly(self):
        from ai.validator import _word_overlap_ratio
        from ai.companion_guardrails import ECHO_OVERLAP_THRESHOLD

        self.assertEqual(ECHO_OVERLAP_THRESHOLD, 0.70)
        # Same function object, not a reimplementation.
        import ai.companion_guardrails as guardrails_module
        self.assertIs(guardrails_module._word_overlap_ratio, _word_overlap_ratio)

    def test_banned_opener_as_only_sentence_drops_to_empty(self):
        # A reply that is ENTIRELY a banned opener has nothing left to
        # keep. enforce_response_format alone returns "" here — it's
        # apply_guardrails (tested below) that supplies SAFE_FALLBACK_LINE.
        text, notes = enforce_response_format(
            "You're feeling overwhelmed by all of it.", questions_allowed=True,
        )

        self.assertEqual(text, "")
        self.assertIn("banned_opener_sentence_dropped", notes)

    def test_i_understand_removed(self):
        text, notes = enforce_response_format(
            "I understand. That took courage to write.", questions_allowed=True
        )

        self.assertNotIn("I understand", text)
        self.assertIn("courage", text)

    def test_questions_stripped_when_budget_spent(self):
        text, notes = enforce_response_format(
            "That sounds heavy. What do you think is underneath it?", questions_allowed=False
        )

        self.assertNotIn("?", text)
        self.assertIn("question_over_budget_removed", notes)

    def test_insight_mode_allows_four_paragraphs_three_sentences(self):
        # Part 5: INSIGHT specifically may extend to 4 x 3. Each paragraph
        # here has exactly 3 sentences and there are exactly 4 paragraphs —
        # both must survive whole under mode="INSIGHT".
        paragraph = "First point here. Second point here. Third point here."
        reply = "\n\n".join([paragraph] * 4)

        text, notes = enforce_response_format(
            reply, questions_allowed=True, mode="INSIGHT",
        )

        self.assertEqual(len(text.split("\n\n")), 4)
        for shaped_paragraph in text.split("\n\n"):
            self.assertEqual(shaped_paragraph.count("."), 3)
        self.assertNotIn("paragraphs_trimmed", notes)
        self.assertNotIn("paragraph_trimmed", notes)
        self.assertNotIn("length_violation_non_insight_mode", notes)

    def test_insight_mode_still_caps_at_five_paragraphs(self):
        # The exception is 4, not unlimited — a 5th paragraph must still
        # be trimmed even under mode="INSIGHT".
        paragraph = "One sentence here."
        reply = "\n\n".join([paragraph] * 5)

        text, notes = enforce_response_format(
            reply, questions_allowed=True, mode="INSIGHT",
        )

        self.assertEqual(len(text.split("\n\n")), 4)
        self.assertIn("paragraphs_trimmed", notes)
        self.assertNotIn("length_violation_non_insight_mode", notes)

    def test_reflect_mode_exceeding_three_paragraphs_flagged_and_trimmed(self):
        # Part 5's explicit ask: a REFLECT/DIRECT/QUESTION reply that
        # overflows 3 paragraphs must be BOTH trimmed (never sent long)
        # AND carry the mode-specific tag, visible in the trace, not
        # folded anonymously into the generic "paragraphs_trimmed" note.
        paragraph = "One sentence here."
        reply = "\n\n".join([paragraph] * 4)

        text, notes = enforce_response_format(
            reply, questions_allowed=True, mode="REFLECT",
        )

        self.assertEqual(len(text.split("\n\n")), 3)
        self.assertIn("paragraphs_trimmed", notes)
        self.assertIn("length_violation_non_insight_mode", notes)

    def test_default_mode_treated_as_non_insight(self):
        # mode="" (the default) must behave exactly like REFLECT/DIRECT/
        # QUESTION — the tight cap, not the INSIGHT exception.
        paragraph = "One sentence here."
        reply = "\n\n".join([paragraph] * 4)

        text, notes = enforce_response_format(reply, questions_allowed=True)

        self.assertEqual(len(text.split("\n\n")), 3)
        self.assertIn("length_violation_non_insight_mode", notes)


class GuardrailPipelineTests(unittest.TestCase):
    def test_ungrounded_insight_never_gets_the_length_exception(self):
        # Part 5's "only triggered by grounded data" requirement, proven at
        # the pipeline level: mode="INSIGHT" requested, but tool_results has
        # no pattern_check >= 2, so guardrail 4 downgrades to REFLECT BEFORE
        # enforce_response_format runs — the 4-paragraph exception must
        # never apply here, because apply_guardrails wires final_mode
        # (post-downgrade), not the raw incoming mode.
        paragraph = "One sentence here."
        long_reply = "\n\n".join([paragraph] * 4)

        result = apply_guardrails(
            long_reply,
            mode="INSIGHT",
            tools_called=[],
            tool_results={},  # no pattern_check -> ungrounded
            questions_allowed=True,
        )

        self.assertEqual(result.final_mode, "REFLECT")
        self.assertEqual(len(result.reply.split("\n\n")), 3)
        self.assertIn("grounded_insight_downgrade", result.fired)
        self.assertIn("length_violation_non_insight_mode", result.fired)

    def test_grounded_insight_gets_the_length_exception(self):
        paragraph = "First point here. Second point here. Third point here."
        long_reply = "\n\n".join([paragraph] * 4)

        result = apply_guardrails(
            long_reply,
            mode="INSIGHT",
            tools_called=["journal_search", "pattern_check"],
            tool_results={"pattern_check": {"frequency": 3, "pattern_description": "x"}},
            questions_allowed=True,
        )

        self.assertEqual(result.final_mode, "INSIGHT")
        self.assertEqual(len(result.reply.split("\n\n")), 4)
        self.assertNotIn("length_violation_non_insight_mode", result.fired)

    def test_full_pipeline_on_a_bad_reply(self):
        bad_reply = (
            "It sounds like you have anxiety. "
            "You wrote about this last time in your journal. "
            "Try one small step tonight. "
            "What is underneath that feeling?"
        )
        result = apply_guardrails(
            bad_reply,
            mode="INSIGHT",
            tools_called=[],
            tool_results={},
            questions_allowed=False,
        )

        self.assertEqual(result.final_mode, "REFLECT")
        self.assertNotIn("anxiety", result.reply)
        self.assertNotIn("you wrote", result.reply.lower())
        self.assertNotIn("?", result.reply)
        self.assertIn("Try one small step tonight", result.reply)
        for expected in ["grounded_insight_downgrade", "therapist_drift", "fabricated_memory"]:
            self.assertIn(expected, result.fired)

    def test_reply_that_is_only_a_banned_opener_falls_back_to_safe_line(self):
        # New reachable edge case under whole-sentence-drop: a single-
        # sentence reply that is entirely a banned opener now drops to
        # nothing, and apply_guardrails must never send silence.
        result = apply_guardrails(
            "You're feeling overwhelmed by all of it.",
            mode="REFLECT",
            tools_called=[],
            tool_results={},
            questions_allowed=True,
        )

        self.assertEqual(result.reply, SAFE_FALLBACK_LINE)
        self.assertIn("empty_after_guardrails_fallback", result.fired)

    def test_reply_destroyed_by_guardrails_gets_safe_fallback(self):
        result = apply_guardrails(
            "You have a disorder.",
            mode="REFLECT",
            tools_called=[],
            tool_results={},
            questions_allowed=True,
        )

        self.assertTrue(result.reply)
        self.assertNotIn("disorder", result.reply)

    def test_clean_grounded_reply_passes_untouched(self):
        good_reply = "That weight you named is real. One slow breath before bed tonight."
        result = apply_guardrails(
            good_reply,
            mode="REFLECT",
            tools_called=["journal_search"],
            tool_results={"journal_search": [{"date": "2026-07-01"}]},
            questions_allowed=True,
        )

        self.assertEqual(result.reply, good_reply)
        self.assertEqual(result.fired, [])


if __name__ == "__main__":
    unittest.main()
