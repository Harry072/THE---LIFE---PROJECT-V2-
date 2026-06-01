import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from ai import companion_gateway as gateway
from ai.groq_companion_gateway import GroqCompanionProviderError


PROMPT_VERSION = "life_companion_provider_order_test"
CLASSIFICATION = {
    "emotional_state": "none",
    "intent": "solve_directly",
    "subject": "general",
    "user_goal": "answer directly",
    "wants_to_talk": False,
    "is_refusing_feature": False,
    "refused_feature": "none",
    "answer_posture": "solve_directly",
    "confidence": 0.9,
}


def provider_response(reply: str = "Groq gave a live answer.", latency_ms: int = 7):
    return SimpleNamespace(
        text=json.dumps(
            {
                "reply": reply,
                "suggested_action": {
                    "type": "none",
                    "label": "",
                    "route": None,
                },
                "tone": "grounded",
                "safety": {
                    "risk_level": "none",
                    "message": None,
                },
            }
        ),
        latency_ms=latency_ms,
    )


def run_gateway(user_message: str = "hello"):
    return gateway.generate_life_companion_response(
        prompt_version=PROMPT_VERSION,
        mode="understand_me",
        context={},
        user_message=user_message,
    )


class CompanionGatewayProviderOrderTests(unittest.TestCase):
    def test_provider_order_is_groq_only(self):
        self.assertEqual(gateway.get_companion_provider_order(), [gateway.PROVIDER_GROQ])

    def test_groq_success_does_not_call_openai_or_gemini(self):
        with (
            patch("builtins.print"),
            patch(
                "ai.companion_gateway.run_understanding_pass",
                return_value=dict(CLASSIFICATION),
            ),
            patch("ai.companion_gateway.retrieve_playbook_chunks", return_value="test rag context"),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq_messages",
                return_value=provider_response("Groq gave the companion answer."),
            ) as groq,
            patch("ai.companion_gateway.generate_life_companion_with_openai") as openai,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        self.assertEqual(result.final_response_mode, "live_groq")
        self.assertEqual([attempt.provider for attempt in result.attempts], [gateway.PROVIDER_GROQ])
        self.assertEqual(result.companion_response["reply"], "Groq gave the companion answer.")
        groq.assert_called_once()
        openai.assert_not_called()

    def test_groq_provider_failure_uses_static_fallback(self):
        with (
            patch("builtins.print"),
            patch(
                "ai.companion_gateway.run_understanding_pass",
                return_value=dict(CLASSIFICATION),
            ),
            patch("ai.companion_gateway.retrieve_playbook_chunks", return_value="test rag context"),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq_messages",
                side_effect=GroqCompanionProviderError(
                    gateway.REASON_UNAVAILABLE,
                    latency_ms=0,
                ),
            ) as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, gateway.PROVIDER_FALLBACK)
        self.assertEqual([attempt.provider for attempt in result.attempts], [gateway.PROVIDER_GROQ])
        self.assertEqual(result.attempts[0].failure_class, gateway.REASON_UNAVAILABLE)
        groq.assert_called_once()

    def test_groq_invalid_json_uses_static_fallback(self):
        with (
            patch("builtins.print"),
            patch(
                "ai.companion_gateway.run_understanding_pass",
                return_value=dict(CLASSIFICATION),
            ),
            patch("ai.companion_gateway.retrieve_playbook_chunks", return_value="test rag context"),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq_messages",
                return_value=SimpleNamespace(text="not json", latency_ms=5),
            ),
        ):
            result = run_gateway()

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, gateway.PROVIDER_FALLBACK)
        self.assertEqual(result.attempts[0].validation_failure_reason, gateway.REASON_INVALID_JSON)

    def test_weak_groq_procrastination_reply_gets_quality_floor(self):
        with (
            patch("builtins.print"),
            patch(
                "ai.companion_gateway.run_understanding_pass",
                return_value={
                    **CLASSIFICATION,
                    "intent": "motivation",
                    "subject": "procrastination",
                    "user_goal": "move through resistance and take action.",
                },
            ),
            patch("ai.companion_gateway.retrieve_playbook_chunks", return_value="test rag context"),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq_messages",
                return_value=provider_response(
                    "Procrastination can be tough to break. What's the project about?"
                ),
            ),
        ):
            result = run_gateway("I feel stuck with my project and I keep procrastinating.")

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        self.assertIn("resistance wearing a productivity mask", result.companion_response["reply"])
        self.assertNotIn("can be tough", result.companion_response["reply"].lower())

    def test_groq_procrastination_question_gets_direct_mode_floor(self):
        with (
            patch("builtins.print"),
            patch(
                "ai.companion_gateway.run_understanding_pass",
                return_value={
                    **CLASSIFICATION,
                    "intent": "motivation",
                    "subject": "procrastination",
                    "user_goal": "move through resistance and take action.",
                },
            ),
            patch("ai.companion_gateway.retrieve_playbook_chunks", return_value="test rag context"),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq_messages",
                return_value=provider_response(
                    "You're feeling stuck and procrastination is holding you back. "
                    "What's the project about?"
                ),
            ),
        ):
            result = run_gateway("I feel stuck with my project and I keep procrastinating.")

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        self.assertIn("make the first step so small", result.companion_response["reply"])
        self.assertNotIn("?", result.companion_response["reply"])

    def test_short_generic_procrastination_reply_gets_direct_mode_floor(self):
        with (
            patch("builtins.print"),
            patch(
                "ai.companion_gateway.run_understanding_pass",
                return_value={
                    **CLASSIFICATION,
                    "intent": "motivation",
                    "subject": "procrastination",
                    "user_goal": "move through resistance and take action.",
                },
            ),
            patch("ai.companion_gateway.retrieve_playbook_chunks", return_value="test rag context"),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq_messages",
                return_value=provider_response(
                    "Let's break it down into smaller, manageable tasks to get you moving again."
                ),
            ),
        ):
            result = run_gateway("I feel stuck with my project and I keep procrastinating.")

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        self.assertIn("resistance wearing a productivity mask", result.companion_response["reply"])
        self.assertNotIn("manageable tasks", result.companion_response["reply"].lower())


if __name__ == "__main__":
    unittest.main()
