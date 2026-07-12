import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from ai.growth_tree_intelligence import (
    GrowthTreeSecurityError,
    STAGES,
    build_journey,
    check_milestone_crossed,
    clear_season_cache,
    compute_season,
    get_score_payload,
    get_season_payload,
    stage_for_score,
)


USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER = "22222222-2222-2222-2222-222222222222"


def days_ago(n: int) -> str:
    # The module computes "today" in UTC; seed dates must use the same
    # clock or every boundary test drifts by one day on non-UTC hosts.
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


class RecordingQuery:
    """Applies .eq/.gte/.lte/.gt filters and .order/.limit for real — not
    just recorded — so tests genuinely exercise the query logic."""

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


class FakeSupabase:
    def __init__(self, rows_by_table=None, failing_tables=None):
        self.rows_by_table = rows_by_table or {}
        self.failing_tables = set(failing_tables or [])
        self.table_calls = []

    def table(self, name):
        self.table_calls.append(name)
        return RecordingQuery(self, name)


def task_row(for_date, completed, user_id=USER_ID):
    return {
        "user_id": user_id,
        "for_date": for_date,
        "completed_at": f"{for_date}T10:00:00+00:00" if completed else None,
        "category": "awareness",
    }


def daily_log_row(for_date, points=10, tasks_done=1, user_id=USER_ID):
    return {
        "user_id": user_id,
        "for_date": for_date,
        "points": points,
        "tasks_done": tasks_done,
    }


def context_row(for_date, escalation=False, energy=None, user_id=USER_ID):
    return {
        "user_id": user_id,
        "date": for_date,
        "escalation_triggered": escalation,
        "energy_level": energy,
    }


def tree_row(score, vitality=70, streak=3, user_id=USER_ID):
    return {
        "user_id": user_id,
        "cumulative_score": score,
        "vitality": vitality,
        "streak": streak,
    }


def thriving_week(user_id=USER_ID):
    """6 of 7 recent tasks completed, active yesterday and today."""
    tasks = [task_row(days_ago(n), completed=True, user_id=user_id) for n in range(6)]
    tasks.append(task_row(days_ago(6), completed=False, user_id=user_id))
    logs = [daily_log_row(days_ago(n), user_id=user_id) for n in range(6)]
    return tasks, logs


