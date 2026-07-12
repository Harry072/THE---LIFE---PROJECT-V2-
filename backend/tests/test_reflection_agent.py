import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from ai.companion_security import CompanionSecurityError
from ai.reflection_agent import (
    PATTERN_REVEAL_QUESTION,
    analyse_entry,
    clear_pending_reveal,
    embed_and_analyse_task,
    find_pending_reveal,
)


USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER = "22222222-2222-2222-2222-222222222222"


def days_ago(n: int) -> str:
    # The reflection agent computes "today" in UTC; seeds must use the same
    # clock or date-boundary tests drift by a day whenever local leads UTC.
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


GOOD_EXTRACTION = {
    "primary_emotion": "Stuck",
    "energy_level": "Low",
    "surface_message": "They said the project is not moving.",
    "signal": "Fear that effort will not amount to anything.",
    "what_avoided": "That they are considering walking away.",
    "key_themes": ["project", "progress", "doubt"],
}


class RecordingQuery:
    """Applies .eq/.gte/.lte filters and .order/.limit for real — not just
    recorded — so tests genuinely exercise the query logic (e.g. "most
    recent pending row" actually depends on real sorting, not seed order)."""

    def __init__(self, parent, table_name):
        self.parent = parent
        self.table_name = table_name
        self.filters = {}
        self.range_filters = {}
        self.order_column = None
        self.order_desc = False
        self.limit_value = None
        self._pending_update = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value):
        self.filters[column] = value
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

    def insert(self, payload):
        self.parent.inserts.append((self.table_name, payload))
        return self

    def update(self, payload):
        self._pending_update = payload
        return self

    def upsert(self, payload, **kwargs):
        self.parent.upserts.append((self.table_name, payload, kwargs))
        return self

    def execute(self):
        if self._pending_update is not None:
            self.parent.updates.append(
                (self.table_name, self._pending_update, dict(self.filters))
            )
            for row in self.parent.rows_by_table.get(self.table_name, []):
                if all(row.get(c) == v for c, v in self.filters.items()):
                    row.update(self._pending_update)
            return SimpleNamespace(data=[])

        rows = self.parent.rows_by_table.get(self.table_name, [])
        for column, value in self.filters.items():
            rows = [r for r in rows if r.get(column) == value or column not in r]
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
    def __init__(self, rows_by_table=None):
        self.rows_by_table = rows_by_table or {}
        self.inserts = []
        self.updates = []
        self.upserts = []

    def table(self, name):
        return RecordingQuery(self, name)

    def stored_analysis(self):
        payloads = [p for t, p, f in self.updates if t == "reflections"]
        return payloads[-1]["reflection_analysis"] if payloads else None

    def context_upsert(self):
        payloads = [p for t, p, k in self.upserts if t == "companion_context"]
        return payloads[-1] if payloads else None


def entry_row(entry_id, user_id, content, for_date=None):
    return {
        "id": entry_id, "user_id": user_id, "content": content,
        "questions": [], "for_date": for_date or days_ago(0),
    }


def make_supabase(content="A normal day, worked on the project, slow progress but steady.",
                  extra_reflections=None, companion_context_rows=None):
    reflections = [entry_row("e-today", USER_ID, content)]
    reflections.extend(extra_reflections or [])
    return FakeSupabase({
        "reflections": reflections,
        "companion_context": companion_context_rows or [],
    })


def run_analysis(supabase, *, extraction=GOOD_EXTRACTION, matches=None,
                 task_hist=None, entry_id="e-today", user_id=USER_ID):
    groq = MagicMock(return_value=dict(extraction)) if not isinstance(extraction, Exception) \
        else MagicMock(side_effect=extraction)
    with (
        patch("ai.reflection_agent._call_groq_extraction", groq),
        patch("ai.reflection_agent.match_journal_embeddings", return_value=matches or []),
        patch("ai.reflection_agent.task_history",
              MagicMock(return_value=task_hist) if task_hist is not None
              else MagicMock(side_effect=RuntimeError("no task data"))),
    ):
        result = analyse_entry(supabase, user_id, entry_id)
    return result, groq


class DistressGateTests(unittest.TestCase):
    def test_distress_entry_blocks_analysis_and_escalates(self):
        supabase = make_supabase(
            content="I am so tired of all of it, honestly I just want to give up on everything."
        )
        result, groq = run_analysis(supabase)

        self.assertFalse(result)
        groq.assert_not_called()  # G1+G2: no LLM ever sees a distress entry

        self.assertEqual(supabase.inserts[0][0], "escalation_log")
        self.assertEqual(supabase.inserts[0][1]["signal_type"], "persistent_distress")

        stored = supabase.stored_analysis()
        self.assertTrue(stored["analysis_blocked"])
        self.assertEqual(stored["signal_type"], "persistent_distress")  # real tier, not hardcoded

        context = supabase.context_upsert()  # your decision: companion knows today
        self.assertTrue(context["escalation_triggered"])
        self.assertEqual(context["session_quality"], "crisis")


