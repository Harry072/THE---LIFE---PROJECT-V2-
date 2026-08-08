"""
Master orchestrator — one deterministic payload that drives the dashboard.

Zero LLM calls. Reads real signals (companion_context, loop_tasks,
reflections, curator_interactions, companion_messages, profiles), calls the
season engine (never copies it), and returns a single payload: display name,
greeting line, daily quote, season, primary action, ordered feature cards,
founder-note flag, and today's task state.

Safety posture (same conventions as growth_tree_intelligence.py):
  • user_id comes from the caller's validated token only
  • every read is user-scoped and individually fail-soft
  • payload cached 15 minutes per user; the crisis check runs fresh on
    every request and bypasses the cache
  • on ANY failure the SAFE DEFAULT payload is returned — the dashboard
    always renders, never errors
  • logs carry status/counts/error types, never journal text
"""

from __future__ import annotations

import time
import traceback
from datetime import datetime, timedelta, timezone

from ai.growth_tree_intelligence import check_milestone_crossed, compute_season


class OrchestratorSecurityError(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def require_user_id(user_id: object, caller: str) -> str:
    value = str(user_id or "").strip()
    if not value:
        print(
            "MASTER_ORCHESTRATOR "
            f"error=missing_user_id caller={caller}\n"
            + "".join(traceback.format_stack(limit=8))
        )
        raise OrchestratorSecurityError(f"missing_user_id:{caller}")
    return value


# ── Constants ────────────────────────────────────────────────────────────────

DAILY_QUOTES = [
    "The tree does not apologise for growing slowly.",
    "One step is not nothing. It is the thing.",
    "Stillness is not stopping. It is preparing.",
    "The roots hold even when the branches bend.",
    "You do not need to feel ready. You need to begin.",
    "What you return to is telling you something.",
    "Small and consistent outlasts large and occasional.",
    "The direction matters more than the speed.",
    "Rest taken honestly is not time lost.",
    "The person you are becoming is watching.",
    "What you avoid is usually what you need.",
    "Clarity comes after the action, not before.",
    "You have survived every hard day until now.",
    "Growth happens in the invisible seasons too.",
]

# Greeting LINES only — the client composes the time-of-day salutation
# ("Good evening, Harpreet.") locally, so the server never claims a time
# of day it cannot know.
GREETING_LINES = {
    "crisis": "You don't have to do much today.",
    "returning": "You came back. That's the thing.",
    "momentum": "The momentum is real.",
    "low_energy": "Take it easy today.",
    "pattern": "Something worth looking at today.",
    "first_session": "This is yours now.",
    "default": "Take it one step at a time.",
}

FEATURE_META = {
    "loop": {"icon_key": "loop", "route": "/loop", "cta_text": "Open The Loop"},
    "companion": {"icon_key": "chat", "route": "/companion", "cta_text": "Open Companion"},
    "reflection": {"icon_key": "pen", "route": "/reflection", "cta_text": "Open Reflection"},
    "tree": {"icon_key": "sprout", "route": "/progress", "cta_text": "See your tree"},
    "curator": {"icon_key": "books", "route": "/curator", "cta_text": "Open Curator"},
    "reset": {"icon_key": "meditate", "route": "/meditation", "cta_text": "Open Reset Space"},
}

PRIMARY_ACTION_SUBS = {
    "loop": "Two small actions, built from your signals.",
    "companion": "No agenda. Just a conversation.",
    "reset": "Settle your system first.",
    "reflection": "One honest line is enough.",
    "tree": "See what your consistency built.",
    "curator": "Something matched to your direction.",
}

# First matching rule wins (checked in this order).
ORDERINGS = {
    "crisis": ["companion", "reset", "reflection", "tree", "loop", "curator"],
    "low_energy": ["reset", "companion", "reflection", "tree", "loop", "curator"],
    "pattern_done": ["tree", "companion", "reflection", "loop", "curator", "reset"],
    "momentum": ["loop", "curator", "tree", "companion", "reflection", "reset"],
    "returning": ["companion", "loop", "reflection", "tree", "reset", "curator"],
    "default": ["loop", "companion", "reflection", "tree", "curator", "reset"],
}

CRISIS_LOOKBACK_DAYS = 2          # matches the season engine's window
REVEAL_LOOKBACK_DAYS = 3          # matches Layer 4's reveal window
CURATOR_ACTIVE_BOOK_WINDOW_DAYS = 14
DASHBOARD_CACHE_TTL_SECONDS = 15 * 60

_dashboard_cache: dict[str, tuple[dict, float]] = {}


def clear_dashboard_cache() -> None:
    _dashboard_cache.clear()


def _utc_today():
    return datetime.now(timezone.utc).date()


def _parse_date(value: object):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


# ── Display name ─────────────────────────────────────────────────────────────

def clean_display_name(raw: object) -> str:
    """Strip digits and separator noise, collapse spaces, capitalise the
    first letter. '1har4y09' → 'Hary'; 'harpreet' → 'Harpreet'. Empty when
    nothing human remains."""
    import re
    text = re.sub(r"[0-9_.\-]+", "", str(raw or ""))
    text = " ".join(text.split()).strip()
    if not text:
        return ""
    return text[0].upper() + text[1:]


def resolve_display_name(supabase, user_id: str) -> str:
    """profiles name column (absent today — tolerated) → auth metadata
    full_name → username → email prefix, each cleaned; final fallback
    'there'. Every step fail-soft."""
    try:
        rows = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user_id)
            .limit(1)
            .execute()
        ).data or []
        if rows:
            for column in ("display_name", "full_name"):
                cleaned = clean_display_name(rows[0].get(column))
                if cleaned:
                    return cleaned
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=profiles_name_lookup_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )

    try:
        response = supabase.auth.admin.get_user_by_id(user_id)
        auth_user = getattr(response, "user", None)
        metadata = getattr(auth_user, "user_metadata", None) or {}
        for key in ("full_name", "username"):
            cleaned = clean_display_name(metadata.get(key))
            if cleaned:
                return cleaned
        email = str(getattr(auth_user, "email", "") or "")
        if "@" in email:
            cleaned = clean_display_name(email.split("@")[0])
            if cleaned:
                return cleaned
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=auth_name_lookup_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )

    return "there"