class SeasonPriorityTests(unittest.TestCase):
    def setUp(self):
        clear_season_cache()

    def test_crisis_today_wins_over_everything(self):
        tasks, logs = thriving_week()
        supabase = FakeSupabase({
            "companion_context": [context_row(days_ago(0), escalation=True)],
            "loop_tasks": tasks,
            "tree_daily_log": logs,
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "sheltering")
        self.assertEqual(result["visual_hint"], "storm")
        self.assertTrue(result["crisis_active"])
        self.assertIn("storm", result["message"])

    def test_crisis_two_days_ago_still_shelters(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(days_ago(2), escalation=True)],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "sheltering")

    def test_crisis_three_days_ago_expired(self):
        tasks, logs = thriving_week()
        supabase = FakeSupabase({
            "companion_context": [context_row(days_ago(3), escalation=True)],
            "loop_tasks": tasks,
            "tree_daily_log": logs,
        })

        result = compute_season(supabase, USER_ID)

        self.assertNotEqual(result["season"], "sheltering")
        self.assertFalse(result["crisis_active"])

    def test_returning_after_five_days_away(self):
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [
                task_row(days_ago(5), completed=True),
                task_row(days_ago(0), completed=True),
            ],
            "tree_daily_log": [
                daily_log_row(days_ago(5)),
                daily_log_row(days_ago(0)),
            ],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "returning")
        self.assertEqual(result["visual_hint"], "dawn")
        self.assertEqual(result["days_absent"], 5)

    def test_resting_after_five_days_away_nothing_today(self):
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [task_row(days_ago(5), completed=True)],
            "tree_daily_log": [daily_log_row(days_ago(5))],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "resting")
        self.assertEqual(result["visual_hint"], "winter")
        self.assertEqual(result["days_absent"], 5)

    def test_exactly_four_days_is_the_absence_boundary(self):
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [task_row(days_ago(4), completed=True)],
            "tree_daily_log": [daily_log_row(days_ago(4))],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "resting")

    def test_weathering_on_low_completion_rate(self):
        # 1 of 5 completed in the window, but active yesterday (absence 1).
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [
                task_row(days_ago(1), completed=True),
                task_row(days_ago(1), completed=False),
                task_row(days_ago(2), completed=False),
                task_row(days_ago(3), completed=False),
                task_row(days_ago(4), completed=False),
            ],
            "tree_daily_log": [daily_log_row(days_ago(1))],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "weathering")
        self.assertEqual(result["visual_hint"], "rain")
        self.assertLess(result["completion_rate"], 0.40)

    def test_weathering_on_low_energy_despite_good_rate(self):
        tasks, logs = thriving_week()
        supabase = FakeSupabase({
            "companion_context": [context_row(days_ago(0), energy="low")],
            "loop_tasks": tasks,
            "tree_daily_log": logs,
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "weathering")
        self.assertEqual(result["energy_level"], "low")

    def test_weathering_on_two_day_absence(self):
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [
                task_row(days_ago(2), completed=True),
                task_row(days_ago(3), completed=True),
            ],
            "tree_daily_log": [
                daily_log_row(days_ago(2)),
                daily_log_row(days_ago(3)),
            ],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "weathering")
        self.assertEqual(result["days_absent"], 2)

    def test_thriving_default(self):
        tasks, logs = thriving_week()
        supabase = FakeSupabase({
            "companion_context": [context_row(days_ago(0), energy="high")],
            "loop_tasks": tasks,
            "tree_daily_log": logs,
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "thriving")
        self.assertEqual(result["visual_hint"], "morning")
        self.assertLessEqual(result["days_absent"], 1)

    def test_brand_new_user_is_thriving_not_resting(self):
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [],
            "tree_daily_log": [],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "thriving")
        self.assertEqual(result["days_absent"], 0)
        self.assertIsNone(result["completion_rate"])

    def test_first_ever_completion_today_is_not_returning(self):
        supabase = FakeSupabase({
            "companion_context": [],
            "loop_tasks": [task_row(days_ago(0), completed=True)],
            "tree_daily_log": [daily_log_row(days_ago(0))],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "thriving")

    def test_fetch_failure_fails_safe_to_thriving(self):
        supabase = FakeSupabase(
            {"companion_context": []},
            failing_tables={"loop_tasks"},
        )

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "thriving")
        self.assertFalse(result["crisis_active"])

    def test_crisis_check_failure_does_not_false_alarm(self):
        tasks, logs = thriving_week()
        supabase = FakeSupabase(
            {"loop_tasks": tasks, "tree_daily_log": logs},
            failing_tables={"companion_context"},
        )

        result = compute_season(supabase, USER_ID)

        self.assertNotEqual(result["season"], "sheltering")

    def test_user_isolation_other_users_rows_invisible(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(days_ago(0), escalation=True, user_id=OTHER_USER)],
            "loop_tasks": [task_row(days_ago(5), completed=True, user_id=OTHER_USER)],
            "tree_daily_log": [daily_log_row(days_ago(5), user_id=OTHER_USER)],
        })

        result = compute_season(supabase, USER_ID)

        self.assertEqual(result["season"], "thriving")
        self.assertFalse(result["crisis_active"])

    def test_missing_user_id_raises(self):
        with self.assertRaises(GrowthTreeSecurityError):
            compute_season(FakeSupabase(), "")


