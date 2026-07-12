import asyncio
import re
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks

import main
from ai.journal_embeddings import (
    EMBEDDING_MODEL_NAME,
    TOKEN_HASH_CHARS,
    _hash_embedding,
    embed_entry,
    embed_entry_task,
    match_journal_embeddings,
    sweep_unembedded,
)
from ai.sparse_embedding import build_sparse_embedding, sparse_cosine


USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER = "22222222-2222-2222-2222-222222222222"


class FilteringQuery:
    """Fake supabase query that actually applies .eq filters, so ownership
    scoping is genuinely exercised rather than assumed."""

    def __init__(self, parent, table_name):
        self.parent = parent
        self.table_name = table_name
        self.filters = {}

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args):
        return self

    def upsert(self, payload, **kwargs):
        if self.parent.raise_on_upsert:
            raise RuntimeError("journal_embeddings unavailable")
        self.parent.upserts.append((self.table_name, payload, kwargs))
        return self

    def execute(self):
        rows = self.parent.rows_by_table.get(self.table_name, [])
        for column, value in self.filters.items():
            rows = [row for row in rows if row.get(column) == value or column not in row]
        return SimpleNamespace(data=rows, count=len(rows))


class FakeSupabase:
    def __init__(self, rows_by_table=None, raise_on_upsert=False):
        self.rows_by_table = rows_by_table or {}
        self.raise_on_upsert = raise_on_upsert
        self.upserts = []

    def table(self, name):
        return FilteringQuery(self, name)


def entry_row(entry_id: str, user_id: str, content: str) -> dict:
    return {"id": entry_id, "user_id": user_id, "content": content, "questions": []}


class TokenHashingTests(unittest.TestCase):
    def test_stored_keys_are_hashes_not_vocabulary(self):
        supabase = FakeSupabase({
            "reflections": [entry_row("e1", USER_ID, "I cannot forgive my father for what happened")],
        })
        self.assertTrue(embed_entry(supabase, USER_ID, "e1"))

        _, payload, _ = supabase.upserts[0]
        keys = list(payload["embedding"].keys())
        for word in ["forgive", "father", "happened", "cannot"]:
            self.assertNotIn(word, keys)
        for key in keys:
            self.assertRegex(key, rf"^[0-9a-f]{{{TOKEN_HASH_CHARS}}}$")

    def test_hashing_preserves_cosine_similarity_exactly(self):
        a = build_sparse_embedding("stuck project no progress spinning")
        b = build_sparse_embedding("everything stuck going nowhere no progress")

        plain = sparse_cosine(a, b)
        hashed = sparse_cosine(_hash_embedding(a), _hash_embedding(b))

        self.assertAlmostEqual(plain, hashed, places=9)
        self.assertGreater(hashed, 0)


class EmbedEntryTests(unittest.TestCase):
    def test_upsert_targets_entry_id_and_stamps_model(self):
        supabase = FakeSupabase({
            "reflections": [entry_row("e1", USER_ID, "a real journal entry about the day")],
        })
        embed_entry(supabase, USER_ID, "e1")

        table, payload, kwargs = supabase.upserts[0]
        self.assertEqual(table, "journal_embeddings")
        self.assertEqual(payload["entry_id"], "e1")
        self.assertEqual(payload["user_id"], USER_ID)
        self.assertEqual(payload["model"], EMBEDDING_MODEL_NAME)
        self.assertEqual(kwargs.get("on_conflict"), "entry_id")

    def test_wrong_owner_is_a_no_op(self):
        supabase = FakeSupabase({
            "reflections": [entry_row("e1", OTHER_USER, "someone else's private entry")],
        })
        self.assertFalse(embed_entry(supabase, USER_ID, "e1"))
        self.assertEqual(supabase.upserts, [])

    def test_empty_entry_is_skipped(self):
        supabase = FakeSupabase({"reflections": [entry_row("e1", USER_ID, "   ")]})
        self.assertFalse(embed_entry(supabase, USER_ID, "e1"))
        self.assertEqual(supabase.upserts, [])

    def test_upsert_failure_never_raises(self):
        supabase = FakeSupabase(
            {"reflections": [entry_row("e1", USER_ID, "a normal entry")]},
            raise_on_upsert=True,
        )
        self.assertFalse(embed_entry(supabase, USER_ID, "e1"))

    def test_missing_ids_are_a_no_op(self):
        self.assertFalse(embed_entry(FakeSupabase(), "", "e1"))
        self.assertFalse(embed_entry(FakeSupabase(), USER_ID, ""))


