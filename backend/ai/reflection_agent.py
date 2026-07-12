"""
Reflection Layer 3 — the Analysis Agent.

Runs silently after Layer 2 embeds a journal entry. Reads the entry
server-side, extracts emotional signals (one Groq call at temperature 0.2),
searches the user's own embedding history for a repeating feeling, stores
the analysis on the entry, and feeds the companion + the Layer 4
pattern-reveal flag. The user never sees any of this directly (G4) — it
surfaces only through the companion and the earned pattern reveal.

Guardrails:
  G1  distress blocks analysis — escalate, store blocked marker, stop
  G2  the LLM receives a sanitized 300-char summary only, never full text
  G3  pattern claims require frequency >= 2 AND similarity > 0.3 — silence
      is honest when the data is thin
  G4  analysis is never surfaced to the user directly
  G5  require_user_id() on entry — CompanionSecurityError when missing
  G6  extraction runs at temperature 0.2 — consistent, not creative

Everything security-critical is imported from the existing modules, never
reimplemented. Logs carry ids and lengths only — never entry text.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone

from .companion_agent import detect_distress
from .companion_security import (
    enforce_signal_shape,
    require_user_id,
    sanitize_untrusted_text,
)
from .companion_tools import _entry_text, escalation_trigger, task_history
from .groq_companion_gateway import (
    GROQ_OPENAI_BASE_URL,
    GROQ_QUALITY_COMPANION_MODEL,
    OpenAI,
    extract_groq_output_text,
    get_groq_companion_config,
)
from .journal_embeddings import embed_entry_task, match_journal_embeddings


EXTRACTION_TEMPERATURE = 0.2       # G6 — extraction must be consistent
SUMMARY_MAX_CHARS = 300            # G2 — the only text the LLM ever sees
EXTRACTION_MAX_TOKENS = 250
EXTRACTION_TIMEOUT_SECONDS = 12
PATTERN_SIMILARITY_THRESHOLD = 0.3  # G3
PATTERN_MIN_MATCHES = 2             # G3

ENERGY_LEVELS = {"low", "medium", "high"}
ENERGY_TO_TASK = {"low": "reset", "medium": "awareness", "high": "action"}

EXTRACTION_KEYS = {
    "primary_emotion", "energy_level", "surface_message",
    "signal", "what_avoided", "key_themes",
}

EXTRACTION_PROMPT = """You analyse a short journal summary. Respond ONLY with valid JSON. No markdown. No text outside the object.

{
  "primary_emotion": "one word",
  "energy_level": "low | medium | high",
  "surface_message": "what they literally said, 1 sentence",
  "signal": "the emotion underneath the words, 1 sentence",
  "what_avoided": "what they did not say but likely feel, 1 sentence",
  "key_themes": ["word1", "word2", "word3"]
}