# ── Quote rotation ───────────────────────────────────────────────────────────

def todays_quote(now=None) -> str:
    moment = now or datetime.now(timezone.utc)
    index = (moment.weekday() + moment.isocalendar().week) % len(DAILY_QUOTES)
    return DAILY_QUOTES[index]


# ── Signal reads (each fail-soft) ────────────────────────────────────────────

def _fetch_crisis_flag(supabase, user_id: str) -> bool:
    since = (_utc_today() - timedelta(days=CRISIS_LOOKBACK_DAYS)).isoformat()
    try:
        rows = (
            supabase.table("companion_context")
            .select("date,escalation_triggered")
            .eq("user_id", user_id)
            .gte("date", since)
            .execute()
        ).data or []
        return any(row.get("escalation_triggered") for row in rows)
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=crisis_check_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False


def _fetch_context_signals(supabase, user_id: str) -> dict:
    """Today's energy + pattern flags, and reveal-pending over the Layer-4
    window. Read-only — never via find_pending_reveal (it mutates counts)."""
    since = (_utc_today() - timedelta(days=REVEAL_LOOKBACK_DAYS)).isoformat()
    signals = {"energy_level": None, "pattern_detected": False, "reveal_pending": False}
    try:
        rows = (
            supabase.table("companion_context")
            .select("date,energy_level,pattern_detected,pattern_reveal_pending")
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=True)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=context_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return signals

    today = _utc_today().isoformat()
    for row in rows:
        if row.get("pattern_reveal_pending"):
            signals["reveal_pending"] = True
        if str(row.get("date")) == today:
            energy = str(row.get("energy_level") or "").strip().lower()
            signals["energy_level"] = energy or None
            signals["pattern_detected"] = bool(row.get("pattern_detected"))
    return signals


