import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from ai.growth_tree_intelligence import clear_season_cache
from ai.master_orchestrator import (
    DAILY_QUOTES,
    ORDERINGS,
    OrchestratorSecurityError,
    build_safe_default,
    clean_display_name,
    clear_dashboard_cache,
    get_dashboard_payload,
    resolve_display_name,
    todays_quote,
)


USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER = "22222222-2222-2222-2222-222222222222"


def days_ago(n: int) -> str:
    # Same UTC clock as the modules — local-clock seeds drift by a day
    # whenever local date leads UTC.
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


class RecordingQuery:
    def __init__(self, parent, table_name):
        self.parent = parent
        self.table_name = table_name
        self.filters = {}
        self.gt_filters = {}
        self.range_filters = {}
        self.order_column = None
        self.order_desc = False
        self.limit_value = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def gt(self, column, value):
        self.gt_filters[column] = value
        return self

    def gte(self, column, value):
        self.range_filters.setdefault(column, [None, None])[0] = value
        return self

    def lte(self, column, value):
        self.range_filters.setdefault(column, [None, None])[1] = value
        return self

    def order(self, column, desc=False, **kwargs):
        self.order_column = column
        self.order_desc = desc
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def execute(self):
        if self.table_name in self.parent.failing_tables:
            raise RuntimeError(f"forced failure on {self.table_name}")
        rows = self.parent.rows_by_table.get(self.table_name, [])
        for column, value in self.filters.items():
            rows = [r for r in rows if r.get(column) == value or column not in r]
        for column, value in self.gt_filters.items():
            rows = [r for r in rows if (r.get(column) or 0) > value]
        for column, (gte_value, lte_value) in self.range_filters.items():
            if gte_value is not None:
                rows = [r for r in rows if str(r.get(column, "")) >= str(gte_value)]
            if lte_value is not None:
                rows = [r for r in rows if str(r.get(column, "")) <= str(lte_value)]
        if self.order_column:
            rows = sorted(
                rows, key=lambda r: str(r.get(self.order_column, "")), reverse=self.order_desc
            )
        if self.limit_value is not None:
            rows = rows[: self.limit_value]
        return SimpleNamespace(data=rows, count=len(rows))


class FakeAuthAdmin:
    def __init__(self, metadata=None, email=""):
        self.metadata = metadata or {}
        self.email = email

    def get_user_by_id(self, user_id):
        return SimpleNamespace(
            user=SimpleNamespace(user_metadata=self.metadata, email=self.email)
        )


class FakeSupabase:
    def __init__(self, rows_by_table=None, failing_tables=None,
                 auth_metadata=None, auth_email=""):
        self.rows_by_table = rows_by_table or {}
        self.failing_tables = set(failing_tables or [])
        self.table_calls = []
        self.auth = SimpleNamespace(
            admin=FakeAuthAdmin(metadata=auth_metadata, email=auth_email)
        )

    def table(self, name):
        self.table_calls.append(name)
        return RecordingQuery(self, name)


def task_row(for_date, completed=False, skipped=False, category="awareness", user_id=USER_ID):
    return {
        "user_id": user_id,
        "for_date": for_date,
        "category": category,
        "completed_at": f"{for_date}T10:00:00+00:00" if completed else None,
        "skipped": skipped,
    }


def daily_log_row(for_date, points=10, tasks_done=1, user_id=USER_ID):
    return {"user_id": user_id, "for_date": for_date, "points": points, "tasks_done": tasks_done}


def context_row(for_date, escalation=False, energy=None, pattern=False,
                reveal_pending=False, user_id=USER_ID):
    return {
        "user_id": user_id,
        "date": for_date,
        "escalation_triggered": escalation,
        "energy_level": energy,
        "pattern_detected": pattern,
        "pattern_reveal_pending": reveal_pending,
    }


def profile_row(created_days_ago=30, user_id=USER_ID, **extra):
    return {
        "id": user_id,
        "created_at": f"{days_ago(created_days_ago)}T08:00:00+00:00",
        "struggle_tags": [],
        **extra,
    }


def normal_user_tables(**overrides):
    """A steady default-state user: 2 tasks today (1 done), decent week."""
    tables = {
        "companion_context": [context_row(days_ago(0), energy="medium")],
        "loop_tasks": [
            task_row(days_ago(0), completed=True),
            task_row(days_ago(0), completed=False, category="action"),
            task_row(days_ago(1), completed=True),
            task_row(days_ago(2), completed=True),
        ],
        "tree_daily_log": [daily_log_row(days_ago(n)) for n in range(3)],
        "user_tree": [{"user_id": USER_ID, "cumulative_score": 200, "vitality": 70, "streak": 3}],
        "reflections": [
            {"id": "r1", "user_id": USER_ID, "created_at": f"{days_ago(1)}T20:00:00+00:00"},
        ],
        "curator_interactions": [],
        "companion_messages": [],
        "profiles": [profile_row(created_days_ago=30)],
    }
    tables.update(overrides)
    return tables


