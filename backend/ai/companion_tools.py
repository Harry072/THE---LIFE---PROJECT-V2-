"""
The Companion Expert Agent's four tools.

Each tool is a plain callable, independently testable, and returns SIGNALS
only — never raw journal text or verbatim task titles (SECURITY 3). Every
tool requires user_id and raises CompanionSecurityError without it
(SECURITY 5). All retrieval is scoped to that user_id at the query level.

Grounding note: journal_search and pattern_check run on the existing sparse
embedding (ai/sparse_embedding.py) computed in memory over the user's own
reflections, fetched server-side per request. Nothing is stored. The tool
contracts are pgvector-ready: when Reflection Layer 2 lands, only the
_fetch_and_rank internals change — callers and return shapes stay identical.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timezone

from .companion_security import (
    enforce_signal_shape,
    require_user_id,
)
from .fallbacks import build_life_companion_response, generate_life_companion_crisis_response
from .sparse_embedding import build_sparse_embedding, sparse_cosine
from .task_intelligence import _fetch_completion_rate, _fetch_recent_tasks


# ── shared: reflections corpus ───────────────────────────────────────────────

REFLECTIONS_FETCH_LIMIT = 100

# Deterministic emotion lexicon — used when the entry has no mood label.
# First lexicon whose keywords appear most often wins.
EMOTION_LEXICON: dict[str, list[str]] = {
    "stuck": ["stuck", "going nowhere", "no progress", "spinning", "same place", "not moving"],
    "anxious": ["anxious", "anxiety", "worry", "worried", "panic", "racing", "overwhelmed"],
    "sad": ["sad", "down", "heavy", "empty", "numb", "crying", "grief"],
    "angry": ["angry", "anger", "furious", "snapped", "rage", "irritated", "frustrated"],
    "lonely": ["alone", "lonely", "isolated", "invisible", "nobody", "no one"],
    "tired": ["tired", "exhausted", "drained", "no energy", "burnt out", "burned out"],
    "hopeful": ["hope", "hopeful", "better", "progress", "proud", "grateful", "lighter"],
}


def _entry_text(row: dict) -> str:
    """A reflection row's text: freeform `content` (post-040) or the joined
    answers of the legacy `questions` JSONB. Used in memory only — never
    returned by a tool."""
    content = str(row.get("content") or "").strip()
    if content:
        return content
    answers = []
    for item in row.get("questions") or []:
        if isinstance(item, dict):
            answer = str(item.get("answer") or item.get("a") or "").strip()
            if answer:
                answers.append(answer)
    return " ".join(answers)


def _emotion_signal(row: dict, text: str) -> str:
    mood = str(row.get("mood") or "").strip().lower()
    if mood:
        return mood
    lowered = text.lower()
    counts = {
        emotion: sum(1 for keyword in keywords if keyword in lowered)
        for emotion, keywords in EMOTION_LEXICON.items()
    }
    best = max(counts, key=lambda emotion: counts[emotion])
    return best if counts[best] > 0 else "unspecified"


def _key_theme(query_embedding: dict, entry_embedding: dict) -> str:
    """The honest 'why this matched': the strongest overlapping tokens between
    query and entry. Derived from the embeddings, not generated."""
    overlap = [
        (query_embedding[token] * weight, token)
        for token, weight in entry_embedding.items()
        if token in query_embedding
    ]
    overlap.sort(reverse=True)
    return ", ".join(token for _, token in overlap[:3]) or "general"


def _fetch_reflections(supabase, user_id: str) -> list[dict]:
    """Newest-first reflections for this user only. Primary select includes
    the post-040 `content` column; falls back to the legacy shape if that
    column doesn't exist yet (same idiom as task_intelligence's fetchers)."""
    base_cols = "id,for_date,created_at,mood,questions,pattern_tags"
    for cols in (f"{base_cols},content", base_cols):
        try:
            rows = (
                supabase.table("reflections")
                .select(cols)
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(REFLECTIONS_FETCH_LIMIT)
                .execute()
            ).data or []
            return rows
        except Exception:
            continue
    return []


def _rank_reflections(rows: list[dict], query: str) -> list[tuple[float, dict, dict]]:
    """(similarity, row, entry_embedding) triples, best first, zero-score dropped."""
    query_embedding = build_sparse_embedding(query)
    ranked = []
    for row in rows:
        text = _entry_text(row)
        if not text:
            continue
        entry_embedding = build_sparse_embedding(text)
        score = sparse_cosine(query_embedding, entry_embedding)
        if score > 0:
            ranked.append((score, row, entry_embedding))
    ranked.sort(key=lambda item: -item[0])
    return ranked


# ── TOOL 1: journal_search ───────────────────────────────────────────────────

JOURNAL_SEARCH_SIGNAL_KEYS = {"date", "emotion_signal", "key_theme", "similarity_score"}


def journal_search(query: str, user_id: str, top_k: int = 3, *, supabase) -> list[dict]:
    """Semantic search over this user's journal entries. Returns signals only:
    [{date, emotion_signal, key_theme, similarity_score}] — never raw text.
    An empty list is an honest 'nothing similar found'."""
    user_id = require_user_id(user_id, "journal_search")
    query_embedding = build_sparse_embedding(str(query or ""))

    results = []
    for score, row, entry_embedding in _rank_reflections(_fetch_reflections(supabase, user_id), str(query or ""))[:max(1, top_k)]:
        text = _entry_text(row)
        results.append(
            enforce_signal_shape(
                {
                    "date": str(row.get("for_date") or ""),
                    "emotion_signal": _emotion_signal(row, text),
                    "key_theme": _key_theme(query_embedding, entry_embedding),
                    "similarity_score": round(score, 3),
                },
                JOURNAL_SEARCH_SIGNAL_KEYS,
            )
        )
    return results


# ── TOOL 2: task_history ─────────────────────────────────────────────────────

TASK_HISTORY_SIGNAL_KEYS = {
    "completion_rate", "most_skipped_category", "streak",
    "last_completed_category", "pattern_signal",
}


def _completed(row: dict) -> bool:
    return bool(row.get("done")) or row.get("completion_state") == "completed"


def _streak_from_rows(rows: list[dict]) -> int:
    done_dates = sorted(
        {str(row.get("for_date")) for row in rows if _completed(row) and row.get("for_date")},
        reverse=True,
    )
    if not done_dates:
        return 0
    streak = 1
    for previous, current in zip(done_dates, done_dates[1:]):
        previous_date = date.fromisoformat(previous)
        current_date = date.fromisoformat(current)
        if (previous_date - current_date).days == 1:
            streak += 1
        else:
            break
    return streak


def task_history(user_id: str, days: int = 14, *, supabase) -> dict:
    """Behavioral signals from recent Loop tasks. Reuses the task agent's own
    fetchers read-only. Returns aggregates — never verbatim task titles."""
    user_id = require_user_id(user_id, "task_history")
    rows = _fetch_recent_tasks(supabase, user_id, days)

    skipped_categories = Counter(
        str(row.get("category") or "").lower()
        for row in rows
        if (row.get("skipped") or row.get("completion_state") == "skipped") and row.get("category")
    )
    completed_rows = [row for row in rows if _completed(row)]
    completed_rows.sort(key=lambda row: str(row.get("for_date") or ""), reverse=True)

    completion_rate = _fetch_completion_rate(rows)
    most_skipped = skipped_categories.most_common(1)[0][0] if skipped_categories else None
    last_completed = str(completed_rows[0].get("category") or "").lower() if completed_rows else None
    streak = _streak_from_rows(rows)

    if not rows:
        pattern_signal = "no recent task history"
    elif most_skipped and completion_rate >= 0.5:
        pattern_signal = f"completing most tasks but avoiding {most_skipped}"
    elif most_skipped:
        pattern_signal = f"low completion lately, skipping {most_skipped} most"
    elif completion_rate >= 0.7:
        pattern_signal = "completing consistently across categories"
    else:
        pattern_signal = "mixed completion, no single avoided category"

    return enforce_signal_shape(
        {
            "completion_rate": completion_rate,
            "most_skipped_category": most_skipped,
            "streak": streak,
            "last_completed_category": last_completed,
            "pattern_signal": pattern_signal,
        },
        TASK_HISTORY_SIGNAL_KEYS,
    )


# ── TOOL 3: pattern_check ────────────────────────────────────────────────────

PATTERN_MATCH_THRESHOLD = 0.12
PATTERN_SIGNAL_KEYS = {"frequency", "recency_days", "pattern_description"}


def pattern_check(user_id: str, current_emotion: str, *, supabase) -> dict:
    """Has this emotional state appeared in this user's journal before?
    Counts real matches only. {frequency: <2} with no description is a valid,
    honest return — this tool never invents a pattern."""
    user_id = require_user_id(user_id, "pattern_check")
    emotion = str(current_emotion or "").strip().lower()

    # Expand the query with the emotion's own lexicon so "stuck" also matches
    # entries that say "going nowhere". Still deterministic, still this
    # user's data only.
    query = " ".join([emotion, *EMOTION_LEXICON.get(emotion, [])])

    rows = _fetch_reflections(supabase, user_id)
    matched_ids: set = set()
    matched_rows: list[dict] = []

    for score, row, _embedding in _rank_reflections(rows, query):
        if score >= PATTERN_MATCH_THRESHOLD and row.get("id") not in matched_ids:
            matched_ids.add(row.get("id"))
            matched_rows.append(row)

    # Direct mood-label matches count too, even when the entry text is thin.
    for row in rows:
        if str(row.get("mood") or "").strip().lower() == emotion and row.get("id") not in matched_ids:
            matched_ids.add(row.get("id"))
            matched_rows.append(row)

    frequency = len(matched_rows)
    if frequency < 2:
        return enforce_signal_shape(
            {"frequency": frequency, "recency_days": None, "pattern_description": None},
            PATTERN_SIGNAL_KEYS,
        )

    match_dates = sorted(
        date.fromisoformat(str(row.get("for_date")))
        for row in matched_rows
        if row.get("for_date")
    )
    today = datetime.now(timezone.utc).date()
    recency_days = (today - match_dates[-1]).days if match_dates else None
    span_days = (match_dates[-1] - match_dates[0]).days if len(match_dates) > 1 else 0

    description = (
        f"'{emotion}' has appeared in {frequency} entries over the past "
        f"{max(span_days, 1)} days, most recently {recency_days} day(s) ago"
    )
    return enforce_signal_shape(
        {
            "frequency": frequency,
            "recency_days": recency_days,
            "pattern_description": description,
        },
        PATTERN_SIGNAL_KEYS,
    )


# ── TOOL 4: escalation_trigger ───────────────────────────────────────────────

ESCALATION_SIGNAL_TYPES = {"crisis", "persistent_distress", "self_harm_adjacent"}
MESSAGE_SNIPPET_MAX_CHARS = 50

SUPPORT_RESOURCES_SECTION = {
    "title": "Support that is there for you",
    "body": "You don't have to hold this alone. These are real people who can help right now.",
    "items": [
        "iCall (free, confidential): 9152987821",
        "Vandrevala Foundation (24/7): 1860-2662-345",
        "Emergency services: 112",
    ],
}

PERSISTENT_DISTRESS_REPLY = (
    "I hear how heavy this has been, and I'm not going anywhere. "
    "You don't have to solve any of it tonight — right now, one slow breath is enough. "
    "If this weight keeps sitting on you, talking to someone trained to help is a real option, not a defeat."
)


def _build_escalation_response(signal_type: str) -> tuple[dict, str]:
    if signal_type == "crisis":
        response = generate_life_companion_crisis_response()
        served = "crisis_warmth_v1"
    else:
        response = build_life_companion_response(
            reply=PERSISTENT_DISTRESS_REPLY,
            action_type="none",
            tone="serious",
            risk_level="medium",
            safety_message="Warmth first. No tasks, no analysis, no app routing on this turn.",
            reply_format="safety",
            intent="safety",
        )
        served = "distress_warmth_v1"

    sections = list(response.get("sections") or [])
    sections.append(SUPPORT_RESOURCES_SECTION)
    response["sections"] = sections
    return response, served


def escalation_trigger(user_id: str, signal_type: str, message_text: str, *, supabase) -> dict:
    """Routes a distress signal to the safety protocol. Serves the warmth-first
    response and writes the audit row. If the audit write fails, the safety
    response is STILL served — a logging failure must never block support.
    The failure is logged loudly instead."""
    user_id = require_user_id(user_id, "escalation_trigger")
    if signal_type not in ESCALATION_SIGNAL_TYPES:
        # Unknown severity: treat as the most serious, never the least.
        signal_type = "crisis"

    response, served = _build_escalation_response(signal_type)

    logged = False
    try:
        supabase.table("escalation_log").insert(
            {
                "user_id": user_id,
                "signal_type": signal_type,
                "message_snippet": str(message_text or "")[:MESSAGE_SNIPPET_MAX_CHARS],
                "response_served": served,
            }
        ).execute()
        logged = True
    except Exception as error:
        print(
            "COMPANION_ESCALATION "
            f"audit_write_failed=true user_id={user_id} signal_type={signal_type} "
            f"error_type={type(error).__name__} "
            f"at={datetime.now(timezone.utc).isoformat()}"
        )

    print(
        "COMPANION_ESCALATION "
        f"triggered=true user_id={user_id} signal_type={signal_type} logged={logged}"
    )
    return {"response": response, "signal_type": signal_type, "logged": logged}