class SkipPathTests(unittest.TestCase):
    def test_empty_entry_skips_without_llm(self):
        supabase = make_supabase(content="   ")
        result, groq = run_analysis(supabase)

        self.assertFalse(result)
        groq.assert_not_called()
        self.assertEqual(supabase.updates, [])

    def test_wrong_owner_entry_not_found(self):
        supabase = FakeSupabase({
            "reflections": [entry_row("e-today", OTHER_USER, "someone else's entry")],
            "companion_context": [],
        })
        result, groq = run_analysis(supabase)

        self.assertFalse(result)
        groq.assert_not_called()

    def test_missing_user_id_raises_security_error(self):
        with self.assertRaises(CompanionSecurityError):
            analyse_entry(make_supabase(), "", "e-today")


class ExtractionFailureTests(unittest.TestCase):
    def test_llm_failure_stores_marker_and_never_crashes(self):
        supabase = make_supabase()
        result, _ = run_analysis(supabase, extraction=RuntimeError("groq down"))

        self.assertFalse(result)
        stored = supabase.stored_analysis()
        self.assertTrue(stored["extraction_failed"])
        self.assertFalse(stored["analysis_blocked"])
        self.assertIsNone(supabase.context_upsert())  # nothing fed downstream


class PatternTests(unittest.TestCase):
    def matched_history(self):
        return [
            entry_row("e-old-1", USER_ID, "stuck again on the same project", days_ago(9)),
            entry_row("e-old-2", USER_ID, "no progress, spinning in place", days_ago(2)),
        ]

    def test_pattern_found_builds_specific_description(self):
        supabase = make_supabase(extra_reflections=self.matched_history())
        matches = [
            {"entry_id": "e-today", "similarity": 0.95},  # must be excluded
            {"entry_id": "e-old-1", "similarity": 0.42},
            {"entry_id": "e-old-2", "similarity": 0.35},
        ]
        result, _ = run_analysis(supabase, matches=matches)

        self.assertTrue(result)
        stored = supabase.stored_analysis()
        self.assertTrue(stored["pattern_detected"])
        self.assertEqual(stored["pattern_frequency"], 2)  # today's entry excluded
        self.assertIn("2 times", stored["pattern_description"])
        self.assertIn("9 days", stored["pattern_description"])
        self.assertIn(days_ago(2), stored["pattern_description"])

        context = supabase.context_upsert()
        self.assertTrue(context["pattern_detected"])
        self.assertTrue(context["pattern_reveal_pending"])  # STEP 8

    def test_below_threshold_or_count_is_honest_silence(self):
        supabase = make_supabase(extra_reflections=self.matched_history())
        # One over threshold + one under = fewer than 2 real matches.
        matches = [
            {"entry_id": "e-old-1", "similarity": 0.42},
            {"entry_id": "e-old-2", "similarity": 0.22},
        ]
        result, _ = run_analysis(supabase, matches=matches)

        self.assertTrue(result)
        stored = supabase.stored_analysis()
        self.assertFalse(stored["pattern_detected"])
        self.assertIsNone(stored["pattern_description"])
        self.assertEqual(stored["pattern_frequency"], 0)

        context = supabase.context_upsert()
        self.assertNotIn("pattern_reveal_pending", context)  # never set false, only true

    def test_first_ever_entry_no_matches_at_all(self):
        supabase = make_supabase()
        result, _ = run_analysis(supabase, matches=[])

        self.assertTrue(result)
        self.assertFalse(supabase.stored_analysis()["pattern_detected"])


