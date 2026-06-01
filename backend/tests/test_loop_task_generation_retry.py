import asyncio
import json
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
from ai.validator import TaskValidationError, validate_ai_tasks


USER_ID = "11111111-1111-1111-1111-111111111111"
LOCAL_DATE = "2026-05-14"


def run_async(coro):
    return asyncio.run(coro)


def task(category: str, title: str) -> dict:
    kotler_by_category = {
        "awareness": "Curiosity",
        "action": "Mastery",
        "reflection": "Autonomy",
        "reset": "Autonomy",
        "growth": "Purpose",
    }
    layer_by_category = {
        "awareness": "distraction",
        "action": "ego",
        "reflection": "attachment",
        "reset": "anger",
        "growth": "greed",
    }
    angle_by_category = {
        "awareness": "reflective",
        "action": "embodied",
        "reflection": "oblique",
        "reset": "embodied",
        "growth": "direct",
    }
    return {
        "category": category,
        "title": title,
        "subtitle": f"{category.title()} Practice",
        "kotler_tag": kotler_by_category[category],
        "waar_action": "Do the named action once with full attention.",
        "ikigai_purpose": "A clear action gives the mind one visible proof that movement is possible.",
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
        "inner_work_layer": layer_by_category[category],
        "approach_angle": angle_by_category[category],
        "journey_phase": "foundation",
        "ikigai_quadrant": "profession",
    }


AI_TASKS = [
    task("awareness", "Write 3 Honest Lines"),
    task("action", "Move 1 Visible Step"),
    task("reflection", "Name 1 Avoided Feeling"),
    task("reset", "Take 5 Slow Breaths"),
    task("growth", "Send 1 Useful Message"),
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

    def test_gemini_success_saves_five_ai_tasks(self):
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
        self.assertEqual(len(captured["rows"]), 5)
        self.assertTrue(all(row["ai_generated"] is True for row in captured["rows"]))
        self.assertTrue(all(row["generation_provider"] == "gemini" for row in captured["rows"]))
        self.assertEqual(captured["rows"][0]["kotler_tag"], "Curiosity")

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

    def test_provider_unavailable_first_attempt_returns_retryable_without_saving(self):
        request = main.TaskRequest(
            user_id=USER_ID,
            local_date=LOCAL_DATE,
            struggles=["scrolling"],
            current_streak=0,
            allow_safe_fallback=False,
        )

        patches = self._base_patches()
        with (
            patches[0],
            patches[1],
            patches[2],
            patches[3],
            patch.object(main, "loop_gemini_client", None),
            patch.object(main, "save_fallback_tasks") as save_fallback,
            patch.object(main, "insert_task_rows") as insert_rows,
        ):
            response = run_async(main.generate_tasks(request, authorization="Bearer token"))

        self.assertEqual(response["status"], "retryable_ai_failure")
        self.assertEqual(response["data"], [])
        self.assertEqual(response["meta"]["error_reason"], "provider_unavailable")
        save_fallback.assert_not_called()
        insert_rows.assert_not_called()

    def test_invalid_local_date_is_rejected_before_generation(self):
        request = main.TaskRequest(
            user_id=USER_ID,
            local_date="2026/05/14",
            struggles=["scrolling"],
            current_streak=0,
        )

        with patch.object(main, "validate_supabase_access_token", return_value=USER_ID):
            with self.assertRaises(main.HTTPException) as raised:
                run_async(main.generate_tasks(request, authorization="Bearer token"))

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("local_date", raised.exception.detail)

    def test_safe_fallback_rows_are_not_marked_ai_generated(self):
        captured = {}

        def fake_insert(user_id, local_date, rows, *, source):
            captured["source"] = source
            captured["rows"] = rows
            return "inserted", rows

        with (
            patch.object(main, "generate_fallback_tasks", return_value=AI_TASKS),
            patch.object(main, "insert_task_rows", side_effect=fake_insert),
        ):
            status, rows = main.save_fallback_tasks(
                {
                    "struggles_summary": "scrolling",
                    "current_day": 1,
                    "suggested_intensity": "gentle",
                },
                USER_ID,
                LOCAL_DATE,
                generation_provider="safe_fallback",
                generation_failure_reason="provider_timeout",
                force_insert_all=True,
            )

        self.assertEqual(status, "fallback")
        self.assertEqual(captured["source"], "safe_fallback")
        self.assertEqual(rows, captured["rows"])
        self.assertTrue(all(row["ai_generated"] is False for row in rows))
        self.assertTrue(all(row["generation_provider"] == "safe_fallback" for row in rows))
        self.assertTrue(all(row["generation_failure_reason"] == "provider_timeout" for row in rows))

    def test_string_optional_rows_are_not_treated_as_core_tasks(self):
        self.assertTrue(main.is_core_task({"category": "awareness", "is_optional": "false"}))
        self.assertFalse(main.is_core_task({"category": "awareness", "is_optional": "true"}))

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
            {"id": "c", "category": "reflection", "ai_generated": False, "generation_provider": "safe_fallback"},
            {"id": "d", "category": "reset", "ai_generated": False, "generation_provider": "safe_fallback"},
            {"id": "e", "category": "growth", "ai_generated": False, "generation_provider": "safe_fallback"},
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
        self.assertEqual(len(response["data"]), 5)
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
        schema = captured["config"].response_schema
        self.assertEqual(schema["properties"]["tasks"]["minItems"], 5)
        self.assertEqual(schema["properties"]["tasks"]["maxItems"], 5)
        task_schema = schema["$defs"]["LoopTaskPayload"]["properties"]
        self.assertIn("kotler_tag", task_schema)
        self.assertIn("waar_action", task_schema)
        self.assertIn("ikigai_purpose", task_schema)

    def test_loop_task_validation_rejects_invalid_kotler_tag(self):
        invalid_tasks = [
            {**task("awareness", "Write 3 Honest Lines"), "kotler_tag": "Discipline"},
            task("action", "Move 1 Visible Step"),
            task("reflection", "Name 1 Avoided Feeling"),
            task("reset", "Take 5 Slow Breaths"),
            task("growth", "Send 1 Useful Message"),
        ]

        with self.assertRaises(TaskValidationError) as raised:
            validate_ai_tasks(json.dumps({"tasks": invalid_tasks}))

        self.assertEqual(raised.exception.reason, "invalid_kotler_tag")

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