def _fetch_tasks_today(supabase, user_id: str) -> dict:
    """Same core-task classification the scoring RPC uses.

    KNOWN ISSUE, logged not fixed (found during Loop Feature: Expert
    Implementation, Part 4): the `core` filter below only recognizes
    category in ("awareness", "action", "meaning") — three values, and
    "meaning" is the pre-five-category name normalize_loop_category now
    maps to "growth" on the frontend. "reflection" and "reset" are missing
    entirely. Since the Loop only ever generates CORE_CATEGORY_ORDER's
    2-of-5 categories per day (main.py:_RETRIEVAL_TASK_COUNT), this
    all_done/total/completed computation can undercount or overcount
    depending on which 2 categories today's tasks happen to be — the same
    class of bug Fix 4 found and fixed in TheLoopPage.jsx's own allDone.
    Every caller of this function's all_done value inherits the bug.
    Deliberately not fixed here — this file has been treated as read-only
    all session; flagging for a dedicated pass.
    """
    today = _utc_today().isoformat()
    result = {"total": 0, "completed": 0, "all_done": False, "all_skipped": False}
    try:
        rows = (
            supabase.table("loop_tasks")
            .select("completed_at,skipped,category")
            .eq("user_id", user_id)
            .eq("for_date", today)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=tasks_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return result

    core = [r for r in rows if str(r.get("category") or "") in ("awareness", "action", "meaning")]
    total = len(core)
    completed = sum(1 for r in core if r.get("completed_at"))
    skipped = sum(1 for r in core if r.get("skipped"))
    result["total"] = total
    result["completed"] = completed
    result["all_done"] = total > 0 and completed >= total
    result["all_skipped"] = total > 0 and completed == 0 and skipped >= total
    return result


def _fetch_reflection_signals(supabase, user_id: str) -> dict:
    signals = {"entry_today": False, "days_since_entry": None}
    try:
        rows = (
            supabase.table("reflections")
            .select("created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=reflection_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return signals
    if rows:
        last_date = _parse_date(rows[0].get("created_at"))
        if last_date is not None:
            today = _utc_today()
            signals["entry_today"] = last_date >= today
            signals["days_since_entry"] = max(0, (today - last_date).days)
    return signals


def _fetch_curator_book(supabase, user_id: str):
    """Most recent saved/opened book within the active window → book_id."""
    try:
        rows = (
            supabase.table("curator_interactions")
            .select("book_id,action_type,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=curator_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return None
    cutoff = _utc_today() - timedelta(days=CURATOR_ACTIVE_BOOK_WINDOW_DAYS)
    for row in rows:
        if str(row.get("action_type")) not in ("book_saved", "book_opened"):
            continue
        if not row.get("book_id"):
            continue
        row_date = _parse_date(row.get("created_at"))
        if row_date is not None and row_date >= cutoff:
            return str(row.get("book_id"))
        break  # most recent qualifying interaction is too old
    return None


def _fetch_companion_session_today(supabase, user_id: str) -> bool:
    since = f"{_utc_today().isoformat()}T00:00:00+00:00"
    try:
        response = (
            supabase.table("companion_messages")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", since)
            .execute()
        )
        count = getattr(response, "count", None)
        if count is None:
            count = len(response.data or [])
        return int(count) > 0
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=companion_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False


def _fetch_signup_signals(supabase, user_id: str) -> dict:
    signals = {"first_session": False, "days_since_signup": None}
    try:
        rows = (
            supabase.table("profiles")
            .select("created_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=signup_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return signals
    if rows:
        created = _parse_date(rows[0].get("created_at"))
        if created is not None:
            today = _utc_today()
            signals["days_since_signup"] = max(0, (today - created).days)
            signals["first_session"] = created == today
    return signals


# ── Assembly ─────────────────────────────────────────────────────────────────

def _choose_greeting(signals: dict) -> tuple[str, str]:
    """Returns (line, prefix_mode). prefix_mode: 'time_of_day' | 'welcome'."""
    if signals["crisis_active"]:
        return GREETING_LINES["crisis"], "time_of_day"
    if signals["season"].get("season") == "returning":
        return GREETING_LINES["returning"], "time_of_day"
    rate = signals["season"].get("completion_rate")
    if signals["energy_level"] == "high" and rate is not None and rate > 0.60:
        return GREETING_LINES["momentum"], "time_of_day"
    if signals["energy_level"] == "low":
        return GREETING_LINES["low_energy"], "time_of_day"
    if signals["pattern_detected"] or signals["reveal_pending"]:
        return GREETING_LINES["pattern"], "time_of_day"
    if signals["first_session"]:
        return GREETING_LINES["first_session"], "welcome"
    return GREETING_LINES["default"], "time_of_day"


def _choose_ordering(signals: dict) -> list[str]:
    if signals["crisis_active"]:
        return ORDERINGS["crisis"]
    if signals["energy_level"] == "low":
        return ORDERINGS["low_energy"]
    if signals["reveal_pending"] and signals["tasks"]["all_done"]:
        return ORDERINGS["pattern_done"]
    rate = signals["season"].get("completion_rate")
    if signals["energy_level"] == "high" and rate is not None and rate > 0.80:
        return ORDERINGS["momentum"]
    if signals["season"].get("season") == "returning":
        return ORDERINGS["returning"]
    return ORDERINGS["default"]


def _feature_headline(feature: str, signals: dict) -> str:
    tasks = signals["tasks"]
    season_name = signals["season"].get("season")
    if feature == "loop":
        if tasks["all_done"]:
            return "Done. The tree grew today."
        if tasks["all_skipped"]:
            return "Still here when you're ready."
        if tasks["total"] > 0:
            return "Your task for today is ready."
        return "Ready when you are."
    if feature == "companion":
        if signals["crisis_active"]:
            return "Come talk. No agenda."
        if signals["pattern_detected"] or signals["reveal_pending"]:
            return "Something worth exploring."
        if signals["companion_session_today"]:
            return "Your companion heard you today."
        return "Your companion is listening."
    if feature == "reflection":
        if signals["reveal_pending"]:
            return "Something noticed in your writing."
        if signals["reflection"]["entry_today"]:
            return "You wrote today. That counts."
        days = signals["reflection"]["days_since_entry"]
        if days is not None and days > 3:
            return "The journal is still here."
        return "Write one honest line today."
    if feature == "tree":
        if signals["milestone"]:
            return "Something changed today."
        if season_name == "resting":
            return "Rest is also growth."
        if season_name == "returning":
            return "The roots were waiting."
        return "Your tree is growing."
    if feature == "curator":
        return "Something worth reading today."
    if feature == "reset":
        if signals["crisis_active"]:
            return "A quiet space is here for you."
        if signals["energy_level"] == "low":
            return "This might help right now."
        return "A place to reset when needed."
    return ""


def build_safe_default() -> dict:
    ordering = ORDERINGS["default"]
    return {
        "user_display_name": "there",
        "greeting": GREETING_LINES["default"],
        "greeting_prefix": "time_of_day",
        "daily_quote": DAILY_QUOTES[1],
        "season": {
            "season": "thriving",
            "message": "The roots deepen with every action.",
            "visual_hint": "morning",
        },
        "primary_action": {
            "feature": "loop",
            "headline": "Your task for today is ready.",
            "sub": PRIMARY_ACTION_SUBS["loop"],
            "cta_text": "Open The Loop",
            "cta_route": "/loop",
        },
        "feature_cards": [
            {
                "feature": feature,
                "icon_key": FEATURE_META[feature]["icon_key"],
                "headline": "",
                "priority": index + 1,
                "route": FEATURE_META[feature]["route"],
            }
            for index, feature in enumerate(ordering)
        ],
        "show_founder_note": False,
        "tasks_today": {"total": 0, "completed": 0, "all_done": False},
    }


def _build_payload(supabase, user_id: str, crisis_active: bool) -> dict:
    season = compute_season(supabase, user_id)  # fail-safe internally
    milestone = check_milestone_crossed(supabase, user_id)
    context = _fetch_context_signals(supabase, user_id)
    tasks = _fetch_tasks_today(supabase, user_id)
    reflection = _fetch_reflection_signals(supabase, user_id)
    curator_book_id = _fetch_curator_book(supabase, user_id)
    companion_today = _fetch_companion_session_today(supabase, user_id)
    signup = _fetch_signup_signals(supabase, user_id)

    signals = {
        "crisis_active": crisis_active,
        "season": season,
        "milestone": milestone,
        "energy_level": context["energy_level"],
        "pattern_detected": context["pattern_detected"],
        "reveal_pending": context["reveal_pending"],
        "tasks": tasks,
        "reflection": reflection,
        "companion_session_today": companion_today,
        "first_session": signup["first_session"],
    }

    greeting, greeting_prefix = _choose_greeting(signals)
    ordering = _choose_ordering(signals)

    feature_cards = []
    for index, feature in enumerate(ordering):
        card = {
            "feature": feature,
            "icon_key": FEATURE_META[feature]["icon_key"],
            "headline": _feature_headline(feature, signals),
            "priority": index + 1,
            "route": FEATURE_META[feature]["route"],
        }
        if feature == "curator" and curator_book_id:
            card["book_id"] = curator_book_id
        feature_cards.append(card)

    primary_feature = ordering[0]
    primary_action = {
        "feature": primary_feature,
        "headline": _feature_headline(primary_feature, signals),
        "sub": PRIMARY_ACTION_SUBS[primary_feature],
        "cta_text": FEATURE_META[primary_feature]["cta_text"],
        "cta_route": FEATURE_META[primary_feature]["route"],
    }

    days_since = signup["days_since_signup"]
    show_founder_note = bool(
        signup["first_session"]
        or (days_since is not None and days_since > 0 and days_since % 7 == 0)
    )

    print(
        "MASTER_ORCHESTRATOR "
        f"status=payload_built user_id={user_id} "
        f"season={season.get('season')} primary={primary_feature} "
        f"crisis={crisis_active}"
    )

    return {
        "user_display_name": resolve_display_name(supabase, user_id),
        "greeting": greeting,
        "greeting_prefix": greeting_prefix,
        "daily_quote": todays_quote(),
        "season": season,
        "primary_action": primary_action,
        "feature_cards": feature_cards,
        "show_founder_note": show_founder_note,
        "tasks_today": {
            "total": tasks["total"],
            "completed": tasks["completed"],
            "all_done": tasks["all_done"],
        },
    }


def get_dashboard_payload(supabase, user_id: str) -> dict:
    """The endpoint-facing entry. Crisis check fresh every request (bypasses
    the cache); non-crisis payloads cached 15 minutes; ANY failure returns
    the safe default. Never raises past this function except for a missing
    user_id (a programming error, not a data problem)."""
    user_id = require_user_id(user_id, "get_dashboard_payload")

    crisis_active = _fetch_crisis_flag(supabase, user_id)

    if not crisis_active:
        cached = _dashboard_cache.get(user_id)
        if cached is not None:
            payload, stored_at = cached
            if (time.monotonic() - stored_at) < DASHBOARD_CACHE_TTL_SECONDS:
                return payload
            _dashboard_cache.pop(user_id, None)

    try:
        payload = _build_payload(supabase, user_id, crisis_active)
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=payload_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return build_safe_default()

    if not crisis_active:
        _dashboard_cache[user_id] = (payload, time.monotonic())
    return payload
