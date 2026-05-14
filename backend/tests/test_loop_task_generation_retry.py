import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main
from ai.gateway import (
    AIGenerationError,
    _call_google_genai_loop_tasks,
    build_gemini_diagnosis,
    classify_gemini_error,
)


USER_ID = "11111111-1111-1111-1111-111111111111"
LOCAL_DATE = "2026-05-14"


def run_async(coro):
    return asyncio.run(coro)


def task(category: str, title: str) -> dict:
    return {
        "category": category,
        "title": title,
        "subtitle": f"{category.title()} Practice",
        "why_this_helps": "This practice creates one concrete signal from today's pattern.",
        "detail_description": "A clear task helps the user act without overthinking.\n\nAction: Do the named action once.",
        "duration_minutes": 5,
        "preferred_time_of_day": "today",
        "supportive_line": "One honest step is enough.",
        "difficulty_level": "gentle",
        "success_condition": "The named action is complete once.",
        "smaller_version": "Do the first two minutes only.",
        "post_completion_question": "Was this too easy, right-sized, or too heavy?",
        "framework_key": "morita",
    }


AI_TASKS = [
    task("awareness", "Write 3 Honest Lines"),
    task("action", "Move 1 Visible Step"),
    task("meaning", "Send 1 Useful Message"),
]