class SweepTests(unittest.TestCase):
    def test_sweep_embeds_only_the_missing_entries(self):
        supabase = FakeSupabase({
            "reflections": [
                entry_row("e1", USER_ID, "first entry text here"),
                entry_row("e2", USER_ID, "second entry text here"),
                entry_row("e3", USER_ID, "third entry text here"),
            ],
            "journal_embeddings": [{"entry_id": "e2", "user_id": USER_ID}],
        })
        embedded = sweep_unembedded(supabase, USER_ID)

        self.assertEqual(embedded, 2)
        upserted_ids = {payload["entry_id"] for _, payload, _ in supabase.upserts}
        self.assertEqual(upserted_ids, {"e1", "e3"})


class MatchTests(unittest.TestCase):
    def test_match_ranks_similar_entry_first_and_is_user_scoped(self):
        stuck = _hash_embedding(build_sparse_embedding("stuck project no progress spinning"))
        grateful = _hash_embedding(build_sparse_embedding("grateful family dinner calm evening"))
        supabase = FakeSupabase({
            "journal_embeddings": [
                {"entry_id": "e1", "user_id": USER_ID, "embedding": stuck},
                {"entry_id": "e2", "user_id": USER_ID, "embedding": grateful},
                {"entry_id": "e9", "user_id": OTHER_USER,
                 "embedding": _hash_embedding(build_sparse_embedding("stuck stuck stuck project"))},
            ],
        })
        results = match_journal_embeddings(supabase, USER_ID, "feeling stuck with the project")

        self.assertEqual(results[0]["entry_id"], "e1")
        self.assertNotIn("e9", [r["entry_id"] for r in results])

    def test_match_returns_empty_without_user_id(self):
        self.assertEqual(match_journal_embeddings(FakeSupabase(), "", "stuck"), [])


class EmbedTaskTests(unittest.TestCase):
    def test_failure_retries_once_after_30s_then_sweeps(self):
        supabase = FakeSupabase({"reflections": []})  # entry not found -> False
        with (
            patch("ai.journal_embeddings.asyncio.sleep", new=AsyncMock()) as slept,
            patch("ai.journal_embeddings.embed_entry", return_value=False) as embed,
            patch("ai.journal_embeddings.sweep_unembedded", return_value=0) as sweep,
        ):
            asyncio.run(embed_entry_task(supabase, USER_ID, "e1"))

        self.assertEqual(embed.call_count, 2)
        slept.assert_awaited_once_with(30)
        sweep.assert_called_once()

    def test_success_skips_retry_but_still_sweeps(self):
        with (
            patch("ai.journal_embeddings.asyncio.sleep", new=AsyncMock()) as slept,
            patch("ai.journal_embeddings.embed_entry", return_value=True) as embed,
            patch("ai.journal_embeddings.sweep_unembedded", return_value=1) as sweep,
        ):
            asyncio.run(embed_entry_task(FakeSupabase(), USER_ID, "e1"))

        self.assertEqual(embed.call_count, 1)
        slept.assert_not_awaited()
        sweep.assert_called_once()


class EmbedEndpointTests(unittest.TestCase):
    def test_endpoint_schedules_task_and_returns_immediately(self):
        background = BackgroundTasks()
        fake = FakeSupabase()
        with (
            patch.object(main, "validate_supabase_access_token", return_value=USER_ID),
            patch.object(main, "supabase", fake),
        ):
            response = asyncio.run(
                main.schedule_reflection_embedding(
                    "entry-123", background_tasks=background, authorization="Bearer t"
                )
            )

        self.assertEqual(response, {"status": "scheduled"})
        self.assertEqual(len(background.tasks), 1)
        task = background.tasks[0]
        # Layer 3 trigger chain: the embed endpoint now schedules the composed
        # embed-then-analyse task instead of the bare embed task.
        from ai.reflection_agent import embed_and_analyse_task
        self.assertIs(task.func, embed_and_analyse_task)
        self.assertEqual(task.args, (fake, USER_ID, "entry-123"))

    def test_endpoint_rejects_missing_auth(self):
        with patch.object(
            main,
            "validate_supabase_access_token",
            side_effect=main.HTTPException(status_code=401, detail="no token"),
        ):
            with self.assertRaises(main.HTTPException):
                asyncio.run(
                    main.schedule_reflection_embedding(
                        "entry-123", background_tasks=BackgroundTasks(), authorization=None
                    )
                )


if __name__ == "__main__":
    unittest.main()