Be specific to THIS summary. Never generic. If the summary is thin, say less rather than inventing more."""


# ── STEP 4 support: the one Groq call ────────────────────────────────────────

def _call_groq_extraction(summary: str) -> dict:
    """Raises on any failure — the caller stores the failure marker.
    Mirrors summarize_companion_session (the existing low-temperature
    precedent): same client, same model constant, same fence handling."""
    api_key, _ = get_groq_companion_config(prefer_quality=True)
    client = OpenAI(
        api_key=api_key,
        base_url=GROQ_OPENAI_BASE_URL,
        timeout=EXTRACTION_TIMEOUT_SECONDS,
        max_retries=0,
    )
    response = client.chat.completions.create(
        model=GROQ_QUALITY_COMPANION_MODEL,
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": summary},
        ],
        max_tokens=EXTRACTION_MAX_TOKENS,
        temperature=EXTRACTION_TEMPERATURE,
    )
    raw = extract_groq_output_text(response).strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


def _coerce_extraction(parsed: dict) -> dict:
    """The model's output is untrusted — coerce every field into its declared
    shape. enforce_signal_shape drops unknown keys and caps string lengths."""
    shaped = enforce_signal_shape(parsed or {}, EXTRACTION_KEYS)

    emotion_words = str(shaped.get("primary_emotion") or "").strip().lower().split()
    energy = str(shaped.get("energy_level") or "").strip().lower()
    themes = [
        str(theme).strip()[:40]
        for theme in (shaped.get("key_themes") or [])
        if str(theme).strip()
    ][:3]

    return {
        "primary_emotion": emotion_words[0] if emotion_words else "unspecified",
        "energy_level": energy if energy in ENERGY_LEVELS else "medium",
        "surface_message": str(shaped.get("surface_message") or ""),
        "signal": str(shaped.get("signal") or ""),
        "what_avoided": str(shaped.get("what_avoided") or ""),
        "key_themes": themes,
    }


# ── STEP 5 support: pattern search over the user's own history ───────────────

def _find_pattern(supabase, user_id: str, entry_id: str, summary: str) -> dict:
    """G3: a pattern exists only when >= 2 OTHER entries clear the similarity
    bar. Anything less returns honest silence — never an invented pattern."""
    matches = match_journal_embeddings(supabase, user_id, summary, top_k=5)
    strong = [
        match for match in matches
        if match.get("entry_id") != entry_id
        and float(match.get("similarity") or 0) > PATTERN_SIMILARITY_THRESHOLD
    ]
    if len(strong) < PATTERN_MIN_MATCHES:
        return {
            "pattern_detected": False,
            "pattern_description": None,
            "pattern_frequency": 0,
        }

    # match_journal_embeddings returns ids only — join dates in Python from
    # one user-scoped fetch (same idiom as the sweep).
    rows = (
        supabase.table("reflections")
        .select("id,for_date")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    ).data or []
    date_by_id = {row.get("id"): row.get("for_date") for row in rows}
    match_dates = sorted(
        date.fromisoformat(str(date_by_id[match["entry_id"]]))
        for match in strong
        if date_by_id.get(match["entry_id"])
    )

    frequency = len(strong)
    today = datetime.now(timezone.utc).date()
    if match_dates:
        span_days = max((today - match_dates[0]).days, 1)
        most_recent = match_dates[-1].isoformat()
    else:
        span_days = 1
        most_recent = "recently"

    description = (
        f"This feeling has appeared {frequency} times in the past "
        f"{span_days} days, most recently {most_recent}."
    )
    return {
        "pattern_detected": True,
        "pattern_description": description,
        "pattern_frequency": frequency,
    }


# ── STEP 6 support: store on the entry ───────────────────────────────────────

def _store_analysis(supabase, user_id: str, entry_id: str, payload: dict) -> bool:
    try:
        supabase.table("reflections").update(
            {"reflection_analysis": payload}
        ).eq("id", entry_id).eq("user_id", user_id).execute()
        return True
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=store_failed entry_id={entry_id} user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False


# ── STEP 7+8 support: merge-write to companion_context ──────────────────────

_FILL_IF_MISSING_FIELDS = (
    "primary_emotion", "energy_level", "pattern_summary", "task_recommendation",
)


def _merge_companion_context(supabase, user_id: str, updates: dict) -> bool:
    """The merge rule, implemented by OMISSION: a PostgREST upsert only
    touches the columns you send, so anything the companion already wrote is
    protected by simply not including that key. Crisis fields only ever move
    toward higher severity; pattern_detected only ever upgrades to true;
    pattern_reveal_pending is only ever set true here (Layer 4 clears it)."""
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        rows = (
            supabase.table("companion_context")
            .select("*")
            .eq("user_id", user_id)
            .eq("date", today)
            .limit(1)
            .execute()
        ).data or []
        existing = rows[0] if rows else {}

        merged: dict = {"user_id": user_id, "date": today}

        if existing.get("session_quality") == "crisis":
            pass  # highest severity already recorded — never touch it
        elif updates.get("session_quality"):
            merged["session_quality"] = updates["session_quality"]

        if bool(existing.get("escalation_triggered")) or bool(updates.get("escalation_triggered")):
            merged["escalation_triggered"] = True

        for field in _FILL_IF_MISSING_FIELDS:
            if existing.get(field) not in (None, ""):
                continue  # companion wrote it first — keep theirs
            if updates.get(field) not in (None, ""):
                merged[field] = updates[field]

        if bool(existing.get("pattern_detected")) or bool(updates.get("pattern_detected")):
            merged["pattern_detected"] = True

        if updates.get("pattern_reveal_pending"):
            merged["pattern_reveal_pending"] = True

        merged["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("companion_context").upsert(
            merged, on_conflict="user_id,date"
        ).execute()
        return True
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=context_merge_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False


# ── the agent ────────────────────────────────────────────────────────────────

def analyse_entry(supabase, user_id: str, entry_id: str) -> bool:
    """The full Layer 3 flow for one entry. Returns True only when a real
    analysis was stored. Raises only CompanionSecurityError (missing
    user_id, G5) — every other failure is logged and swallowed."""
    user_id = require_user_id(user_id, "reflection_agent")  # G5
    if not str(entry_id or "").strip():
        print("REFLECTION_AGENT status=missing_entry_id")
        return False

    # STEP 1 — FETCH (server-side only; the endpoint accepts no text)
    try:
        rows = (
            supabase.table("reflections")
            .select("id,for_date,content,questions")
            .eq("id", entry_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=fetch_failed entry_id={entry_id} user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False
    if not rows:
        print(
            "REFLECTION_AGENT "
            f"status=entry_not_found entry_id={entry_id} user_id={user_id}"
        )
        return False

    text = _entry_text(rows[0])
    if not text.strip():
        print(
            "REFLECTION_AGENT "
            f"status=skipped_empty entry_id={entry_id} user_id={user_id}"
        )
        return False

    analysed_at = datetime.now(timezone.utc).isoformat()

    # STEP 2 — DISTRESS CHECK (G1: on the FULL text, before any trimming —
    # a distress phrase at char 400 must still trigger)
    tier = detect_distress(text)
    if tier:
        escalation_trigger(user_id, tier, text, supabase=supabase)
        _store_analysis(
            supabase, user_id, entry_id,
            {"signal_type": tier, "analysis_blocked": True, "analysed_at": analysed_at},
        )
        # Your decision: the companion must know, today. Merge-safe — only
        # ever raises severity.
        _merge_companion_context(
            supabase, user_id,
            {"escalation_triggered": True, "session_quality": "crisis"},
        )
        print(
            "REFLECTION_AGENT "
            f"status=analysis_blocked tier={tier} entry_id={entry_id} "
            f"user_id={user_id} text_chars={len(text)}"
        )
        return False

    # STEP 3 — TEXT PREPARATION (G2)
    sanitized = sanitize_untrusted_text(text, source="reflection_agent", user_id=user_id)
    summary = sanitized.text[:SUMMARY_MAX_CHARS]
    if not summary.strip():
        print(
            "REFLECTION_AGENT "
            f"status=empty_after_sanitize entry_id={entry_id} user_id={user_id}"
        )
        return False

    # STEP 4 — EXTRACT (one Groq call, temperature 0.2)
    try:
        extraction = _coerce_extraction(_call_groq_extraction(summary))
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=extraction_failed entry_id={entry_id} user_id={user_id} "
            f"error_type={type(error).__name__} text_chars={len(text)}"
        )
        _store_analysis(
            supabase, user_id, entry_id,
            {"analysis_blocked": False, "extraction_failed": True, "analysed_at": analysed_at},
        )
        return False

    # STEP 5 — PATTERN SEARCH (G3)
    pattern = _find_pattern(supabase, user_id, entry_id, summary)

    # STEP 6 — STORE
    _store_analysis(
        supabase, user_id, entry_id,
        {
            **extraction,
            **pattern,
            "analysis_blocked": False,
            "analysed_at": analysed_at,
        },
    )

    # STEP 7 — FEED DOWNSTREAM (merge, never clobber)
    task_recommendation = None
    try:
        history = task_history(user_id, supabase=supabase)
        task_recommendation = history.get("most_skipped_category")
    except Exception:
        task_recommendation = None
    if not task_recommendation:
        task_recommendation = ENERGY_TO_TASK[extraction["energy_level"]]

    _merge_companion_context(
        supabase, user_id,
        {
            "primary_emotion": extraction["primary_emotion"],
            "energy_level": extraction["energy_level"],
            "pattern_detected": pattern["pattern_detected"],
            "pattern_summary": pattern["pattern_description"],
            "task_recommendation": task_recommendation,
            # STEP 8 — the Layer 4 handshake, true only on a confirmed pattern
            "pattern_reveal_pending": pattern["pattern_detected"],
        },
    )

    print(
        "REFLECTION_AGENT "
        f"status=analysed entry_id={entry_id} user_id={user_id} "
        f"emotion={extraction['primary_emotion']} energy={extraction['energy_level']} "
        f"pattern_detected={pattern['pattern_detected']} "
        f"pattern_frequency={pattern['pattern_frequency']} text_chars={len(text)}"
    )
    return True


# ── background-task wrappers ─────────────────────────────────────────────────

async def analyse_entry_task(supabase, user_id: str, entry_id: str) -> None:
    """Endpoint target. Never lets an exception kill the background task."""
    try:
        analyse_entry(supabase, user_id, entry_id)
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=task_failed entry_id={entry_id} user_id={user_id} "
            f"error_type={type(error).__name__}"
        )


async def embed_and_analyse_task(supabase, user_id: str, entry_id: str) -> None:
    """The Layer 2 -> Layer 3 trigger chain, composed HERE so
    journal_embeddings.py stays untouched. Analysis runs after the embed
    task completes; it doesn't depend on the embed's success because the
    pattern search matches against OTHER entries and excludes today's."""
    await embed_entry_task(supabase, user_id, entry_id)
    await analyse_entry_task(supabase, user_id, entry_id)