class StageConfigTests(unittest.TestCase):
    def test_stage_boundaries_match_frontend_config(self):
        self.assertEqual(stage_for_score(0)["name"], "Seed")
        self.assertEqual(stage_for_score(30)["name"], "Seed")
        self.assertEqual(stage_for_score(31)["name"], "Sprout")
        self.assertEqual(stage_for_score(80)["name"], "Sprout")
        self.assertEqual(stage_for_score(81)["name"], "Young Plant")
        self.assertEqual(stage_for_score(180)["name"], "Young Plant")
        self.assertEqual(stage_for_score(181)["name"], "Small Tree")
        self.assertEqual(stage_for_score(350)["name"], "Small Tree")
        self.assertEqual(stage_for_score(351)["name"], "Growing Tree")
        self.assertEqual(stage_for_score(600)["name"], "Growing Tree")
        self.assertEqual(stage_for_score(601)["name"], "Mature Tree")
        self.assertEqual(stage_for_score(99999)["name"], "Mature Tree")

    def test_malformed_scores_land_in_seed(self):
        self.assertEqual(stage_for_score(None)["name"], "Seed")
        self.assertEqual(stage_for_score("junk")["name"], "Seed")
        self.assertEqual(stage_for_score(-50)["name"], "Seed")

    def test_six_stages_exactly(self):
        self.assertEqual(len(STAGES), 6)


class MilestoneTests(unittest.TestCase):
    def setUp(self):
        clear_season_cache()

    def test_crossing_detected(self):
        # Yesterday 78 (Sprout), today +10 → 88 (Young Plant).
        supabase = FakeSupabase({
            "user_tree": [tree_row(88)],
            "tree_daily_log": [daily_log_row(days_ago(0), points=10)],
        })

        result = check_milestone_crossed(supabase, USER_ID)

        self.assertIsNotNone(result)
        self.assertTrue(result["crossed"])
        self.assertEqual(result["stage_name"], "Young Plant")
        self.assertEqual(result["stage_message"], "You're building real strength.")

    def test_exact_threshold_crossing(self):
        # Yesterday 80 (Sprout), today +1... points come in 10s, use 71→81.
        supabase = FakeSupabase({
            "user_tree": [tree_row(81)],
            "tree_daily_log": [daily_log_row(days_ago(0), points=10)],
        })

        result = check_milestone_crossed(supabase, USER_ID)

        self.assertIsNotNone(result)
        self.assertEqual(result["stage_name"], "Young Plant")

    def test_no_crossing_within_stage(self):
        supabase = FakeSupabase({
            "user_tree": [tree_row(100)],
            "tree_daily_log": [daily_log_row(days_ago(0), points=10)],
        })

        self.assertIsNone(check_milestone_crossed(supabase, USER_ID))

    def test_no_points_today_no_milestone(self):
        supabase = FakeSupabase({
            "user_tree": [tree_row(88)],
            "tree_daily_log": [],
        })

        self.assertIsNone(check_milestone_crossed(supabase, USER_ID))

    def test_milestone_failure_returns_none(self):
        supabase = FakeSupabase({}, failing_tables={"user_tree"})

        self.assertIsNone(check_milestone_crossed(supabase, USER_ID))


class SeasonPayloadAndCacheTests(unittest.TestCase):
    def setUp(self):
        clear_season_cache()

    def _thriving_supabase(self):
        tasks, logs = thriving_week()
        return FakeSupabase({
            "companion_context": [],
            "loop_tasks": tasks,
            "tree_daily_log": logs,
            "user_tree": [tree_row(100)],
            "reflections": [{"id": "r1", "user_id": USER_ID}],
        })

    def test_payload_carries_milestone_and_stats(self):
        supabase = self._thriving_supabase()

        payload = get_season_payload(supabase, USER_ID)

        self.assertEqual(payload["season"], "thriving")
        self.assertIn("milestone", payload)
        self.assertEqual(payload["stats"]["score"], 100)
        self.assertEqual(payload["stats"]["stage_name"], "Young Plant")
        self.assertEqual(payload["stats"]["streak"], 3)
        self.assertEqual(payload["stats"]["reflections_count"], 1)

    def test_second_call_uses_cache_for_season(self):
        supabase = self._thriving_supabase()

        get_season_payload(supabase, USER_ID)
        loop_task_calls_after_first = supabase.table_calls.count("loop_tasks")
        get_season_payload(supabase, USER_ID)
        loop_task_calls_after_second = supabase.table_calls.count("loop_tasks")

        # Season inputs (loop_tasks) are not re-read on a cache hit.
        self.assertEqual(loop_task_calls_after_first, loop_task_calls_after_second)

    def test_expired_cache_recomputes(self):
        supabase = self._thriving_supabase()

        get_season_payload(supabase, USER_ID)
        with patch("ai.growth_tree_intelligence.time.monotonic",
                   side_effect=lambda: 10_000_000.0):
            get_season_payload(supabase, USER_ID)

        self.assertGreaterEqual(supabase.table_calls.count("loop_tasks"), 2)

    def test_crisis_bypasses_cache(self):
        supabase = self._thriving_supabase()
        get_season_payload(supabase, USER_ID)  # cache a thriving payload

        supabase.rows_by_table["companion_context"] = [
            context_row(days_ago(0), escalation=True)
        ]
        payload = get_season_payload(supabase, USER_ID)

        self.assertEqual(payload["season"], "sheltering")
        self.assertTrue(payload["crisis_active"])

    def test_cache_is_per_user(self):
        supabase = self._thriving_supabase()
        get_season_payload(supabase, USER_ID)

        other_tasks = [task_row(days_ago(5), completed=True, user_id=OTHER_USER)]
        supabase.rows_by_table["loop_tasks"].extend(other_tasks)
        supabase.rows_by_table["tree_daily_log"].append(
            daily_log_row(days_ago(5), user_id=OTHER_USER)
        )

        other_payload = get_season_payload(supabase, OTHER_USER)

        self.assertEqual(other_payload["season"], "resting")


