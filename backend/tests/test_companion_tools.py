import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from ai.companion_security import CompanionSecurityError
from ai.companion_tools import (
    escalation_trigger,
    journal_search,
    pattern_check,
    task_history,
)


USER_ID = "11111111-1111-1111-1111-111111111111"


def days_ago(n: int) -> str:
    # The tools compute "today" in UTC; seeds must use the same clock or
    # date-boundary tests drift by a day whenever local date leads UTC.
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


def reflection_row(row_id: str, for_date: str, content: str, mood: str | None = None) -> dict:
    return {
        "id": row_id,
        "for_date": for_date,
        "created_at": f"{for_date}T20:00:00+00:00",
        "mood": mood,
        "content": content,
        "questions": [],
        "pattern_tags": [],
    }


class FakeQuery:
    """Recorder fake mirroring the supabase-py fluent interface. Records every
    filter so tests can assert user scoping happened at the query level."""

    def __init__(self, parent, table_name):
        self.parent = parent
        self.table_name = table_name
        self.filters = []

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value):
        self.filters.append(("eq", column, value))
        return self

    def gte(self, column, value):
        self.filters.append(("gte", column, value))
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args):
        return self

    def insert(self, payload):
        self.parent.inserts.append((self.table_name, payload))
        return self

    def execute(self):
        if self.parent.raise_on_table == self.table_name:
            raise RuntimeError(f"{self.table_name} unavailable")
        self.parent.queries.append(self)
        return SimpleNamespace(data=self.parent.rows_by_table.get(self.table_name, []), count=0)


class FakeSupabase:
    def __init__(self, rows_by_table=None, raise_on_table=None):
        self.rows_by_table = rows_by_table or {}
        self.raise_on_table = raise_on_table
        self.queries = []
        self.inserts = []

    def table(self, name):
        return FakeQuery(self, name)

    def user_scoped(self, table_name):
        return any(
            ("eq", "user_id", USER_ID) in q.filters
            for q in self.queries
            if q.table_name == table_name
        )


class JournalSearchTests(unittest.TestCase):
    def make_supabase(self):
        return FakeSupabase({
            "reflections": [
                reflection_row("r1", days_ago(1), "I feel stuck again, my project is going nowhere and I keep spinning."),
                reflection_row("r2", days_ago(5), "Good walk today, felt lighter and hopeful about things."),
                reflection_row("r3", days_ago(9), "Stuck on the same project problem, no progress at all this week.", mood="stuck"),
            ]
        })

    def test_returns_ranked_signals_not_raw_text(self):
        supabase = self.make_supabase()
        results = journal_search("stuck project no progress", USER_ID, top_k=2, supabase=supabase)

        self.assertEqual(len(results), 2)
        self.assertGreaterEqual(results[0]["similarity_score"], results[1]["similarity_score"])
        for result in results:
            self.assertEqual(
                set(result.keys()), {"date", "emotion_signal", "key_theme", "similarity_score"}
            )
            combined = " ".join(str(v) for v in result.values()).lower()
            self.assertNotIn("going nowhere and i keep spinning", combined)

    def test_query_is_scoped_to_user_id(self):
        supabase = self.make_supabase()
        journal_search("stuck", USER_ID, supabase=supabase)

        self.assertTrue(supabase.user_scoped("reflections"))

    def test_empty_history_returns_empty_list(self):
        results = journal_search("stuck", USER_ID, supabase=FakeSupabase({"reflections": []}))
        self.assertEqual(results, [])

    def test_missing_user_id_raises(self):
        with self.assertRaises(CompanionSecurityError):
            journal_search("stuck", "", supabase=self.make_supabase())

    def test_emotion_signal_prefers_mood_label_over_lexicon(self):
        supabase = FakeSupabase({
            "reflections": [
                reflection_row("r1", days_ago(1), "the project is stuck", mood="heavy"),
            ]
        })
        results = journal_search("project stuck", USER_ID, supabase=supabase)
        self.assertEqual(results[0]["emotion_signal"], "heavy")


class TaskHistoryTests(unittest.TestCase):
    def task_row(self, for_date, category, done=False, skipped=False):
        return {
            "title": f"Task on {for_date}", "category": category, "done": done,
            "skipped": skipped, "for_date": for_date, "completion_state": None,
        }

    def test_signals_computed_from_rows(self):
        rows = [
            self.task_row(days_ago(0), "action", done=True),
            self.task_row(days_ago(1), "awareness", done=True),
            self.task_row(days_ago(2), "reflection", skipped=True),
            self.task_row(days_ago(3), "reflection", skipped=True),
        ]
        with patch("ai.companion_tools._fetch_recent_tasks", return_value=rows):
            result = task_history(USER_ID, supabase=FakeSupabase())

        self.assertEqual(result["completion_rate"], 0.5)
        self.assertEqual(result["most_skipped_category"], "reflection")
        self.assertEqual(result["streak"], 2)
        self.assertEqual(result["last_completed_category"], "action")
        self.assertIn("reflection", result["pattern_signal"])

    def test_no_verbatim_task_titles_in_output(self):
        rows = [self.task_row(days_ago(0), "action", done=True)]
        with patch("ai.companion_tools._fetch_recent_tasks", return_value=rows):
            result = task_history(USER_ID, supabase=FakeSupabase())

        self.assertNotIn("Task on", str(result))

    def test_empty_history_is_honest(self):
        with patch("ai.companion_tools._fetch_recent_tasks", return_value=[]):
            result = task_history(USER_ID, supabase=FakeSupabase())

        self.assertEqual(result["completion_rate"], 0.0)
        self.assertEqual(result["pattern_signal"], "no recent task history")

    def test_missing_user_id_raises(self):
        with self.assertRaises(CompanionSecurityError):
            task_history(None, supabase=FakeSupabase())


