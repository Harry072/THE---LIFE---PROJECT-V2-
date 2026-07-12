import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks

import main
from ai.companion_orchestrator import build_orchestrator_payload, feed_orchestrator
from ai.companion_security import (
    DAILY_LIMIT_MESSAGE,
    RateLimitStatus,
    SESSION_PAUSE_MESSAGE,
)
from tests.test_companion_tools import FakeSupabase


USER_ID = "11111111-1111-1111-1111-111111111111"


def run_async(coro):
    return asyncio.run(coro)


def make_request(message: str, conversation_id: str | None = "conv-1"):
    return main.LifeCompanionRequest(
        mode="understand_me", message=message, conversation_id=conversation_id
    )


def gateway_success(reply: str):
    return SimpleNamespace(
        status="success",
        provider="groq",
        companion_response={
            "reply": reply,
            "suggested_action": {"type": "none", "label": "", "route": None},
            "tone": "grounded",
            "safety": {"risk_level": "none", "message": None},
            "reply_format": "conversation",
            "intent": "general_question",
        },
        latency_ms=5,
        provider_ms=5,
        validation_ms=0,
        prompt_build_ms=1,
        fallback_reason=None,
        final_response_mode="live_groq",
        validation_failure_reason=None,
        error_reason=None,
    )


OPEN_RATE = RateLimitStatus(
    session_count=2, daily_count=5, soft_close=False,
    session_exceeded=False, daily_exceeded=False,
)


class CompanionWiringTests(unittest.TestCase):
    def base_patches(self, fake_supabase, rate_status=OPEN_RATE):
        return [
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake_supabase),
            patch.object(main, "get_owned_companion_conversation", return_value={"id": "conv-1"}),
            patch.object(main, "create_companion_conversation", return_value={"id": "conv-1"}),
            patch.object(main, "fetch_companion_conversation_history", return_value=[]),
            patch.object(main, "build_life_companion_context", return_value={"safe_memory_summary": {}}),
            patch.object(main, "retrieve_companion_knowledge", return_value=[]),
            patch.object(main, "check_rate_limits", return_value=rate_status),
            patch.object(
                main, "persist_companion_exchange",
                return_value={"id": "conv-1", "title": "t", "updated_at": "now"},
            ),
        ]

    def call(self, message, fake_supabase, gateway_mock, rate_status=OPEN_RATE):
        background = BackgroundTasks()
        patches = self.base_patches(fake_supabase, rate_status)
        with (
            patches[0], patches[1], patches[2], patches[3], patches[4],
            patches[5], patches[6], patches[7], patches[8],
            patch.object(main, "generate_life_companion_response", gateway_mock),
        ):
            response = run_async(
                main.life_companion_chat(
                    make_request(message),
                    background_tasks=background,
                    authorization="Bearer token",
                )
            )
        return response, background

    def test_distress_message_escalates_without_calling_gateway(self):
        fake = FakeSupabase({"reflections": []})
        gateway = unittest.mock.MagicMock()

        response, background = self.call("I just want to give up today", fake, gateway)

        gateway.assert_not_called()
        self.assertEqual(response["status"], "safety")
        self.assertIn("9152987821", str(response["sections"]))
        self.assertEqual(fake.inserts[0][0], "escalation_log")
        self.assertEqual(len(background.tasks), 1)  # orchestrator feed scheduled

    def test_session_rate_limit_returns_pause_without_gateway(self):
        fake = FakeSupabase({"reflections": []})
        gateway = unittest.mock.MagicMock()
        limited = RateLimitStatus(19, 30, False, True, False)

        response, background = self.call("just checking in", fake, gateway, rate_status=limited)

        gateway.assert_not_called()
        self.assertEqual(response["status"], "rate_limited")
        self.assertEqual(response["reply"], SESSION_PAUSE_MESSAGE)
        self.assertEqual(fake.inserts, [])  # nothing persisted, nothing escalated

    def test_daily_rate_limit_serves_cached_warm_response(self):
        fake = FakeSupabase({"reflections": []})
        gateway = unittest.mock.MagicMock()
        limited = RateLimitStatus(3, 50, False, False, True)

        response, _ = self.call("hello again", fake, gateway, rate_status=limited)

        gateway.assert_not_called()
        self.assertEqual(response["reply"], DAILY_LIMIT_MESSAGE)

    def test_distress_beats_rate_limit(self):
        """A user at the cap in crisis still gets the escalation response."""
        fake = FakeSupabase({"reflections": []})
        gateway = unittest.mock.MagicMock()
        limited = RateLimitStatus(25, 60, False, True, True)

        response, _ = self.call("I can't do this anymore", fake, gateway, rate_status=limited)

        self.assertEqual(response["status"], "safety")
        self.assertEqual(fake.inserts[0][0], "escalation_log")

    def test_normal_message_calls_gateway_and_applies_guardrails(self):
        fake = FakeSupabase({"reflections": []})
        bad_reply = "It sounds like you have anxiety. You wrote about this before. Try a short walk tonight."
        gateway = unittest.mock.MagicMock(return_value=gateway_success(bad_reply))

        response, background = self.call("Today felt strange and slow somehow", fake, gateway)

        gateway.assert_called_once()
        reply = response["reply"]
        self.assertNotIn("anxiety", reply)                # therapist drift rewritten
        self.assertNotIn("you wrote", reply.lower())      # fabricated memory removed
        self.assertIn("Try a short walk tonight", reply)  # clean sentence survives
        self.assertEqual(len(background.tasks), 1)        # orchestrator feed scheduled

    def test_directive_block_reaches_gateway_context(self):
        fake = FakeSupabase({"reflections": []})
        gateway = unittest.mock.MagicMock(return_value=gateway_success("A calm reply."))

        self.call("Today felt strange and slow somehow", fake, gateway)

        _, kwargs = gateway.call_args
        directive = kwargs["context"].get("agent_directive_block") or ""
        self.assertIn("[AGENT DIRECTIVE", directive)
        self.assertIn("REFLECT", directive)