class LoopTaskGenerationRetryTests(unittest.TestCase):
    def _base_patches(self):
        return (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "fetch_today_core_tasks", return_value=[]),
            patch.object(main, "build_generation_context", return_value={
                "struggles_summary": "scrolling, sleep, consistency",
                "current_day": 1,
                "journey_guidance": "Focus on gentle awareness and low-pressure action.",
                "context_used": ["struggles", "streak"],
                "streak_band": "new",
                "completion_pattern": "mixed",
                "suggested_intensity": "gentle",
            }),
            patch.object(main, "build_loop_tasks_prompt", return_value="safe loop prompt"),
        )

    def test_gemini_success_saves_three_ai_tasks(self):
        request = main.TaskRequest(
            user_id=USER_ID,
            local_date=LOCAL_DATE,
            struggles=["scrolling"],
            current_streak=0,
        )
        captured = {}

        def fake_insert(user_id, local_date, rows, *, source):
            captured["rows"] = rows
            captured["source"] = source
            return "inserted", rows

        patches = self._base_patches()
        with (
            patches[0],
            patches[1],
            patches[2],
            patches[3],
            patch.object(main, "loop_gemini_client", object()),
            patch.object(
                main,
                "generate_loop_tasks_with_gemini",
                return_value=SimpleNamespace(
                    text='{"tasks":[]}',
                    provider="gemini",
                    prompt_version=main.LOOP_TASKS_PROMPT_VERSION,
                    latency_ms=12,
                ),
            ),
            patch.object(main, "validate_ai_tasks", return_value=AI_TASKS),
            patch.object(main, "insert_task_rows", side_effect=fake_insert),
        ):
            response = run_async(main.generate_tasks(request, authorization="Bearer token"))

        self.assertEqual(response["status"], "inserted")
        self.assertEqual(captured["source"], "ai_success")
        self.assertEqual(len(captured["rows"]), 3)
        self.assertTrue(all(row["ai_generated"] is True for row in captured["rows"]))
        self.assertTrue(all(row["generation_provider"] == "gemini" for row in captured["rows"]))

    def test_first_gemini_failure_returns_retryable_without_saving_fallback(self):
        request = main.TaskRequest(
            user_id=USER_ID,
            local_date=LOCAL_DATE,
            struggles=["scrolling"],
            current_streak=0,
            allow_safe_fallback=False,
        )
        diagnosis = build_gemini_diagnosis(
            "gemini_permission_denied",
            key_source="GEMINI_API_KEY",
            gemini_api_key_present=True,
            google_api_key_present=False,
            model_name="gemini-2.5-flash",
        )

        patches = self._base_patches()
        with (
            patches[0],
            patches[1],
            patches[2],
            patches[3],
            patch.object(main, "loop_gemini_client", object()),
            patch.object(
                main,
                "generate_loop_tasks_with_gemini",
                side_effect=AIGenerationError(
                    "gemini_permission_denied",
                    "permission denied",
                    latency_ms=10,
                    diagnosis=diagnosis,
                ),
            ),
            patch.object(main, "save_fallback_tasks") as save_fallback,
            patch.object(main, "insert_task_rows") as insert_rows,
        ):
            response = run_async(main.generate_tasks(request, authorization="Bearer token"))

        self.assertEqual(response["status"], "retryable_ai_failure")
        self.assertEqual(response["data"], [])
        self.assertTrue(response["meta"]["retryable"])
        self.assertEqual(response["meta"]["diagnosis"]["reason"], "gemini_permission_denied")
        save_fallback.assert_not_called()
        insert_rows.assert_not_called()

    def test_retry_failure_tries_gemini_then_saves_safe_fallback(self):
        request = main.TaskRequest(
            user_id=USER_ID,
            local_date=LOCAL_DATE,
            struggles=["scrolling"],
            current_streak=0,
            allow_safe_fallback=True,
        )
        fallback_rows = [
            {"id": "a", "category": "awareness", "ai_generated": False, "generation_provider": "safe_fallback"},
            {"id": "b", "category": "action", "ai_generated": False, "generation_provider": "safe_fallback"},
            {"id": "c", "category": "meaning", "ai_generated": False, "generation_provider": "safe_fallback"},
        ]

        patches = self._base_patches()
        with (
            patches[0],
            patches[1],
            patches[2],
            patches[3],
            patch.object(main, "loop_gemini_client", object()),
            patch.object(
                main,
                "generate_loop_tasks_with_gemini",
                side_effect=AIGenerationError("gemini_permission_denied", "permission denied", latency_ms=10),
            ) as live_call,
            patch.object(main, "delete_uncompleted_generated_core_tasks") as delete_existing,
            patch.object(main, "save_fallback_tasks", return_value=("fallback", fallback_rows)) as save_fallback,
        ):
            response = run_async(main.generate_tasks(request, authorization="Bearer token"))

        live_call.assert_called_once()
        delete_existing.assert_called_once_with(USER_ID, LOCAL_DATE)
        save_fallback.assert_called_once()
        _, kwargs = save_fallback.call_args
        self.assertEqual(kwargs["generation_provider"], "safe_fallback")
        self.assertEqual(kwargs["generation_failure_reason"], "gemini_permission_denied")
        self.assertTrue(kwargs["force_insert_all"])
        self.assertEqual(response["status"], "fallback")
        self.assertEqual(len(response["data"]), 3)
        self.assertEqual(response["meta"]["provider"], "safe_fallback")

    def test_permission_denied_is_classified_for_key_diagnosis(self):
        class PermissionDenied(Exception):
            code = 403

        reason = classify_gemini_error(PermissionDenied("PermissionDenied: HTTPStatus.FORBIDDEN"))
        self.assertEqual(reason, "gemini_permission_denied")

    def test_loop_gemini_call_uses_schema_constrained_json_output(self):
        captured = {}

        class FakeModels:
            def generate_content(self, *, model, contents, config):
                captured["model"] = model
                captured["contents"] = contents
                captured["config"] = config
                return SimpleNamespace(text='{"tasks": []}')

        class FakeClient:
            models = FakeModels()

        text = _call_google_genai_loop_tasks(FakeClient(), "gemini-2.5-flash", "safe prompt")

        self.assertEqual(text, '{"tasks": []}')
        self.assertEqual(captured["model"], "gemini-2.5-flash")
        self.assertEqual(captured["config"].response_mime_type, "application/json")
        schema = captured["config"].response_json_schema
        self.assertEqual(schema["properties"]["tasks"]["minItems"], 3)
        self.assertEqual(schema["properties"]["tasks"]["maxItems"], 3)

    def test_diagnosis_reports_google_key_precedence_without_key_values(self):
        diagnosis = build_gemini_diagnosis(
            "gemini_permission_denied",
            key_source="GOOGLE_API_KEY",
            gemini_api_key_present=True,
            google_api_key_present=True,
            model_name="gemini-2.5-flash",
        )

        self.assertEqual(diagnosis["effective_key_source"], "GOOGLE_API_KEY")
        self.assertTrue(diagnosis["gemini_api_key_present"])
        self.assertTrue(diagnosis["google_api_key_present"])
        self.assertIn("overrides", diagnosis["google_api_key_precedence"])
        self.assertNotIn("AIza", str(diagnosis))


if __name__ == "__main__":
    unittest.main()
