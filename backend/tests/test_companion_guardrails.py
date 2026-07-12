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

    def test_banned_openers_stripped(self):
        text, notes = enforce_response_format(
            "It sounds like today was heavy for you.", questions_allowed=True
        )

        self.assertTrue(text.startswith("Today was heavy"))
        self.assertIn("banned_opener_stripped", notes)

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


class GuardrailPipelineTests(unittest.TestCase):
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