class ScorePayloadTests(unittest.TestCase):
    def test_score_payload_shape(self):
        supabase = FakeSupabase({"user_tree": [tree_row(595, vitality=64, streak=9)]})

        payload = get_score_payload(supabase, USER_ID)

        self.assertEqual(payload, {
            "score": 595,
            "stage_id": 5,
            "stage_name": "Growing Tree",
            "vitality": 64,
            "streak": 9,
        })

    def test_missing_tree_row_is_a_seed(self):
        supabase = FakeSupabase({"user_tree": []})

        payload = get_score_payload(supabase, USER_ID)

        self.assertEqual(payload["score"], 0)
        self.assertEqual(payload["stage_name"], "Seed")

    def test_missing_user_id_raises(self):
        with self.assertRaises(GrowthTreeSecurityError):
            get_score_payload(FakeSupabase(), None)


def score_event(for_date, delta, running_total, created_at=None, user_id=USER_ID):
    return {
        "user_id": user_id,
        "event_type": "task_completion",
        "points_delta": delta,
        "running_total": running_total,
        "for_date": for_date,
        "created_at": created_at or f"{for_date}T10:00:00+00:00",
    }


class JourneyTests(unittest.TestCase):
    def test_full_journey_chronological_with_all_sources(self):
        supabase = FakeSupabase({
            "profiles": [{"id": USER_ID, "created_at": f"{days_ago(30)}T08:00:00+00:00"}],
            "loop_tasks": [
                {"user_id": USER_ID, "created_at": f"{days_ago(30)}T09:00:00+00:00",
                 "completed_at": f"{days_ago(28)}T10:00:00+00:00", "for_date": days_ago(28),
                 "category": "awareness"},
            ],
            "reflections": [
                {"id": "r1", "user_id": USER_ID, "created_at": f"{days_ago(25)}T21:00:00+00:00"},
            ],
            "companion_messages": [
                {"user_id": USER_ID, "created_at": f"{days_ago(20)}T12:00:00+00:00"},
            ],
            "tree_score_events": [
                score_event(days_ago(10), 10, 35),  # 25 -> 35 crosses Sprout (31)
            ],
            "tree_daily_log": [],
        })

        journey = build_journey(supabase, USER_ID)

        self.assertEqual([item["label"] for item in journey], [
            "You started.",
            "First task completed.",
            "First journal entry.",
            "First conversation with your companion.",
            "Sprout.",
        ])
        dates = [item["date"] for item in journey]
        self.assertEqual(dates, sorted(dates))

    def test_missing_sources_are_skipped_never_fabricated(self):
        supabase = FakeSupabase({
            "profiles": [{"id": USER_ID, "created_at": f"{days_ago(10)}T08:00:00+00:00"}],
            "loop_tasks": [],
            "reflections": [],
            "companion_messages": [],
            "tree_score_events": [],
            "tree_daily_log": [],
        })

        journey = build_journey(supabase, USER_ID)

        self.assertEqual(journey, [{"date": days_ago(10), "label": "You started."}])

    def test_broken_source_skips_only_that_milestone(self):
        supabase = FakeSupabase(
            {
                "profiles": [{"id": USER_ID, "created_at": f"{days_ago(10)}T08:00:00+00:00"}],
                "loop_tasks": [
                    {"user_id": USER_ID, "created_at": f"{days_ago(10)}T09:00:00+00:00",
                     "completed_at": f"{days_ago(9)}T10:00:00+00:00", "for_date": days_ago(9),
                     "category": "awareness"},
                ],
                "companion_messages": [],
                "tree_score_events": [],
                "tree_daily_log": [],
            },
            failing_tables={"reflections"},
        )

        journey = build_journey(supabase, USER_ID)

        labels = [item["label"] for item in journey]
        self.assertIn("You started.", labels)
        self.assertIn("First task completed.", labels)
        self.assertNotIn("First journal entry.", labels)

    def test_caps_at_most_recent_six(self):
        supabase = FakeSupabase({
            "profiles": [{"id": USER_ID, "created_at": f"{days_ago(40)}T08:00:00+00:00"}],
            "loop_tasks": [
                {"user_id": USER_ID, "created_at": f"{days_ago(40)}T09:00:00+00:00",
                 "completed_at": f"{days_ago(39)}T10:00:00+00:00", "for_date": days_ago(39),
                 "category": "awareness"},
            ],
            "reflections": [
                {"id": "r1", "user_id": USER_ID, "created_at": f"{days_ago(38)}T21:00:00+00:00"},
            ],
            "companion_messages": [
                {"user_id": USER_ID, "created_at": f"{days_ago(37)}T12:00:00+00:00"},
            ],
            # Four stage crossings -> 8 milestones total, keep most recent 6.
            "tree_score_events": [
                score_event(days_ago(30), 10, 35, f"{days_ago(30)}T10:00:00+00:00"),
                score_event(days_ago(20), 10, 85, f"{days_ago(20)}T10:00:00+00:00"),
                score_event(days_ago(10), 10, 185, f"{days_ago(10)}T10:00:00+00:00"),
                score_event(days_ago(2), 10, 355, f"{days_ago(2)}T10:00:00+00:00"),
            ],
            "tree_daily_log": [],
        })

        journey = build_journey(supabase, USER_ID)

        self.assertEqual(len(journey), 6)
        labels = [item["label"] for item in journey]
        # The two oldest ("You started.", "First task completed.") fall off.
        self.assertNotIn("You started.", labels)
        self.assertNotIn("First task completed.", labels)
        self.assertIn("Growing Tree.", labels)
        dates = [item["date"] for item in journey]
        self.assertEqual(dates, sorted(dates))

    def test_stage_dates_reconstructed_from_daily_log_when_no_events(self):
        supabase = FakeSupabase({
            "profiles": [{"id": USER_ID, "created_at": f"{days_ago(20)}T08:00:00+00:00"}],
            "loop_tasks": [],
            "reflections": [],
            "companion_messages": [],
            "tree_score_events": [],
            "tree_daily_log": [
                daily_log_row(days_ago(15), points=20),
                daily_log_row(days_ago(12), points=20),   # cumsum 40 -> Sprout
                daily_log_row(days_ago(8), points=25),
                daily_log_row(days_ago(5), points=20),    # cumsum 85 -> Young Plant
            ],
        })

        journey = build_journey(supabase, USER_ID)

        labels = [item["label"] for item in journey]
        self.assertIn("Sprout.", labels)
        self.assertIn("Young Plant.", labels)
        sprout = next(item for item in journey if item["label"] == "Sprout.")
        young_plant = next(item for item in journey if item["label"] == "Young Plant.")
        self.assertEqual(sprout["date"], days_ago(12))
        self.assertEqual(young_plant["date"], days_ago(5))

    def test_events_take_precedence_over_reconstruction(self):
        supabase = FakeSupabase({
            "profiles": [],
            "loop_tasks": [],
            "reflections": [],
            "companion_messages": [],
            "tree_score_events": [
                score_event(days_ago(3), 10, 35),  # exact Sprout crossing
            ],
            "tree_daily_log": [
                daily_log_row(days_ago(15), points=40),  # would reconstruct earlier
            ],
        })

        journey = build_journey(supabase, USER_ID)

        sprout = next(item for item in journey if item["label"] == "Sprout.")
        self.assertEqual(sprout["date"], days_ago(3))

    def test_user_isolation(self):
        supabase = FakeSupabase({
            "profiles": [{"id": OTHER_USER, "created_at": f"{days_ago(30)}T08:00:00+00:00"}],
            "loop_tasks": [],
            "reflections": [
                {"id": "r9", "user_id": OTHER_USER, "created_at": f"{days_ago(25)}T21:00:00+00:00"},
            ],
            "companion_messages": [],
            "tree_score_events": [],
            "tree_daily_log": [],
        })

        journey = build_journey(supabase, USER_ID)

        self.assertEqual(journey, [])

    def test_missing_user_id_raises(self):
        with self.assertRaises(GrowthTreeSecurityError):
            build_journey(FakeSupabase(), "  ")