class MergeRuleTests(unittest.TestCase):
    def test_merge_never_overwrites_crisis_or_existing_fields(self):
        existing = {
            "user_id": USER_ID,
            "date": days_ago(0),
            "session_quality": "crisis",
            "escalation_triggered": True,
            "primary_emotion": "distress",
            "energy_level": None,
            "pattern_detected": False,
            "pattern_summary": None,
            "task_recommendation": None,
        }
        supabase = make_supabase(companion_context_rows=[existing])
        result, _ = run_analysis(supabase)

        self.assertTrue(result)
        context = supabase.context_upsert()
        self.assertTrue(context["escalation_triggered"])          # kept true
        self.assertNotIn("session_quality", context)              # crisis untouched (omitted)
        self.assertNotIn("primary_emotion", context)              # companion's value kept
        self.assertEqual(context["energy_level"], "low")          # null -> filled

    def test_merge_fills_empty_context_and_uses_task_history(self):
        supabase = make_supabase()
        result, _ = run_analysis(
            supabase, task_hist={"most_skipped_category": "reflection"}
        )

        self.assertTrue(result)
        context = supabase.context_upsert()
        self.assertEqual(context["primary_emotion"], "stuck")     # coerced lowercase
        self.assertEqual(context["energy_level"], "low")
        self.assertEqual(context["task_recommendation"], "reflection")  # avoided category wins

    def test_task_recommendation_falls_back_to_energy_map(self):
        supabase = make_supabase()
        result, _ = run_analysis(supabase)  # task_history raises in harness

        self.assertTrue(result)
        self.assertEqual(supabase.context_upsert()["task_recommendation"], "reset")  # low -> reset


class AnalyseEndpointTests(unittest.TestCase):
    def test_endpoint_schedules_analyse_task_and_returns_immediately(self):
        import main
        from fastapi import BackgroundTasks
        from ai.reflection_agent import analyse_entry_task

        background = BackgroundTasks()
        fake = FakeSupabase()
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(
                main.schedule_reflection_analysis(
                    "entry-123", background_tasks=background, authorization="Bearer t"
                )
            )

        self.assertEqual(response, {"status": "scheduled"})
        self.assertEqual(len(background.tasks), 1)
        task = background.tasks[0]
        self.assertIs(task.func, analyse_entry_task)
        self.assertEqual(task.args, (fake, USER_ID, "entry-123"))

    def test_endpoint_rejects_missing_auth(self):
        import main
        from fastapi import BackgroundTasks

        with patch.object(
            main,
            "validate_supabase_access_token",
            side_effect=main.HTTPException(status_code=401, detail="no token"),
        ):
            with self.assertRaises(main.HTTPException):
                asyncio.run(
                    main.schedule_reflection_analysis(
                        "entry-123", background_tasks=BackgroundTasks(), authorization=None
                    )
                )


def context_row(user_id, for_date, pending=False, shown_count=0):
    return {
        "user_id": user_id,
        "date": for_date,
        "pattern_reveal_pending": pending,
        "reveal_shown_count": shown_count,
    }


def analysed_entry_row(entry_id, user_id, pattern_detected, description=None, created_at_date=None):
    return {
        "id": entry_id,
        "user_id": user_id,
        "created_at": f"{created_at_date or days_ago(0)}T12:00:00+00:00",
        "reflection_analysis": {
            "pattern_detected": pattern_detected,
            "pattern_description": description,
        },
    }


class PatternRevealCheckTests(unittest.TestCase):
    def test_pending_within_window_returns_description_and_increments_count(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(1), pending=True, shown_count=2)],
            "reflections": [
                analysed_entry_row("e1", USER_ID, True, "This feeling has appeared 3 times.", days_ago(1)),
            ],
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertEqual(result, {
            "pending": True,
            "description": "This feeling has appeared 3 times.",
            "question": PATTERN_REVEAL_QUESTION,
        })
        # shown_count incremented 2 -> 3, scoped to the exact pending row
        table, payload, filters = supabase.updates[-1]
        self.assertEqual(table, "companion_context")
        self.assertEqual(payload, {"reveal_shown_count": 3})
        self.assertEqual(filters["user_id"], USER_ID)

    def test_no_pending_row_in_last_4_days_returns_not_pending(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(1), pending=False)],
            "reflections": [],
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertEqual(result, {"pending": False, "description": None, "question": None})

    def test_pending_exactly_at_3_days_still_shows(self):
        # Boundary check: (today - row_date).days == 3 is NOT "> 3", so this
        # is the last day it should still show, not the first day it clears.
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(3), pending=True)],
            "reflections": [analysed_entry_row("e1", USER_ID, True, "still fresh enough", days_ago(3))],
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertTrue(result["pending"])
        self.assertEqual(result["description"], "still fresh enough")

    def test_pending_older_than_3_days_autoclears(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(4), pending=True)],
            "reflections": [analysed_entry_row("e1", USER_ID, True, "too old now", days_ago(4))],
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertEqual(result, {"pending": False, "description": None, "question": None})
        table, payload, filters = supabase.updates[-1]
        self.assertEqual(payload, {"pattern_reveal_pending": False})
        self.assertEqual(filters["date"], days_ago(4))

    def test_missing_backing_entry_fails_closed(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(0), pending=True)],
            "reflections": [],  # flag says pattern exists, but no entry backs it
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertFalse(result["pending"])

    def test_entry_lookup_ignores_for_date_and_finds_most_recent_patterned_entry(self):
        # The backing-entry lookup is NOT joined on companion_context.date —
        # it just wants the most recent entry with pattern_detected=true,
        # sidestepping the UTC-vs-local date mismatch entirely.
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(0), pending=True)],
            "reflections": [
                analysed_entry_row("e-old", USER_ID, True, "older pattern", days_ago(5)),
                analysed_entry_row("e-newest", USER_ID, True, "newest pattern", days_ago(0)),
                analysed_entry_row("e-no-pattern", USER_ID, False, None, days_ago(0)),
            ],
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertEqual(result["description"], "newest pattern")

    def test_missing_user_id_raises(self):
        with self.assertRaises(CompanionSecurityError):
            find_pending_reveal(FakeSupabase(), "")

    def test_multiple_context_rows_picks_most_recent_pending_one(self):
        supabase = FakeSupabase({
            "companion_context": [
                context_row(USER_ID, days_ago(2), pending=True),
                context_row(USER_ID, days_ago(0), pending=False),  # today: no pattern yet
            ],
            "reflections": [
                analysed_entry_row("e1", USER_ID, True, "from two days ago", days_ago(2)),
            ],
        })

        result = find_pending_reveal(supabase, USER_ID)

        self.assertTrue(result["pending"])
        self.assertEqual(result["description"], "from two days ago")


