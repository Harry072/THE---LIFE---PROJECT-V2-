"""
Growth Tree intelligence — season engine + milestone detection.

Deterministic code only; nothing here calls an LLM. The tree is a mirror of
the user's actual week, computed from real behavioural and emotional data:

  CRISIS (sheltering)  — escalation in the last 2 days. Checked FIRST, fresh
                         on every request, never cached. A user in crisis
                         must never see a stale "you're doing great" tree.
  RETURNING (dawn)     — 4+ days away, active again today.
  RESTING (winter)     — 4+ days away, nothing today. Rest is a season,
                         not a failure.
  WEATHERING (rain)    — low completion, low energy, or 2-3 days absent.
  THRIVING (morning)   — the default, and the fail-safe: if the data layer
                         breaks, the tree stays calm rather than wrong.

Security patterns replicated from companion_security.py (not imported —
this module stands alone by design): user-id gating that raises, fail-open
data reads that log and degrade, and logs that carry counts and types but
never journal text.
"""

from __future__ import annotations

import time
import traceback
from datetime import datetime, timedelta, timezone


class GrowthTreeSecurityError(Exception):
    """Raised when a growth-tree function is invoked without a real user_id."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def require_user_id(user_id: object, caller: str) -> str:
    """Every entry point must carry a real user_id. Missing/blank raises —
    never proceeds silently. Stack logged so the call site is identifiable."""
    value = str(user_id or "").strip()
    if not value:
        print(
            "GROWTH_TREE "
            f"error=missing_user_id caller={caller}\n"
            + "".join(traceback.format_stack(limit=8))
        )
        raise GrowthTreeSecurityError(f"missing_user_id:{caller}")
    return value


# ── Canonical stage config ───────────────────────────────────────────────────
# Mirrors the 6-stage config in frontend/src/hooks/useGrowthTree.js exactly.
# This module is the single backend source of truth for stages.

STAGES = [
    {"id": 1, "name": "Seed", "min": 0, "max": 30},
    {"id": 2, "name": "Sprout", "min": 31, "max": 80},
    {"id": 3, "name": "Young Plant", "min": 81, "max": 180},
    {"id": 4, "name": "Small Tree", "min": 181, "max": 350},
    {"id": 5, "name": "Growing Tree", "min": 351, "max": 600},
    {"id": 6, "name": "Mature Tree", "min": 601, "max": None},
]

# Earned silence, not celebration. Seed has no message — you begin there;
# you never cross into it.
STAGE_MESSAGES = {
    "Sprout": "Something is taking root.",
    "Young Plant": "You're building real strength.",
    "Small Tree": "Your roots are deepening.",
    "Growing Tree": "The roots are deep enough now to hold storms.",
    "Mature Tree": "You've grown into something real. Most people never reach here.",
}

SEASONS = {
    "sheltering": {
        "message": "The tree stands through the storm. So do you.",
        "visual_hint": "storm",
    },
    "returning": {
        "message": "You came back. That's enough. The roots were waiting.",
        "visual_hint": "dawn",
    },
    "resting": {
        "message": "Rest is also a season. The roots are still holding.",
        "visual_hint": "winter",
    },
    "weathering": {
        "message": "Growth happens in the rain too. The roots deepen in resistance.",
        "visual_hint": "rain",
    },
    "thriving": {
        "message": "The roots deepen with every action.",
        "visual_hint": "morning",
    },
}

CRISIS_LOOKBACK_DAYS = 2       # escalation today or in the previous 2 days
ABSENCE_SEASON_THRESHOLD = 4   # returning/resting boundary
WEATHERING_RATE_THRESHOLD = 0.40
SEASON_CACHE_TTL_SECONDS = 30 * 60

# In-memory per-user cache: {user_id: (payload, monotonic_timestamp)}.
# Same simple dict+timestamp pattern as the module-level model singleton.
# Crisis and milestone checks always run fresh, outside this cache.
_season_cache: dict[str, tuple[dict, float]] = {}


def clear_season_cache() -> None:
    """Test hook / manual reset."""
    _season_cache.clear()


def stage_for_score(score: object) -> dict:
    """The stage a score sits in. Malformed/negative scores land in Seed."""
    try:
        value = int(score)
    except (TypeError, ValueError):
        value = 0
    value = max(0, value)
    for stage in STAGES:
        if stage["max"] is None or value <= stage["max"]:
            if value >= stage["min"]:
                return stage
    return STAGES[0]


def _utc_today():
    return datetime.now(timezone.utc).date()


def _parse_date(value: object):
    """DATE column or timestamp string → date, else None. Never raises."""
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


# ── Data reads (all user-scoped, all fail-open with logging) ─────────────────

def _fetch_crisis_flag(supabase, user_id: str) -> bool:
    """True if any companion_context row in the crisis window has
    escalation_triggered. This read is deliberately NOT cached and runs
    before everything else. On failure: False (no false alarms), logged."""
    since = (_utc_today() - timedelta(days=CRISIS_LOOKBACK_DAYS)).isoformat()
    try:
        rows = (
            supabase.table("companion_context")
            .select("date,escalation_triggered")
            .eq("user_id", user_id)
            .gte("date", since)
            .execute()
        ).data or []
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=crisis_check_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return False
    return any(row.get("escalation_triggered") for row in rows)


def _fetch_week_tasks(supabase, user_id: str) -> list[dict]:
    since = (_utc_today() - timedelta(days=6)).isoformat()
    rows = (
        supabase.table("loop_tasks")
        .select("for_date,completed_at,category")
        .eq("user_id", user_id)
        .gte("for_date", since)
        .execute()
    ).data or []
    return rows


ACTIVITY_LOG_FETCH_LIMIT = 21


def _fetch_active_dates(supabase, user_id: str) -> list:
    """Recent activity dates (newest first) from tree_daily_log — the
    activity ledger the scoring RPC maintains. A day counts as active if
    anything was completed (tasks_done) or awarded (points); the tasks_done
    check keeps the F8 award-0 era honest. Rows only exist for days with
    completions, so the newest rows ARE the most recent active days no
    matter how long the gap."""
    rows = (
        supabase.table("tree_daily_log")
        .select("for_date,points,tasks_done")
        .eq("user_id", user_id)
        .order("for_date", desc=True)
        .limit(ACTIVITY_LOG_FETCH_LIMIT)
        .execute()
    ).data or []

    active_dates = []
    for row in rows:
        points = row.get("points") or 0
        tasks_done = row.get("tasks_done") or 0
        if (points > 0 or tasks_done > 0):
            for_date = _parse_date(row.get("for_date"))
            if for_date is not None:
                active_dates.append(for_date)
    return active_dates


def _fetch_todays_energy(supabase, user_id: str):
    today = _utc_today().isoformat()
    rows = (
        supabase.table("companion_context")
        .select("energy_level")
        .eq("user_id", user_id)
        .eq("date", today)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return None
    value = str(rows[0].get("energy_level") or "").strip().lower()
    return value or None


def _fetch_user_tree(supabase, user_id: str) -> dict:
    rows = (
        supabase.table("user_tree")
        .select("cumulative_score,vitality,streak")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else {}


def _fetch_todays_points(supabase, user_id: str) -> int:
    """Points logged for UTC-today or later — gte, not eq, because
    for_date is user-local and can lead UTC by a day just after their
    midnight. A milestone must show the moment it is crossed."""
    today = _utc_today().isoformat()
    rows = (
        supabase.table("tree_daily_log")
        .select("points")
        .eq("user_id", user_id)
        .gte("for_date", today)
        .limit(3)
        .execute()
    ).data or []
    total = 0
    for row in rows:
        try:
            total += max(0, int(row.get("points") or 0))
        except (TypeError, ValueError):
            continue
    return total


def _fetch_reflections_count(supabase, user_id: str) -> int:
    """Real reflections count from the reflections table — the
    user_behavior.total_reflections column is dead (nothing writes it)."""
    response = (
        supabase.table("reflections")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    count = getattr(response, "count", None)
    if count is None:
        count = len(response.data or [])
    return int(count)


# ── Season computation ───────────────────────────────────────────────────────

def _season_payload(season: str, *, completion_rate, days_absent, energy_level,
                    crisis_active: bool) -> dict:
    definition = SEASONS[season]
    return {
        "season": season,
        "message": definition["message"],
        "visual_hint": definition["visual_hint"],
        "completion_rate": completion_rate,
        "days_absent": days_absent,
        "energy_level": energy_level,
        "crisis_active": crisis_active,
    }


def _fail_safe_payload() -> dict:
    """Thriving is the safe default — calm, never alarming, never wrong in a
    way that hurts. A broken season engine must never block or mislead."""
    return _season_payload(
        "thriving",
        completion_rate=None,
        days_absent=0,
        energy_level=None,
        crisis_active=False,
    )


def compute_season(supabase, user_id: str) -> dict:
    """The five-season decision, in strict priority order. Fail-open: any
    data-layer failure degrades to THRIVING (logged), never to an error."""
    user_id = require_user_id(user_id, "compute_season")

    # 1. CRISIS — always first, always fresh. Overrides everything.
    if _fetch_crisis_flag(supabase, user_id):
        print(f"GROWTH_TREE status=season user_id={user_id} season=sheltering")
        return _season_payload(
            "sheltering",
            completion_rate=None,
            days_absent=0,
            energy_level=None,
            crisis_active=True,
        )

    try:
        week_rows = _fetch_week_tasks(supabase, user_id)
        active_dates = _fetch_active_dates(supabase, user_id)
        energy_level = _fetch_todays_energy(supabase, user_id)
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=season_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return _fail_safe_payload()

    today = _utc_today()
    # >= not ==: for_date is the user's LOCAL calendar date while this
    # module runs on UTC — a just-after-midnight completion in a UTC+X
    # timezone is future-dated from here, and it is still today's activity.
    has_activity_today = any(d >= today for d in active_dates)

    # Absence is the gap BEFORE today: days since the most recent active
    # day that is not today. A first-ever completion today is a beginning,
    # not a return — no prior day means days_absent = 0.
    previous_active = next((d for d in active_dates if d < today), None)
    days_absent = (today - previous_active).days if previous_active else 0

    # Completion rate over the last 7 days, excluding today's still-pending
    # tasks — an unfinished morning is not rain yet.
    rate_total = 0
    rate_completed = 0
    for row in week_rows:
        for_date = _parse_date(row.get("for_date"))
        is_completed = bool(row.get("completed_at"))
        if for_date == today and not is_completed:
            continue
        rate_total += 1
        if is_completed:
            rate_completed += 1
    completion_rate = round(rate_completed / rate_total, 2) if rate_total else None

    # 2/3. RETURNING / RESTING — only meaningful with a real history.
    if previous_active is not None and days_absent >= ABSENCE_SEASON_THRESHOLD:
        season = "returning" if has_activity_today else "resting"
        print(f"GROWTH_TREE status=season user_id={user_id} season={season}")
        return _season_payload(
            season,
            completion_rate=completion_rate,
            days_absent=days_absent,
            energy_level=energy_level,
            crisis_active=False,
        )

    # 4. WEATHERING
    low_rate = completion_rate is not None and completion_rate < WEATHERING_RATE_THRESHOLD
    if low_rate or energy_level == "low" or 2 <= days_absent <= 3:
        print(f"GROWTH_TREE status=season user_id={user_id} season=weathering")
        return _season_payload(
            "weathering",
            completion_rate=completion_rate,
            days_absent=days_absent,
            energy_level=energy_level,
            crisis_active=False,
        )

    # 5. THRIVING — the default when no harder season applies.
    print(f"GROWTH_TREE status=season user_id={user_id} season=thriving")
    return _season_payload(
        "thriving",
        completion_rate=completion_rate,
        days_absent=days_absent,
        energy_level=energy_level,
        crisis_active=False,
    )


# ── Milestone detection ──────────────────────────────────────────────────────

def check_milestone_crossed(supabase, user_id: str) -> dict | None:
    """Did today's points push the user across a stage threshold?
    yesterday_total = cumulative_score - points_today; crossed when the
    stage id rose. Never raises — on any failure returns None (logged)."""
    user_id = require_user_id(user_id, "check_milestone_crossed")
    try:
        tree = _fetch_user_tree(supabase, user_id)
        current_score = max(0, int(tree.get("cumulative_score") or 0))
        points_today = _fetch_todays_points(supabase, user_id)
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=milestone_check_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return None

    if points_today <= 0:
        return None

    yesterday_total = max(0, current_score - points_today)
    current_stage = stage_for_score(current_score)
    previous_stage = stage_for_score(yesterday_total)
    if current_stage["id"] <= previous_stage["id"]:
        return None

    message = STAGE_MESSAGES.get(current_stage["name"])
    if not message:
        return None

    print(
        "GROWTH_TREE "
        f"status=milestone_crossed user_id={user_id} stage={current_stage['name']}"
    )
    return {
        "crossed": True,
        "stage_name": current_stage["name"],
        "stage_message": message,
    }


# ── Endpoint-facing assembly ─────────────────────────────────────────────────

def _build_stats_block(supabase, user_id: str) -> dict:
    """Score/stage/streak/reflections for the stat cards. Fail-open to a
    quiet empty block — stats going missing must never break the tree."""
    try:
        tree = _fetch_user_tree(supabase, user_id)
        score = max(0, int(tree.get("cumulative_score") or 0))
        streak = max(0, int(tree.get("streak") or 0))
        stage = stage_for_score(score)
        reflections_count = _fetch_reflections_count(supabase, user_id)
        return {
            "score": score,
            "stage_id": stage["id"],
            "stage_name": stage["name"],
            "streak": streak,
            "reflections_count": reflections_count,
        }
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=stats_fetch_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )
        return {
            "score": 0,
            "stage_id": 1,
            "stage_name": "Seed",
            "streak": 0,
            "reflections_count": 0,
        }


def get_season_payload(supabase, user_id: str) -> dict:
    """Full /season response: season (cached 30 min) + milestone and stats
    (always fresh — a crossing must show the moment it happens, and the
    crisis check inside compute_season always runs before the cache)."""
    user_id = require_user_id(user_id, "get_season_payload")

    # Crisis first — bypasses and never populates the cache.
    if _fetch_crisis_flag(supabase, user_id):
        payload = _season_payload(
            "sheltering",
            completion_rate=None,
            days_absent=0,
            energy_level=None,
            crisis_active=True,
        )
        payload["milestone"] = check_milestone_crossed(supabase, user_id)
        payload["stats"] = _build_stats_block(supabase, user_id)
        return payload

    cached = _season_cache.get(user_id)
    if cached is not None:
        season_part, stored_at = cached
        if (time.monotonic() - stored_at) < SEASON_CACHE_TTL_SECONDS:
            payload = dict(season_part)
            payload["milestone"] = check_milestone_crossed(supabase, user_id)
            payload["stats"] = _build_stats_block(supabase, user_id)
            return payload
        _season_cache.pop(user_id, None)

    season_part = compute_season(supabase, user_id)
    if not season_part.get("crisis_active"):
        _season_cache[user_id] = (dict(season_part), time.monotonic())

    payload = dict(season_part)
    payload["milestone"] = check_milestone_crossed(supabase, user_id)
    payload["stats"] = _build_stats_block(supabase, user_id)
    return payload


# ── Journey (Tree Memory timeline) ───────────────────────────────────────────

JOURNEY_MAX_ITEMS = 6
JOURNEY_EVENT_FETCH_LIMIT = 1000   # years of use at ≤4 score events/day
JOURNEY_LOG_FETCH_LIMIT = 400


def _journey_started_date(supabase, user_id: str):
    rows = (
        supabase.table("profiles")
        .select("created_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    ).data or []
    if rows:
        parsed = _parse_date(rows[0].get("created_at"))
        if parsed is not None:
            return parsed
    # Fallback: the first task row ever generated for this user.
    rows = (
        supabase.table("loop_tasks")
        .select("created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    ).data or []
    if rows:
        return _parse_date(rows[0].get("created_at"))
    return None


def _journey_first_completed_task(supabase, user_id: str):
    rows = (
        supabase.table("loop_tasks")
        .select("completed_at")
        .eq("user_id", user_id)
        .order("completed_at", desc=False)
        .limit(50)
        .execute()
    ).data or []
    for row in rows:
        parsed = _parse_date(row.get("completed_at"))
        if parsed is not None:
            return parsed
    return None


def _journey_first_reflection(supabase, user_id: str):
    rows = (
        supabase.table("reflections")
        .select("created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    ).data or []
    if rows:
        return _parse_date(rows[0].get("created_at"))
    return None


def _journey_first_companion_message(supabase, user_id: str):
    rows = (
        supabase.table("companion_messages")
        .select("created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    ).data or []
    if rows:
        return _parse_date(rows[0].get("created_at"))
    return None


def _stage_crossing_dates(supabase, user_id: str) -> dict:
    """First date each stage (2..6) was reached: exact from
    tree_score_events (each row carries running_total), reconstructed from
    tree_daily_log cumulative sums for history predating the audit table.
    A stage with no evidence in either source is simply absent — dates are
    never fabricated. A consistency guard drops any reconstruction that
    would put a lower stage AFTER a higher one."""
    crossings: dict[int, object] = {}

    # Exact crossings from the audit trail.
    events = (
        supabase.table("tree_score_events")
        .select("points_delta,running_total,for_date,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(JOURNEY_EVENT_FETCH_LIMIT)
        .execute()
    ).data or []
    for event in events:
        try:
            total = int(event.get("running_total") or 0)
            delta = int(event.get("points_delta") or 0)
        except (TypeError, ValueError):
            continue
        previous = total - delta
        event_date = _parse_date(event.get("for_date"))
        if event_date is None:
            continue
        for stage in STAGES[1:]:
            if stage["id"] in crossings:
                continue
            if previous < stage["min"] <= total:
                crossings[stage["id"]] = event_date

    # Reconstruction for stages still missing, from the daily aggregate.
    missing = [s for s in STAGES[1:] if s["id"] not in crossings]
    if missing:
        logs = (
            supabase.table("tree_daily_log")
            .select("for_date,points")
            .eq("user_id", user_id)
            .order("for_date", desc=False)
            .limit(JOURNEY_LOG_FETCH_LIMIT)
            .execute()
        ).data or []
        running = 0
        for row in logs:
            try:
                running += max(0, int(row.get("points") or 0))
            except (TypeError, ValueError):
                continue
            row_date = _parse_date(row.get("for_date"))
            if row_date is None:
                continue
            for stage in missing:
                if stage["id"] in crossings:
                    continue
                if running >= stage["min"]:
                    crossings[stage["id"]] = row_date

    # Consistency guard: stage dates must not decrease as stages rise.
    ordered_ids = sorted(crossings)
    for lower_id, higher_id in zip(ordered_ids, ordered_ids[1:]):
        if crossings[lower_id] > crossings[higher_id]:
            crossings.pop(lower_id, None)

    return crossings


def build_journey(supabase, user_id: str) -> list[dict]:
    """The Tree Memory timeline: real dated milestones, oldest→newest,
    capped at the most recent JOURNEY_MAX_ITEMS. Every source is
    individually fail-soft — a broken table skips its milestone (logged),
    it never breaks the journey. Missing data is skipped, never invented."""
    user_id = require_user_id(user_id, "build_journey")
    items: list[dict] = []

    sources = [
        ("started", _journey_started_date, "You started."),
        ("first_task", _journey_first_completed_task, "First task completed."),
        ("first_reflection", _journey_first_reflection, "First journal entry."),
        ("first_companion", _journey_first_companion_message,
         "First conversation with your companion."),
    ]
    for source_name, fetch, label in sources:
        try:
            milestone_date = fetch(supabase, user_id)
        except Exception as error:
            print(
                "GROWTH_TREE "
                f"status=journey_source_failed source={source_name} "
                f"user_id={user_id} error_type={type(error).__name__}"
            )
            continue
        if milestone_date is not None:
            items.append({"date": milestone_date.isoformat(), "label": label})

    try:
        crossings = _stage_crossing_dates(supabase, user_id)
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=journey_source_failed source=stage_crossings "
            f"user_id={user_id} error_type={type(error).__name__}"
        )
        crossings = {}
    stage_names = {stage["id"]: stage["name"] for stage in STAGES}
    for stage_id, crossing_date in crossings.items():
        items.append({
            "date": crossing_date.isoformat(),
            "label": f"{stage_names[stage_id]}.",
        })

    items.sort(key=lambda item: item["date"])
    if len(items) > JOURNEY_MAX_ITEMS:
        items = items[-JOURNEY_MAX_ITEMS:]
    return items


def get_score_payload(supabase, user_id: str) -> dict:
    """Canonical score read (Requirement 6). Raises on data failure — a
    score is a fact; serving invented zeros would be dishonest."""
    user_id = require_user_id(user_id, "get_score_payload")
    tree = _fetch_user_tree(supabase, user_id)
    score = max(0, int(tree.get("cumulative_score") or 0))
    stage = stage_for_score(score)
    return {
        "score": score,
        "stage_id": stage["id"],
        "stage_name": stage["name"],
        "vitality": max(0, min(100, int(tree.get("vitality") or 50))),
        "streak": max(0, int(tree.get("streak") or 0)),
    }