class GrowthTreeEndpointTests(unittest.TestCase):
    def setUp(self):
        clear_season_cache()

    def test_season_endpoint_returns_payload_for_token_user(self):
        import main

        tasks, logs = thriving_week()
        fake = FakeSupabase({
            "companion_context": [],
            "loop_tasks": tasks,
            "tree_daily_log": logs,
            "user_tree": [tree_row(100)],
            "reflections": [],
        })
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.get_growth_tree_season(authorization="Bearer t"))

        self.assertEqual(response["season"], "thriving")
        self.assertEqual(response["stats"]["score"], 100)

    def test_season_endpoint_fails_safe_not_500(self):
        import main

        fake = FakeSupabase(
            {"companion_context": []},
            failing_tables={"loop_tasks"},
        )
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.get_growth_tree_season(authorization="Bearer t"))

        self.assertEqual(response["season"], "thriving")

    def test_score_endpoint_scoped_to_token_user(self):
        import main

        fake = FakeSupabase({
            "user_tree": [
                tree_row(595, user_id=USER_ID),
                tree_row(50, user_id=OTHER_USER),
            ],
        })
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.get_growth_tree_score(authorization="Bearer t"))

        self.assertEqual(response["score"], 595)

    def test_journey_endpoint_returns_items_for_token_user(self):
        import main

        fake = FakeSupabase({
            "profiles": [{"id": USER_ID, "created_at": f"{days_ago(10)}T08:00:00+00:00"}],
            "loop_tasks": [
                {"user_id": USER_ID, "created_at": f"{days_ago(10)}T09:00:00+00:00",
                 "completed_at": f"{days_ago(9)}T10:00:00+00:00", "for_date": days_ago(9),
                 "category": "awareness"},
            ],
            "reflections": [],
            "companion_messages": [],
            "tree_score_events": [],
            "tree_daily_log": [],
        })
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.get_growth_tree_journey(authorization="Bearer t"))

        self.assertEqual([item["label"] for item in response],
                         ["You started.", "First task completed."])

    def test_journey_endpoint_returns_empty_list_on_total_failure(self):
        import main

        class ExplodingSupabase:
            def table(self, name):
                raise RuntimeError("boom")

        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", ExplodingSupabase()),
        ):
            response = asyncio.run(main.get_growth_tree_journey(authorization="Bearer t"))

        self.assertEqual(response, [])

    def test_score_endpoint_500_on_data_failure(self):
        import main
        from fastapi import HTTPException

        fake = FakeSupabase({}, failing_tables={"user_tree"})
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(main.get_growth_tree_score(authorization="Bearer t"))

        self.assertEqual(caught.exception.status_code, 500)


if __name__ == "__main__":
    unittest.main()
