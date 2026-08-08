"""
Crisis detection must survive morphological variation.

Regression guard for the 2026-08-07 audit finding: every crisis net matched
only the exact surface form of a phrase, so "i keep thinking about killing
myself" escaped all of them -- \\bkill myself\\b cannot match "killing myself"
because the word boundary after "kill" fails against the "i" of "-ing".
That construction is common in real ideation (describing intrusive thoughts),
arguably more common than the imperative form that was caught.

These tests assert the PRE-LOOP gate specifically: main.py:2177 evaluates
`detect_distress(user_message) or safety_signal.get("crisis")` BEFORE
run_react_loop, and returns an escalation immediately. Anything reaching the
ReAct loop has already failed to escalate.
"""
import unittest

from ai.companion_agent import detect_distress
from ai.companion_intents import detect_emotional_state
from ai.validator import detect_life_companion_safety


def escalates_pre_loop(message: str) -> bool:
    """Exactly the main.py:2177 condition."""
    return bool(detect_distress(message)) or bool(
        detect_life_companion_safety(message).get("crisis")
    )


class CrisisMorphologyTests(unittest.TestCase):
    """The four gerund cases from the audit, plus the inflections around them."""

    GERUND_CASES = [
        "i keep thinking about killing myself",
        "i keep thinking about ending my life",
        "i keep thinking about hurting myself",
        "i keep thinking about dying",
    ]

    OTHER_INFLECTIONS = [
        "i almost killed myself last year",
        "i am killing myself slowly",
        "i nearly ended my life",
        "i hurt myself last night",
        "thoughts of harming myself",
        "i have been self harming",
        "i thought about overdosing",
        "i wish i was dead",
        "part of me wants to die",
    ]

    def test_gerund_forms_escalate_pre_loop(self):
        for message in self.GERUND_CASES:
            with self.subTest(message=message):
                self.assertTrue(
                    escalates_pre_loop(message),
                    f"gerund form did not escalate before the ReAct loop: {message!r}",
                )

    def test_other_inflections_escalate_pre_loop(self):
        for message in self.OTHER_INFLECTIONS:
            with self.subTest(message=message):
                self.assertTrue(
                    escalates_pre_loop(message),
                    f"inflected form did not escalate: {message!r}",
                )

    def test_gerunds_reach_every_net_not_just_the_gate(self):
        """One shared vocabulary means the downstream nets see them too."""
        for message in self.GERUND_CASES:
            with self.subTest(message=message):
                self.assertEqual(detect_emotional_state(message), "crisis")


class CrisisConstructionTests(unittest.TestCase):
    """Real-world phrasings that are not simple inflections."""

    SHOULD_ESCALATE = [
        "sometimes i think about not being here anymore",   # distancing / passive
        "the thought of ending it keeps coming",            # intrusive framing
        "if i killed myself would anyone notice",           # conditional
        "i don't want to kill myself but i think about it constantly",  # negated but real
        "i want to go to sleep and not wake up",            # euphemistic
    ]

    # Deliberately NOT escalated. Over-triggering has its own harm: routing a
    # philosophical or third-person remark to crisis support is a real cost,
    # and neither of these is a first-person statement about the user.
    SHOULD_NOT_ESCALATE = [
        "what if someone just stopped existing",
        "he kills himself in the story",
    ]

    def test_constructions_that_should_escalate(self):
        for message in self.SHOULD_ESCALATE:
            with self.subTest(message=message):
                self.assertTrue(
                    escalates_pre_loop(message),
                    f"construction did not escalate: {message!r}",
                )

    def test_constructions_that_should_not_escalate(self):
        for message in self.SHOULD_NOT_ESCALATE:
            with self.subTest(message=message):
                self.assertFalse(
                    escalates_pre_loop(message),
                    f"over-triggered on a non-first-person remark: {message!r}",
                )


class CrisisRegressionTests(unittest.TestCase):
    """Everything that worked before the morphology fix must still work."""

    ALREADY_WORKING = [
        "i want to die",
        "i want to kill myself",
        "i think about suicide",
        "i have been feeling suicidal",
        "i want to end my life",
        "i might hurt myself",
        "self-harm urges are back",
        "i took an overdose",
        "i want to disappear",
        "nothing i do matters",
        "i can't go on",
        "everyone would be better off without me",
    ]

    def test_previously_working_phrasings_still_escalate(self):
        for message in self.ALREADY_WORKING:
            with self.subTest(message=message):
                self.assertTrue(
                    escalates_pre_loop(message),
                    f"REGRESSION -- previously escalating phrase no longer does: {message!r}",
                )

    def test_ordinary_messages_do_not_escalate(self):
        """The false-positive guard. Measured 0/163 on real stored messages."""
        for message in [
            "work feels pointless lately and i don't know why",
            "i can't fall asleep and my mind won't quiet down",
            "my closest friend and i barely talk anymore these days",
            "my grandmother died last spring",
            "i'm dying to see that film",
        ]:
            with self.subTest(message=message):
                self.assertFalse(
                    escalates_pre_loop(message),
                    f"false positive on an ordinary message: {message!r}",
                )

    def test_end_it_narrowing_keeps_ideation_and_drops_the_breakup(self):
        """The bare r"\\bend it\\b" in DISTRESS_SIGNALS was removed.

        It escalated "end it with my girlfriend" -- a breakup routed to
        suicide helplines. Removal was gated on proving CRISIS_CORE_PATTERNS
        already covers the genuine ideation forms without it: "end it all"
        matches explicitly, and the framed forms match the ideation pattern,
        whose own "end it" clause carries a (?!\\s+with) lookahead.

        Both halves are asserted together on purpose -- narrowing a crisis
        trigger is only safe while the ideation coverage below still holds.
        """
        for message in [
            "i keep thinking about ending it",
            "i want to end it all",
            "thinking about ending it tonight",
            "the thought of ending it keeps coming",
        ]:
            with self.subTest(message=message, expect="escalate"):
                self.assertTrue(
                    escalates_pre_loop(message),
                    f"ideation coverage lost after narrowing: {message!r}",
                )
        with self.subTest(message="breakup", expect="no escalation"):
            self.assertFalse(
                escalates_pre_loop("i want to end it with my girlfriend"),
                "breakup still routed to crisis support",
            )


class SharedVocabularyTests(unittest.TestCase):
    """One source of truth: a concept added once must reach every net."""

    def test_all_nets_consume_the_shared_core(self):
        from ai.companion_agent import DISTRESS_SIGNALS
        from ai.companion_intents import CRISIS_CORE_PATTERNS, CRISIS_PATTERNS
        from ai.validator import CRISIS_PATTERNS as VALIDATOR_CRISIS_PATTERNS

        for pattern in CRISIS_CORE_PATTERNS:
            with self.subTest(pattern=pattern):
                self.assertIn(pattern, DISTRESS_SIGNALS["crisis"])
                self.assertIn(pattern, CRISIS_PATTERNS)
                self.assertIn(pattern, VALIDATOR_CRISIS_PATTERNS)


if __name__ == "__main__":
    unittest.main()