class OrchestratorPayloadTests(unittest.TestCase):
    def test_escalation_payload_marks_crisis(self):
        payload = build_orchestrator_payload(
            user_id=USER_ID, agent_turn=None, message="so heavy", escalation_triggered=True
        )

        self.assertEqual(payload["session_quality"], "crisis")
        self.assertTrue(payload["escalation_triggered"])
        self.assertEqual(payload["energy_level"], "low")
        self.assertEqual(payload["primary_emotion"], "distress")

    def test_normal_turn_payload_shape(self):
        turn = SimpleNamespace(
            tool_results={
                "pattern_check": {"frequency": 3, "pattern_description": "'stuck' appeared 3 times"},
                "task_history": {"most_skipped_category": "reflection"},
            },
            tools_called=["journal_search", "pattern_check", "task_history"],
            trace={"steps": [{"step": "reason", "message_emotion": "stuck"}]},
        )
        payload = build_orchestrator_payload(
            user_id=USER_ID, agent_turn=turn, message="feeling tired", escalation_triggered=False
        )

        self.assertEqual(payload["primary_emotion"], "stuck")
        self.assertTrue(payload["pattern_detected"])
        self.assertEqual(payload["session_quality"], "deep")
        self.assertEqual(payload["task_recommendation"], "reflection")
        self.assertEqual(payload["energy_level"], "low")


class UpsertRecorder:
    def __init__(self, fail_times: int = 0):
        self.fail_times = fail_times
        self.attempts = 0

    def table(self, name):
        return self

    def upsert(self, payload, **kwargs):
        self.payload = payload
        return self

    def execute(self):
        self.attempts += 1
        if self.attempts <= self.fail_times:
            raise RuntimeError("companion_context unavailable")
        return SimpleNamespace(data=[])


class FeedOrchestratorTests(unittest.TestCase):
    def test_write_succeeds_first_try(self):
        recorder = UpsertRecorder()
        ok = run_async(feed_orchestrator(recorder, {"user_id": USER_ID, "date": "2026-07-08"}))

        self.assertTrue(ok)
        self.assertEqual(recorder.attempts, 1)

    def test_failed_write_retries_once_after_delay(self):
        recorder = UpsertRecorder(fail_times=1)
        with patch("ai.companion_orchestrator.asyncio.sleep", new=AsyncMock()) as slept:
            ok = run_async(feed_orchestrator(recorder, {"user_id": USER_ID, "date": "2026-07-08"}))

        self.assertTrue(ok)
        self.assertEqual(recorder.attempts, 2)
        slept.assert_awaited_once_with(30)

    def test_double_failure_gives_up_without_raising(self):
        recorder = UpsertRecorder(fail_times=2)
        with patch("ai.companion_orchestrator.asyncio.sleep", new=AsyncMock()):
            ok = run_async(feed_orchestrator(recorder, {"user_id": USER_ID, "date": "2026-07-08"}))

        self.assertFalse(ok)
        self.assertEqual(recorder.attempts, 2)


if __name__ == "__main__":
    unittest.main()
