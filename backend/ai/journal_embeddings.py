"""
Reflection Layer 2 — sparse embedding on save (Option B).

Every saved journal entry gets a sparse TF embedding (the same
build_sparse_embedding() proven in task retrieval and the companion tools),
stored as JSONB in journal_embeddings. Zero new dependencies.

Privacy invariants:
- Tokens are HASHED before storage — the stored JSONB is not readable
  vocabulary. Query tokens are hashed identically at search time, so
  sparse_cosine matching is unaffected. Embeddings are for search, not reading.
- Logs carry ids and lengths only — never entry text, never tokens.
- Every query is scoped to user_id. A wrong-owner entry is a logged no-op.

Failure invariants:
- Nothing here ever raises to a caller. The journal save has already
  succeeded in Supabase before any of this runs; an embedding failure is
  logged, retried once after 30 seconds, and finally healed by the sweep
  on a future save.
"""

from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone

from .companion_tools import _entry_text
from .sparse_embedding import build_sparse_embedding, sparse_cosine

# Model identifier in ONE place; stamped into journal_embeddings.model per row
# so the future dense/pgvector migration can re-embed exactly these rows.
EMBEDDING_MODEL_NAME = "tfidf-sparse-minilm-compat"

TOKEN_HASH_CHARS = 12
SWEEP_LIMIT = 20
EMBED_RETRY_DELAY_SECONDS = 30
MATCH_FETCH_LIMIT = 200


def _hash_token(token: str) -> str:
    return hashlib.sha1(token.encode("utf-8")).hexdigest()[:TOKEN_HASH_CHARS]


def _hash_embedding(embedding: dict[str, float]) -> dict[str, float]:
    """Same weights, unreadable keys. sha1 truncated to 12 hex chars — ample
    for a per-user vocabulary; a collision would only merge two tokens'
    weights, never corrupt a row."""
    return {_hash_token(token): weight for token, weight in embedding.items()}


def _fetch_entry(supabase, user_id: str, entry_id: str) -> dict | None:
    rows = (
        supabase.table("reflections")
        .select("id,content,questions")
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def embed_entry(supabase, user_id: str, entry_id: str) -> bool:
    """Embed one entry and upsert its vector. Never raises. Returns True only
    when a vector was actually written."""
    if not str(user_id or "").strip() or not str(entry_id or "").strip():
        print("REFLECTION_EMBEDDING status=missing_ids")
        return False
    try:
        entry = _fetch_entry(supabase, user_id, entry_id)
        if entry is None:
            # Wrong owner or deleted entry — same log either way, no info leak.
            print(
                "REFLECTION_EMBEDDING "
                f"status=entry_not_found entry_id={entry_id} user_id={user_id}"
            )
            return False

        text = _entry_text(entry)
        if not text.strip():
            print(
                "REFLECTION_EMBEDDING "
                f"status=skipped_empty entry_id={entry_id} user_id={user_id}"
            )
            return False

        embedding = _hash_embedding(build_sparse_embedding(text))
        supabase.table("journal_embeddings").upsert(
            {
                "entry_id": entry_id,
                "user_id": user_id,
                "embedding": embedding,
                "model": EMBEDDING_MODEL_NAME,
            },
            on_conflict="entry_id",
        ).execute()
        print(
            "REFLECTION_EMBEDDING "
            f"status=embedded entry_id={entry_id} user_id={user_id} "
            f"text_chars={len(text)} tokens={len(embedding)}"
        )
        return True
    except Exception as error:
        print(
            "REFLECTION_EMBEDDING "
            f"status=failed entry_id={entry_id} user_id={user_id} "
            f"error_type={type(error).__name__} "
            f"at={datetime.now(timezone.utc).isoformat()}"
        )
        return False


def sweep_unembedded(supabase, user_id: str, limit: int = SWEEP_LIMIT) -> int:
    """Embed up to `limit` of this user's entries that have no vector yet —
    heals past failures and backfills entries saved before Layer 2 existed
    (including legacy questions-format rows). Never raises."""
    try:
        entry_rows = (
            supabase.table("reflections")
            .select("id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        ).data or []
        embedded_rows = (
            supabase.table("journal_embeddings")
            .select("entry_id")
            .eq("user_id", user_id)
            .execute()
        ).data or []
        embedded_ids = {row.get("entry_id") for row in embedded_rows}
        missing = [row["id"] for row in entry_rows if row.get("id") not in embedded_ids]

        embedded_count = 0
        for missing_id in missing[:limit]:
            if embed_entry(supabase, user_id, missing_id):
                embedded_count += 1
        if missing:
            print(
                "REFLECTION_EMBEDDING "
                f"status=sweep user_id={user_id} "
                f"missing={len(missing)} embedded={embedded_count}"
            )
        return embedded_count
    except Exception as error:
        print(
            "REFLECTION_EMBEDDING "
            f"status=sweep_failed user_id={user_id} error_type={type(error).__name__}"
        )
        return 0


def match_journal_embeddings(
    supabase, user_id: str, query_text: str, top_k: int = 3
) -> list[dict]:
    """Similarity search in Python (Option B — replaces the pgvector SQL
    function until the dense upgrade). Scoped to user_id at the query level;
    returns [{entry_id, similarity}], best first. Never raises."""
    if not str(user_id or "").strip():
        return []
    try:
        rows = (
            supabase.table("journal_embeddings")
            .select("entry_id,embedding")
            .eq("user_id", user_id)
            .limit(MATCH_FETCH_LIMIT)
            .execute()
        ).data or []
        query_embedding = _hash_embedding(build_sparse_embedding(str(query_text or "")))
        scored = [
            {
                "entry_id": row.get("entry_id"),
                "similarity": round(
                    sparse_cosine(query_embedding, row.get("embedding") or {}), 4
                ),
            }
            for row in rows
        ]
        scored.sort(key=lambda item: -item["similarity"])
        return [item for item in scored[: max(1, top_k)] if item["similarity"] > 0]
    except Exception as error:
        print(
            "REFLECTION_EMBEDDING "
            f"status=match_failed user_id={user_id} error_type={type(error).__name__}"
        )
        return []


async def embed_entry_task(supabase, user_id: str, entry_id: str) -> None:
    """The background task the embed endpoint schedules. Runs after the HTTP
    response has already returned. One retry after 30 seconds on failure,
    then the sweep heals whatever remains on a future save."""
    ok = embed_entry(supabase, user_id, entry_id)
    if not ok:
        print(
            "REFLECTION_EMBEDDING "
            f"status=retry_scheduled entry_id={entry_id} user_id={user_id} "
            f"delay_s={EMBED_RETRY_DELAY_SECONDS}"
        )
        await asyncio.sleep(EMBED_RETRY_DELAY_SECONDS)
        embed_entry(supabase, user_id, entry_id)
    sweep_unembedded(supabase, user_id)