class PatternCheckTests(unittest.TestCase):
    def test_two_plus_matches_build_specific_description(self):
        supabase = FakeSupabase({
            "reflections": [
                reflection_row("r1", days_ago(2), "I feel stuck again, no progress on anything, just spinning in the same place."),
                reflection_row("r2", days_ago(9), "Everything is stuck, the project is going nowhere and I am not moving."),
                reflection_row("r3", days_ago(4), "Lovely dinner with family, felt grateful."),
            ]
        })
        result = pattern_check(USER_ID, "stuck", supabase=supabase)

        self.assertGreaterEqual(result["frequency"], 2)
        self.assertEqual(result["recency_days"], 2)
        self.assertIn("stuck", result["pattern_description"])
        self.assertIn(str(result["frequency"]), result["pattern_description"])

    def test_single_match_returns_no_description(self):
        supabase = FakeSupabase({
            "reflections": [
                reflection_row("r1", days_ago(2), "I feel stuck, no progress, spinning in the same place going nowhere."),
                reflection_row("r2", days_ago(9), "Great day at the beach with friends."),
            ]
        })
        result = pattern_check(USER_ID, "stuck", supabase=supabase)

        self.assertEqual(result["frequency"], 1)
        self.assertIsNone(result["pattern_description"])

    def test_no_history_returns_frequency_zero(self):
        result = pattern_check(USER_ID, "stuck", supabase=FakeSupabase({"reflections": []}))

        self.assertEqual(result["frequency"], 0)
        self.assertIsNone(result["pattern_description"])

    def test_mood_label_match_counts_even_with_thin_text(self):
        supabase = FakeSupabase({
            "reflections": [
                reflection_row("r1", days_ago(1), "short note", mood="stuck"),
                reflection_row("r2", days_ago(6), "another short one", mood="stuck"),
            ]
        })
        result = pattern_check(USER_ID, "stuck", supabase=supabase)

        self.assertEqual(result["frequency"], 2)
        self.assertIsNotNone(result["pattern_description"])

    def test_missing_user_id_raises(self):
        with self.assertRaises(CompanionSecurityError):
            pattern_check("  ", "stuck", supabase=FakeSupabase())


class EscalationTriggerTests(unittest.TestCase):
    def test_crisis_writes_audit_row_and_serves_resources(self):
        supabase = FakeSupabase()
        message = "I want to give up on everything, nothing matters anymore and I am done."

        result = escalation_trigger(USER_ID, "crisis", message, supabase=supabase)

        self.assertTrue(result["logged"])
        self.assertEqual(len(supabase.inserts), 1)
        table, payload = supabase.inserts[0]
        self.assertEqual(table, "escalation_log")
        self.assertEqual(payload["user_id"], USER_ID)
        self.assertEqual(payload["signal_type"], "crisis")
        self.assertLessEqual(len(payload["message_snippet"]), 50)

        response = result["response"]
        self.assertEqual(response["safety"]["risk_level"], "crisis")
        self.assertEqual(response["suggested_action"]["type"], "none")
        combined = str(response["sections"])
        self.assertIn("9152987821", combined)
        self.assertIn("112", combined)

    def test_persistent_distress_serves_warmth_with_resources(self):
        result = escalation_trigger(USER_ID, "persistent_distress", "so heavy lately", supabase=FakeSupabase())

        response = result["response"]
        self.assertEqual(response["tone"], "serious")
        self.assertEqual(response["suggested_action"]["type"], "none")
        self.assertIn("9152987821", str(response["sections"]))

    def test_audit_write_failure_still_serves_response(self):
        supabase = FakeSupabase(raise_on_table="escalation_log")

        result = escalation_trigger(USER_ID, "crisis", "please help me", supabase=supabase)

        self.assertFalse(result["logged"])
        self.assertEqual(result["response"]["safety"]["risk_level"], "crisis")

    def test_unknown_signal_type_escalates_to_crisis_not_down(self):
        result = escalation_trigger(USER_ID, "made_up_type", "text", supabase=FakeSupabase())

        self.assertEqual(result["signal_type"], "crisis")

    def test_missing_user_id_raises(self):
        with self.assertRaises(CompanionSecurityError):
            escalation_trigger("", "crisis", "text", supabase=FakeSupabase())


if __name__ == "__main__":
    unittest.main()
