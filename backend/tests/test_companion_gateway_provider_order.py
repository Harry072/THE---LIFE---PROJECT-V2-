import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from ai import companion_gateway as gateway
from ai.groq_companion_gateway import GroqCompanionProviderError


PROMPT = "final life companion prompt"
PROMPT_VERSION = "life_companion_v3"


def provider_response(reply: str = "Here is a steady live answer.", latency_ms: int = 7):
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


def run_gateway(user_message: str = "today is my seminar give me quote"):
    with patch("builtins.print"):
        return gateway.generate_life_companion_response(
            prompt=PROMPT,
            prompt_version=PROMPT_VERSION,
            mode="understand_me",
            context={},
            user_message=user_message,
        )


class CompanionGatewayProviderOrderTests(unittest.TestCase):
    def test_openai_success_skips_groq(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                return_value=provider_response("OpenAI gave a live answer."),
            ) as openai,
            patch("ai.companion_gateway.generate_life_companion_with_groq") as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_OPENAI)
        self.assertEqual(result.final_response_mode, "live_openai")
        self.assertEqual(result.companion_response["reply"], "OpenAI gave a live answer.")
        self.assertEqual([attempt.provider for attempt in result.attempts], [gateway.PROVIDER_OPENAI])
        openai.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)
        groq.assert_not_called()

    def test_openai_quota_exceeded_then_groq_success(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_QUOTA, latency_ms=3),
            ) as openai,
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                return_value=provider_response("Groq gave a live answer."),
            ) as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        self.assertEqual(result.final_response_mode, "live_groq")
        self.assertEqual(result.companion_response["reply"], "Groq gave a live answer.")
        self.assertEqual(
            [attempt.provider for attempt in result.attempts],
            [gateway.PROVIDER_OPENAI, gateway.PROVIDER_GROQ],
        )
        self.assertEqual(result.attempts[0].failure_class, gateway.REASON_QUOTA)
        openai.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)
        groq.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)

    def test_openai_timeout_then_groq_success(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_TIMEOUT, latency_ms=10),
            ),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                return_value=provider_response("Groq handled the timeout."),
            ) as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        groq.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)

    def test_openai_invalid_json_then_groq_success(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                return_value=SimpleNamespace(text="not json", latency_ms=4),
            ),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                return_value=provider_response("Groq handled invalid OpenAI output."),
            ) as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        self.assertEqual(result.attempts[0].validation_failure_reason, gateway.REASON_INVALID_JSON)
        groq.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)

    def test_openai_failure_and_groq_missing_key_uses_deterministic_fallback(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_QUOTA, latency_ms=3),
            ),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                side_effect=GroqCompanionProviderError(gateway.REASON_UNAVAILABLE, latency_ms=0),
            ) as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, gateway.PROVIDER_FALLBACK)
        self.assertEqual(
            [attempt.provider for attempt in result.attempts],
            [gateway.PROVIDER_OPENAI, gateway.PROVIDER_GROQ],
        )
        self.assertEqual(result.attempts[1].failure_class, gateway.REASON_UNAVAILABLE)
        groq.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)

    def test_openai_failure_and_groq_invalid_json_uses_deterministic_fallback(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_QUOTA, latency_ms=3),
            ),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                return_value=SimpleNamespace(text="not json", latency_ms=5),
            ),
        ):
            result = run_gateway()

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, gateway.PROVIDER_FALLBACK)
        self.assertEqual(result.attempts[1].validation_failure_reason, gateway.REASON_INVALID_JSON)

    def test_openai_failure_and_groq_unsafe_output_uses_deterministic_fallback(self):
        with (
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_QUOTA, latency_ms=3),
            ),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                return_value=provider_response("This is therapy for your problem."),
            ),
        ):
            result = run_gateway()

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, gateway.PROVIDER_FALLBACK)
        self.assertEqual(result.attempts[1].validation_failure_reason, gateway.REASON_UNSAFE_OUTPUT)

    def test_openai_auth_failure_does_not_try_groq_by_default(self):
        with (
            patch.dict(os.environ, {"LIFE_COMPANION_ALLOW_AUTH_FALLBACK_TO_GROQ": "false"}, clear=False),
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_AUTH_FAILED, latency_ms=3),
            ),
            patch("ai.companion_gateway.generate_life_companion_with_groq") as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.provider, gateway.PROVIDER_FALLBACK)
        self.assertEqual([attempt.provider for attempt in result.attempts], [gateway.PROVIDER_OPENAI])
        groq.assert_not_called()

    def test_openai_auth_failure_can_try_groq_when_enabled(self):
        with (
            patch.dict(os.environ, {"LIFE_COMPANION_ALLOW_AUTH_FALLBACK_TO_GROQ": "true"}, clear=False),
            patch(
                "ai.companion_gateway.generate_life_companion_with_openai",
                side_effect=gateway.CompanionProviderError(gateway.REASON_AUTH_FAILED, latency_ms=3),
            ),
            patch(
                "ai.companion_gateway.generate_life_companion_with_groq",
                return_value=provider_response("Groq handled the auth fallback."),
            ) as groq,
        ):
            result = run_gateway()

        self.assertEqual(result.status, "success")
        self.assertEqual(result.provider, gateway.PROVIDER_GROQ)
        groq.assert_called_once_with(PROMPT, prompt_version=PROMPT_VERSION)


if __name__ == "__main__":
    unittest.main()
