import asyncio
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

import main


TOKEN_USER_ID = "11111111-1111-1111-1111-111111111111"


def run_async(coro):
    return asyncio.run(coro)


class _InsertResponse:
    def __init__(self, data):
        self.data = data


class _InsertQuery:
    def __init__(self, recorder, payload):
        self.recorder = recorder
        self.payload = payload

    def execute(self):
        self.recorder.inserted_payloads.append(self.payload)
        return _InsertResponse([{**self.payload, "id": "reset-row-id"}])


class _ResetSessionTableRecorder:
    def __init__(self):
        self.inserted_payloads = []

    def table(self, table_name):
        if table_name != "reset_sessions":
            raise AssertionError(f"Unexpected table: {table_name}")
        return self

    def insert(self, payload):
        return _InsertQuery(self, payload)


class Phase6FResetSessionTests(unittest.TestCase):
    def test_calmer_noise_saves_only_safe_reset_metadata(self):
        recorder = _ResetSessionTableRecorder()
        request = main.ResetSessionMetadataRequest(
            user_id=TOKEN_USER_ID,
            session_id="legacy-id-not-stored",
            session_title="3-minute Calm Reset",
            session_type="guided",
            session_category="Calm",
            reset_need="calm",
            duration_seconds=137,
            mood_after_reset="calmer",
            reset_reflection_tag="noise",
        )

        with patch.object(main, "validate_supabase_access_token", return_value=TOKEN_USER_ID), \
                patch.object(main, "supabase", recorder):
            result = run_async(main.save_reset_session_metadata(
                request,
                authorization="Bearer test-token",
            ))

        self.assertEqual(result["next_step_type"], "loop")
        self.assertEqual(len(recorder.inserted_payloads), 1)
        payload = recorder.inserted_payloads[0]
        self.assertEqual(payload, {
            "user_id": TOKEN_USER_ID,
            "session_title": "3-minute Calm Reset",
            "session_type": "guided",
            "duration_seconds": 137,
            "mood_after": "calmer",
            "reflection_tag": "noise",
            "next_step_type": "loop",
        })
        self.assertNotIn("completed_at", payload)
        self.assertNotIn("session_id", payload)
        self.assertNotIn("session_category", payload)
        self.assertNotIn("reset_need", payload)

    def test_invalid_reset_mood_is_rejected(self):
        request = main.ResetSessionMetadataRequest(
            user_id=TOKEN_USER_ID,
            session_title="Soft Piano",
            session_type="sound",
            duration_seconds=42,
            mood_after_reset="raw emotional sentence",
            reset_reflection_tag="noise",
        )

        with patch.object(main, "validate_supabase_access_token", return_value=TOKEN_USER_ID):
            with self.assertRaises(HTTPException) as raised:
                run_async(main.save_reset_session_metadata(
                    request,
                    authorization="Bearer test-token",
                ))

        self.assertEqual(raised.exception.status_code, 400)

    def test_invalid_reset_reflection_tag_is_rejected(self):
        request = main.ResetSessionMetadataRequest(
            user_id=TOKEN_USER_ID,
            session_title="Soft Piano",
            session_type="sound",
            duration_seconds=42,
            mood_after_reset="calmer",
            reset_reflection_tag="private journal text",
        )

        with patch.object(main, "validate_supabase_access_token", return_value=TOKEN_USER_ID):
            with self.assertRaises(HTTPException) as raised:
                run_async(main.save_reset_session_metadata(
                    request,
                    authorization="Bearer test-token",
                ))

        self.assertEqual(raised.exception.status_code, 400)

    def test_missing_token_returns_401(self):
        request = main.ResetSessionMetadataRequest(
            user_id=TOKEN_USER_ID,
            session_title="Soft Piano",
            session_type="sound",
            duration_seconds=42,
            mood_after_reset="calmer",
            reset_reflection_tag="noise",
        )

        with self.assertRaises(HTTPException) as raised:
            run_async(main.save_reset_session_metadata(request, authorization=None))

        self.assertEqual(raised.exception.status_code, 401)

    def test_phase6f_next_step_mapping(self):
        self.assertEqual(main.compute_reset_next_step_type("clearer", "noise"), "loop")
        self.assertEqual(main.compute_reset_next_step_type("still_heavy", "pressure"), "reset")
        self.assertEqual(main.compute_reset_next_step_type("restless", "overthinking"), "reset")
        self.assertEqual(main.compute_reset_next_step_type("sleepy", "nothing_clear"), "rest")
        self.assertEqual(main.compute_reset_next_step_type("grateful", "noise"), "reflection")

    def test_phase6f_migration_is_narrow(self):
        repo_root = Path(__file__).resolve().parents[2]
        migration = (repo_root / "supabase/migrations/035_phase_6f_reset_signal_completion.sql").read_text()

        self.assertIn("ADD COLUMN IF NOT EXISTS session_title TEXT", migration)
        self.assertIn("ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ", migration)
        self.assertIn("ALTER COLUMN completed_at SET DEFAULT now()", migration)
        self.assertIn("'reflection'", migration)
        self.assertIn("idx_reset_sessions_user_completed_at", migration)
        self.assertNotIn("CREATE TABLE", migration)


if __name__ == "__main__":
    unittest.main()