def fresh_payload(supabase, user_id=USER_ID):
    clear_dashboard_cache()
    clear_season_cache()
    return get_dashboard_payload(supabase, user_id)


class DisplayNameTests(unittest.TestCase):
    def test_cleaning_strips_digits_and_capitalises(self):
        self.assertEqual(clean_display_name("1har4y09"), "Hary")
        self.assertEqual(clean_display_name("harpreet"), "Harpreet")
        self.assertEqual(clean_display_name("  harpreet singh "), "Harpreet singh")
        self.assertEqual(clean_display_name("12345"), "")
        self.assertEqual(clean_display_name(None), "")

    def test_metadata_full_name_wins(self):
        supabase = FakeSupabase(
            {"profiles": [profile_row()]},
            auth_metadata={"full_name": "harpreet", "username": "1har4y09"},
            auth_email="1har4y09@gmail.com",
        )
        self.assertEqual(resolve_display_name(supabase, USER_ID), "Harpreet")

    def test_email_prefix_cleaned_when_metadata_empty(self):
        supabase = FakeSupabase(
            {"profiles": [profile_row()]},
            auth_metadata={},
            auth_email="1har4y09@gmail.com",
        )
        self.assertEqual(resolve_display_name(supabase, USER_ID), "Hary")

    def test_profiles_name_column_used_if_it_ever_exists(self):
        supabase = FakeSupabase(
            {"profiles": [profile_row(display_name="harpreet")]},
            auth_metadata={},
            auth_email="x@y.com",
        )
        self.assertEqual(resolve_display_name(supabase, USER_ID), "Harpreet")

    def test_total_failure_falls_back_to_there(self):
        class Exploding:
            def table(self, name):
                raise RuntimeError("boom")

            class auth:
                class admin:
                    @staticmethod
                    def get_user_by_id(_):
                        raise RuntimeError("boom")

        self.assertEqual(resolve_display_name(Exploding(), USER_ID), "there")


class QuoteTests(unittest.TestCase):
    def test_deterministic_and_in_range(self):
        now = datetime(2026, 7, 12, tzinfo=timezone.utc)
        first = todays_quote(now)
        second = todays_quote(now)
        self.assertEqual(first, second)
        self.assertIn(first, DAILY_QUOTES)

    def test_rotates_across_days(self):
        quotes = {
            todays_quote(datetime(2026, 7, 6, tzinfo=timezone.utc) + timedelta(days=n))
            for n in range(7)
        }
        self.assertGreater(len(quotes), 1)

    def test_exactly_fourteen_quotes(self):
        self.assertEqual(len(DAILY_QUOTES), 14)