# ── Reflection Layer 4 — pattern reveal after task completion ───────────────
# companion_context is one row per (user_id, date) — a flag set true on
# Monday's row does not exist on Tuesday's row. "Show again tomorrow, max 3
# days" is implemented by scanning the last 4 days for the most recent
# pending row, rather than reading only today's exact row.

REVEAL_WINDOW_DAYS = 3  # a pending row older than this auto-clears instead of showing
CONTEXT_ROW_FETCH_LIMIT = 10  # generous lookback so a stale flag is still FOUND (then expired)
PATTERN_REVEAL_QUESTION = "What do you think is underneath that?"
BACKING_ENTRY_FETCH_LIMIT = 200


def _find_pending_context_row(supabase, user_id: str) -> dict | None:
    """The most recent companion_context row with pattern_reveal_pending=true,
    or None. Deliberately NOT bounded to the last REVEAL_WINDOW_DAYS days —
    the expiry check in find_pending_reveal needs to actually SEE a stale row
    to clear it; a fetch-side lower bound using the same constant would make
    that check unreachable (anything old enough to expire would never be
    fetched in the first place). Shared by find_pending_reveal and
    clear_pending_reveal so both act on the same row."""
    today = datetime.now(timezone.utc).date()
    try:
        rows = (
            supabase.table("companion_context")
            .select("*")
            .eq("user_id", user_id)
            .lte("date", today.isoformat())
            .order("date", desc=True)
            .limit(CONTEXT_ROW_FETCH_LIMIT)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=reveal_lookup_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return None
    for row in rows:
        if row.get("pattern_reveal_pending"):
            return row
    return None


def _fetch_backing_entry(supabase, user_id: str) -> dict | None:
    """This user's most recent journal entry whose analysis actually
    confirmed a pattern. Filtered in Python (same idiom as
    _find_pattern) — never trust a JSONB path filter's PostgREST syntax
    over the client when a plain fetch-and-filter is just as cheap here."""
    try:
        rows = (
            supabase.table("reflections")
            .select("id,reflection_analysis,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(BACKING_ENTRY_FETCH_LIMIT)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=backing_entry_lookup_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return None
    for row in rows:
        analysis = row.get("reflection_analysis") or {}
        if analysis.get("pattern_detected") is True:
            return row
    return None


def find_pending_reveal(supabase, user_id: str) -> dict:
    """The CHECK step. Returns {pending, description, question}. Never
    raises — a broken reveal check must degrade to 'no reveal', never to a
    500 blocking task completion."""
    user_id = require_user_id(user_id, "find_pending_reveal")
    not_pending = {"pending": False, "description": None, "question": None}

    row = _find_pending_context_row(supabase, user_id)
    if row is None:
        return not_pending

    today = datetime.now(timezone.utc).date()
    row_date = date.fromisoformat(str(row["date"]))
    if (today - row_date).days > REVEAL_WINDOW_DAYS:
        # Expired — auto-clear instead of showing, per the 3-day rule.
        try:
            supabase.table("companion_context").update(
                {"pattern_reveal_pending": False}
            ).eq("user_id", user_id).eq("date", row["date"]).execute()
            print(
                "REFLECTION_AGENT "
                f"status=reveal_expired_autocleared user_id={user_id} "
                f"row_date={row['date']}"
            )
        except Exception as error:
            print(
                "REFLECTION_AGENT "
                f"status=reveal_autoclear_failed user_id={user_id} "
                f"error_type={type(error).__name__}"
            )
        return not_pending

    entry = _fetch_backing_entry(supabase, user_id)
    if entry is None:
        # Flag says a pattern exists but no entry backs it (data drift) —
        # fail closed rather than show an empty reveal.
        print(
            "REFLECTION_AGENT "
            f"status=reveal_pending_but_no_backing_entry user_id={user_id}"
        )
        return not_pending

    description = (entry.get("reflection_analysis") or {}).get("pattern_description")
    if not description:
        return not_pending

    try:
        supabase.table("companion_context").update(
            {"reveal_shown_count": int(row.get("reveal_shown_count") or 0) + 1}
        ).eq("user_id", user_id).eq("date", row["date"]).execute()
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=shown_count_update_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )

    print(
        "REFLECTION_AGENT "
        f"status=reveal_shown user_id={user_id} row_date={row['date']}"
    )
    return {"pending": True, "description": description, "question": PATTERN_REVEAL_QUESTION}


def clear_pending_reveal(supabase, user_id: str) -> bool:
    """The 'Show me' action. Clears pattern_reveal_pending on the actual
    pending row (which may be a few days old), not blindly today's row.
    Never raises."""
    user_id = require_user_id(user_id, "clear_pending_reveal")
    row = _find_pending_context_row(supabase, user_id)
    if row is None:
        return False
    try:
        supabase.table("companion_context").update(
            {"pattern_reveal_pending": False}
        ).eq("user_id", user_id).eq("date", row["date"]).execute()
        print(
            "REFLECTION_AGENT "
            f"status=reveal_seen user_id={user_id} row_date={row['date']}"
        )
        return True
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=reveal_clear_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False