class PatternRevealSeenTests(unittest.TestCase):
    def test_seen_clears_the_actual_pending_row(self):
        supabase = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(2), pending=True)],
        })

        cleared = clear_pending_reveal(supabase, USER_ID)

        self.assertTrue(cleared)
        table, payload, filters = supabase.updates[-1]
        self.assertEqual(payload, {"pattern_reveal_pending": False})
        self.assertEqual(filters["date"], days_ago(2))  # the actual pending row, not today's

    def test_seen_with_nothing_pending_returns_false(self):
        supabase = FakeSupabase({"companion_context": []})

        self.assertFalse(clear_pending_reveal(supabase, USER_ID))
        self.assertEqual(supabase.updates, [])

    def test_missing_user_id_raises(self):
        with self.assertRaises(CompanionSecurityError):
            clear_pending_reveal(FakeSupabase(), None)


class PatternRevealEndpointTests(unittest.TestCase):
    def test_get_endpoint_returns_pending_payload(self):
        import main

        fake = FakeSupabase({
            "companion_context": [context_row(USER_ID, days_ago(0), pending=True)],
            "reflections": [analysed_entry_row("e1", USER_ID, True, "a real pattern", days_ago(0))],
        })
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.get_pattern_reveal(authorization="Bearer t"))

        self.assertEqual(response, {
            "pending": True, "description": "a real pattern", "question": PATTERN_REVEAL_QUESTION,
        })

    def test_get_endpoint_rejects_missing_auth(self):
        import main

        with patch.object(
            main, "validate_supabase_access_token",
            side_effect=main.HTTPException(status_code=401, detail="no token"),
        ):
            with self.assertRaises(main.HTTPException):
                asyncio.run(main.get_pattern_reveal(authorization=None))

    def test_post_seen_endpoint_clears_and_reports_status(self):
        import main

        fake = FakeSupabase({"companion_context": [context_row(USER_ID, days_ago(1), pending=True)]})
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.mark_pattern_reveal_seen(authorization="Bearer t"))

        self.assertEqual(response, {"status": "cleared"})
        self.assertEqual(fake.updates[-1][1], {"pattern_reveal_pending": False})

    def test_post_seen_endpoint_nothing_pending(self):
        import main

        fake = FakeSupabase({"companion_context": []})
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(main.mark_pattern_reveal_seen(authorization="Bearer t"))

        self.assertEqual(response, {"status": "nothing_pending"})


class TriggerChainTests(unittest.TestCase):
    def test_chain_runs_embed_then_analyse_in_order(self):
        calls = []

        async def fake_embed(supabase, user_id, entry_id):
            calls.append("embed")

        async def fake_analyse(supabase, user_id, entry_id):
            calls.append("analyse")

        with (
            patch("ai.reflection_agent.embed_entry_task", new=AsyncMock(side_effect=fake_embed)),
            patch("ai.reflection_agent.analyse_entry_task", new=AsyncMock(side_effect=fake_analyse)),
        ):
            asyncio.run(embed_and_analyse_task(FakeSupabase(), USER_ID, "e-today"))

        self.assertEqual(calls, ["embed", "analyse"])


if __name__ == "__main__":
    unittest.main()