class GreetingTests(unittest.TestCase):
    def test_crisis_wins_over_everything(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), escalation=True, energy="high")],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(payload["greeting"], "You don't have to do much today.")

    def test_low_energy_line(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), energy="low")],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(payload["greeting"], "Take it easy today.")

    def test_pattern_line(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), energy="medium", pattern=True)],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(payload["greeting"], "Something worth looking at today.")

    def test_first_session_uses_welcome_prefix(self):
        supabase = FakeSupabase(normal_user_tables(
            profiles=[profile_row(created_days_ago=0)],
            companion_context=[],
            loop_tasks=[],
            tree_daily_log=[],
            reflections=[],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(payload["greeting"], "This is yours now.")
        self.assertEqual(payload["greeting_prefix"], "welcome")

    def test_default_line(self):
        supabase = FakeSupabase(normal_user_tables())
        payload = fresh_payload(supabase)
        self.assertEqual(payload["greeting"], "Take it one step at a time.")
        self.assertEqual(payload["greeting_prefix"], "time_of_day")


class OrderingTests(unittest.TestCase):
    def _features(self, payload):
        return [card["feature"] for card in payload["feature_cards"]]

    def test_crisis_ordering(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), escalation=True)],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(self._features(payload), ORDERINGS["crisis"])
        self.assertEqual(payload["primary_action"]["feature"], "companion")

    def test_low_energy_ordering(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), energy="low")],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(self._features(payload), ORDERINGS["low_energy"])
        self.assertEqual(payload["primary_action"]["feature"], "reset")

    def test_pattern_done_ordering(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), energy="medium", reveal_pending=True)],
            loop_tasks=[
                task_row(days_ago(0), completed=True),
                task_row(days_ago(0), completed=True, category="action"),
            ],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(self._features(payload), ORDERINGS["pattern_done"])
        self.assertEqual(payload["primary_action"]["feature"], "tree")

    def test_momentum_ordering(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), energy="high")],
            loop_tasks=[
                task_row(days_ago(0), completed=True),
                task_row(days_ago(1), completed=True),
                task_row(days_ago(2), completed=True),
                task_row(days_ago(3), completed=True),
                task_row(days_ago(4), completed=True),
            ],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(self._features(payload), ORDERINGS["momentum"])

    def test_returning_ordering(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[],
            loop_tasks=[
                task_row(days_ago(6), completed=True),
                task_row(days_ago(0), completed=True),
            ],
            tree_daily_log=[daily_log_row(days_ago(6)), daily_log_row(days_ago(0))],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(self._features(payload), ORDERINGS["returning"])
        self.assertEqual(payload["primary_action"]["feature"], "companion")

    def test_default_ordering(self):
        supabase = FakeSupabase(normal_user_tables())
        payload = fresh_payload(supabase)
        self.assertEqual(self._features(payload), ORDERINGS["default"])
        self.assertEqual(payload["primary_action"]["feature"], "loop")

    def test_priorities_are_one_through_six(self):
        supabase = FakeSupabase(normal_user_tables())
        payload = fresh_payload(supabase)
        self.assertEqual([c["priority"] for c in payload["feature_cards"]], [1, 2, 3, 4, 5, 6])


class HeadlineTests(unittest.TestCase):
    def test_loop_states(self):
        pending = FakeSupabase(normal_user_tables())
        self.assertEqual(
            fresh_payload(pending)["primary_action"]["headline"],
            "Your task for today is ready.",
        )

        all_done = FakeSupabase(normal_user_tables(
            loop_tasks=[
                task_row(days_ago(0), completed=True),
                task_row(days_ago(0), completed=True, category="action"),
            ],
        ))
        payload = fresh_payload(all_done)
        loop_card = next(c for c in payload["feature_cards"] if c["feature"] == "loop")
        self.assertEqual(loop_card["headline"], "Done. The tree grew today.")
        self.assertTrue(payload["tasks_today"]["all_done"])

        all_skipped = FakeSupabase(normal_user_tables(
            loop_tasks=[
                task_row(days_ago(0), skipped=True),
                task_row(days_ago(0), skipped=True, category="action"),
            ],
        ))
        loop_card = next(
            c for c in fresh_payload(all_skipped)["feature_cards"] if c["feature"] == "loop"
        )
        self.assertEqual(loop_card["headline"], "Still here when you're ready.")

        no_tasks = FakeSupabase(normal_user_tables(loop_tasks=[]))
        loop_card = next(
            c for c in fresh_payload(no_tasks)["feature_cards"] if c["feature"] == "loop"
        )
        self.assertEqual(loop_card["headline"], "Ready when you are.")

    def test_companion_session_today(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_messages=[
                {"user_id": USER_ID, "created_at": f"{days_ago(0)}T09:00:00+00:00"},
            ],
        ))
        card = next(
            c for c in fresh_payload(supabase)["feature_cards"] if c["feature"] == "companion"
        )
        self.assertEqual(card["headline"], "Your companion heard you today.")

    def test_reflection_states(self):
        entry_today = FakeSupabase(normal_user_tables(
            reflections=[{"id": "r", "user_id": USER_ID,
                          "created_at": f"{days_ago(0)}T09:00:00+00:00"}],
        ))
        card = next(
            c for c in fresh_payload(entry_today)["feature_cards"] if c["feature"] == "reflection"
        )
        self.assertEqual(card["headline"], "You wrote today. That counts.")

        stale = FakeSupabase(normal_user_tables(
            reflections=[{"id": "r", "user_id": USER_ID,
                          "created_at": f"{days_ago(5)}T09:00:00+00:00"}],
        ))
        card = next(
            c for c in fresh_payload(stale)["feature_cards"] if c["feature"] == "reflection"
        )
        self.assertEqual(card["headline"], "The journal is still here.")

    def test_curator_card_carries_recent_book_id(self):
        supabase = FakeSupabase(normal_user_tables(
            curator_interactions=[
                {"user_id": USER_ID, "book_id": "atomic-habits",
                 "action_type": "book_saved",
                 "created_at": f"{days_ago(2)}T09:00:00+00:00"},
            ],
        ))
        card = next(
            c for c in fresh_payload(supabase)["feature_cards"] if c["feature"] == "curator"
        )
        self.assertEqual(card.get("book_id"), "atomic-habits")

    def test_curator_old_book_not_carried(self):
        supabase = FakeSupabase(normal_user_tables(
            curator_interactions=[
                {"user_id": USER_ID, "book_id": "atomic-habits",
                 "action_type": "book_saved",
                 "created_at": f"{days_ago(30)}T09:00:00+00:00"},
            ],
        ))
        card = next(
            c for c in fresh_payload(supabase)["feature_cards"] if c["feature"] == "curator"
        )
        self.assertNotIn("book_id", card)


