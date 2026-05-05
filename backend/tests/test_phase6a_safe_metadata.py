import asyncio
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

import main
from ai.context import summarize_task_history
from ai.fallbacks import generate_life_companion_fallback


TOKEN_USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
TASK_ID = "33333333-3333-3333-3333-333333333333"


def run_async(coro):
    return asyncio.run(coro)


class Phase6ASafeMetadataTests(unittest.TestCase):
    def test_loop_feedback_rejects_user_mismatch_before_write(self):
        request = main.LoopTaskFeedbackRequest(
            user_id=OTHER_USER_ID,
            completion_state="done",
            mood_after="clear",
            task_friction_level="right_sized",
        )

        with patch.object(main, "validate_supabase_access_token", return_value=TOKEN_USER_ID):
            with self.assertRaises(HTTPException) as raised:
                run_async(main.save_loop_task_feedback(
                    TASK_ID,
                    request,
                    authorization="Bearer test-token",
                ))

        self.assertEqual(raised.exception.status_code, 403)

    def test_reset_metadata_rejects_user_mismatch_before_insert(self):
        request = main.ResetSessionMetadataRequest(
            user_id=OTHER_USER_ID,
            mood_after="clearer",
            reflection_tag="less_noise",
        )

        with patch.object(main, "validate_supabase_access_token", return_value=TOKEN_USER_ID):
            with self.assertRaises(HTTPException) as raised:
                run_async(main.save_reset_session_metadata(
                    request,
                    authorization="Bearer test-token",
                ))

        self.assertEqual(raised.exception.status_code, 403)

    def test_curator_metadata_rejects_user_mismatch_before_insert(self):
        request = main.CuratorInteractionRequest(
            user_id=OTHER_USER_ID,
            action_type="book_opened",
            book_id="atomic-habits",
            path_slug="discipline",
        )

        with patch.object(main, "validate_supabase_access_token", return_value=TOKEN_USER_ID):
            with self.assertRaises(HTTPException) as raised:
                run_async(main.save_curator_interaction(
                    request,
                    authorization="Bearer test-token",
                ))

        self.assertEqual(raised.exception.status_code, 403)

    def test_safe_metadata_migration_has_rls_for_new_tables(self):
        repo_root = Path(__file__).resolve().parents[2]
        migration = (repo_root / "supabase/migrations/031_phase_6a_safe_metadata.sql").read_text()

        self.assertIn("ALTER TABLE public.reset_sessions ENABLE ROW LEVEL SECURITY", migration)
        self.assertIn("reset_sessions_select_own", migration)
        self.assertIn("reset_sessions_insert_own", migration)
        self.assertIn("ALTER TABLE public.curator_interactions ENABLE ROW LEVEL SECURITY", migration)
        self.assertIn("curator_interactions_select_own", migration)
        self.assertIn("curator_interactions_insert_own", migration)

    def test_task_feedback_summary_simplifies_when_too_heavy(self):
        summary = summarize_task_history([
            {
                "category": "action",
                "completed_at": "2026-05-05T05:00:00Z",
                "duration_minutes": 20,
                "task_friction_level": "too_heavy",
                "mood_after": "heavy",
            },
        ])

        feedback = summary["task_feedback_summary"]
        self.assertEqual(feedback["adaptation_mode"], "simplify")
        self.assertEqual(feedback["duration_multiplier"], 0.5)

    def test_task_feedback_summary_stretches_only_slightly(self):
        rows = []
        for index in range(3):
            rows.append({
                "title": f"Task {index}",
                "category": "action",
                "completed_at": "2026-05-05T05:00:00Z",
                "duration_minutes": 10,
                "task_friction_level": "too_easy",
                "mood_after": "clear",
            })

        summary = summarize_task_history(rows)
        feedback = summary["task_feedback_summary"]
        self.assertEqual(feedback["adaptation_mode"], "stretch_slightly")
        self.assertLessEqual(feedback["duration_multiplier"], 1.15)

    def test_companion_fallback_keeps_study_routine_execution_first(self):
        response = generate_life_companion_fallback(
            "understand_me",
            {},
            user_message="create a study routine for me",
        )

        self.assertIn("study routine", response["reply"].lower())
        self.assertEqual(response["suggested_action"]["type"], "loop")
        self.assertFalse(response["reply"].strip().endswith("?"))


if __name__ == "__main__":
    unittest.main()