class FounderNoteTests(unittest.TestCase):
    def test_first_session_shows(self):
        supabase = FakeSupabase(normal_user_tables(profiles=[profile_row(created_days_ago=0)]))
        self.assertTrue(fresh_payload(supabase)["show_founder_note"])

    def test_seventh_day_shows(self):
        supabase = FakeSupabase(normal_user_tables(profiles=[profile_row(created_days_ago=14)]))
        self.assertTrue(fresh_payload(supabase)["show_founder_note"])

    def test_ordinary_day_hides(self):
        supabase = FakeSupabase(normal_user_tables(profiles=[profile_row(created_days_ago=13)]))
        self.assertFalse(fresh_payload(supabase)["show_founder_note"])


class CacheAndSafetyTests(unittest.TestCase):
    def test_second_call_served_from_cache(self):
        supabase = FakeSupabase(normal_user_tables())
        fresh_payload(supabase)
        calls_after_first = len(supabase.table_calls)
        get_dashboard_payload(supabase, USER_ID)
        # Only the fresh crisis check hits the DB on a cache hit.
        self.assertEqual(len(supabase.table_calls), calls_after_first + 1)

    def test_crisis_bypasses_cache(self):
        supabase = FakeSupabase(normal_user_tables())
        payload = fresh_payload(supabase)
        self.assertEqual(payload["primary_action"]["feature"], "loop")

        supabase.rows_by_table["companion_context"] = [
            context_row(days_ago(0), escalation=True)
        ]
        clear_season_cache()  # season cache is its own module; dashboard cache stays
        crisis_payload = get_dashboard_payload(supabase, USER_ID)
        self.assertEqual(crisis_payload["primary_action"]["feature"], "companion")

    def test_total_failure_returns_safe_default(self):
        class Exploding:
            def table(self, name):
                raise RuntimeError("boom")

            auth = SimpleNamespace(admin=FakeAuthAdmin())

        clear_dashboard_cache()
        clear_season_cache()
        payload = get_dashboard_payload(Exploding(), USER_ID)
        self.assertEqual(payload["user_display_name"], "there")
        self.assertEqual(payload["greeting"], "Take it one step at a time.")
        self.assertEqual(payload["season"]["season"], "thriving")
        self.assertEqual(len(payload["feature_cards"]), 6)

    def test_safe_default_shape_matches_spec(self):
        payload = build_safe_default()
        self.assertEqual(payload["daily_quote"], "One step is not nothing. It is the thing.")
        self.assertEqual(payload["primary_action"]["cta_route"], "/loop")
        self.assertFalse(payload["show_founder_note"])
        self.assertEqual(payload["tasks_today"], {"total": 0, "completed": 0, "all_done": False})

    def test_user_isolation(self):
        supabase = FakeSupabase(normal_user_tables(
            companion_context=[context_row(days_ago(0), escalation=True, user_id=OTHER_USER)],
        ))
        payload = fresh_payload(supabase)
        self.assertEqual(payload["primary_action"]["feature"], "loop")  # not crisis

    def test_missing_user_id_raises(self):
        with self.assertRaises(OrchestratorSecurityError):
            get_dashboard_payload(FakeSupabase(), "")


class DashboardEndpointTests(unittest.TestCase):
    def test_endpoint_returns_payload_for_token_user(self):
        import main

        fake = FakeSupabase(normal_user_tables())
        clear_dashboard_cache()
        clear_season_cache()
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.get_dashboard(authorization="Bearer t"))

        self.assertEqual(response["primary_action"]["feature"], "loop")
        self.assertIn("greeting", response)

    def test_endpoint_never_errors(self):
        import main

        class Exploding:
            def table(self, name):
                raise RuntimeError("boom")

            auth = SimpleNamespace(admin=FakeAuthAdmin())

        clear_dashboard_cache()
        clear_season_cache()
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", Exploding()),
        ):
            response = asyncio.run(main.get_dashboard(authorization="Bearer t"))

        self.assertEqual(response["user_display_name"], "there")


if __name__ == "__main__":
    unittest.main()
