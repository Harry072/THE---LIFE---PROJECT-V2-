"""
Task Intelligence Layer — Phase 2 of the Loop upgrade.

Builds a rich reasoning context for each user BEFORE the Gemini call so that
every generated task is the output of real reasoning about a specific human on
a specific day, never a template.

All data reads go through EXISTING Supabase tables — no new tables created.
Functions are synchronous to match the existing endpoint pattern.
"""

from __future__ import annotations

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta


# ── Onboarding option → Ikigai quadrant ──────────────────────────────────────
# "mission" = need for meaning + direction
# "profession" = need for action + skill
# "passion" = need to reconnect with what energises them
# "vocation" = need to contribute to the world

FOCUS_AREA_TO_QUADRANT: dict[str, str] = {
    "i feel lost":                  "mission",
    "i feel empty inside":          "mission",
    "i can't stop scrolling":       "passion",
    "i overthink everything":       "passion",
    "i have no motivation":         "vocation",
    "i can't sleep":                "passion",
    "i keep starting and quitting": "profession",
    "i don't know who i am":        "mission",
    "i feel completely alone":      "mission",
    # Synonyms / partial matches users sometimes enter
    "i procrastinate":              "profession",
    "i feel anxious":               "passion",
    "i feel stuck":                 "vocation",
    "i lack discipline":            "profession",
    "i feel disconnected":          "mission",
}

# ── Onboarding option → likely inner_work_layer priorities ───────────────────
# Values are ordered: first element is the PRIMARY layer to address.

FOCUS_AREA_TO_INNER_LAYER: dict[str, list[str]] = {
    "i feel lost":                  ["distraction", "acceptance"],
    "i feel empty inside":          ["attachment", "acceptance"],
    "i can't stop scrolling":       ["distraction", "ego"],
    "i overthink everything":       ["attachment", "ego"],
    "i have no motivation":         ["distraction", "acceptance"],
    "i can't sleep":                ["attachment", "distraction"],
    "i keep starting and quitting": ["distraction", "ego"],
    "i don't know who i am":        ["attachment", "acceptance"],
    "i feel completely alone":      ["attachment", "acceptance"],
    "i procrastinate":              ["distraction", "ego"],
    "i feel anxious":               ["attachment", "acceptance"],
    "i feel stuck":                 ["ego", "acceptance"],
    "i lack discipline":            ["distraction", "ego"],
    "i feel disconnected":          ["attachment", "acceptance"],
}


# ── Journey phase from days active ───────────────────────────────────────────

def _phase_from_days(days_active: int) -> str:
    if days_active <= 14:
        return "foundation"
    if days_active <= 45:
        return "recognition"
    return "integration"


# ── Primary Ikigai quadrant from focus areas ─────────────────────────────────

def _quadrant_from_focus_areas(focus_areas: list[str]) -> str:
    for area in focus_areas:
        q = FOCUS_AREA_TO_QUADRANT.get(area.lower().strip())
        if q:
            return q
    return "mission"


# ── Inner layer focus from focus areas ───────────────────────────────────────

def _inner_layers_from_focus_areas(focus_areas: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for area in focus_areas:
        layers = FOCUS_AREA_TO_INNER_LAYER.get(area.lower().strip(), [])
        for layer in layers:
            if layer not in seen:
                seen.add(layer)
                result.append(layer)
    return result


# ── Data helpers (all read from existing tables) ──────────────────────────────

def _fetch_days_active(supabase, user_id: str) -> int:
    """Count of distinct dates the user has had any Loop task."""
    try:
        rows = (
            supabase.table("loop_tasks")
            .select("for_date")
            .eq("user_id", user_id)
            .eq("is_optional", False)
            .execute()
        ).data or []
        return len({r["for_date"] for r in rows if r.get("for_date")})
    except Exception:
        return 0


def _fetch_recent_tasks(supabase, user_id: str, days: int = 14) -> list[dict]:
    """
    Fetch recent core tasks for non-repetition analysis.
    Primary SELECT includes the 4 intelligence columns. If they don't exist yet
    (pre-migration), PostgREST returns HTTP 400 → caught → falls back to the safe
    query without those columns. After migration the primary path succeeds and
    supplies full context. None values in the context builder are handled gracefully.
    """
    since = (date.today() - timedelta(days=days)).isoformat()
    select_cols = (
        "title,category,done,skipped,for_date,"
        "framework_key,kotler_tag,completion_state,skip_reason_label,"
        "inner_work_layer,approach_angle,journey_phase,ikigai_quadrant"
    )
    try:
        rows = (
            supabase.table("loop_tasks")
            .select(select_cols)
            .eq("user_id", user_id)
            .eq("is_optional", False)
            .gte("for_date", since)
            .order("for_date", desc=True)
            .limit(70)
            .execute()
        ).data or []
        return rows
    except Exception:
        # Fallback for pre-migration databases where intelligence columns don't exist
        try:
            rows = (
                supabase.table("loop_tasks")
                .select("title,category,done,skipped,for_date,framework_key,kotler_tag,completion_state,skip_reason_label")
                .eq("user_id", user_id)
                .eq("is_optional", False)
                .gte("for_date", since)
                .order("for_date", desc=True)
                .limit(70)
                .execute()
            ).data or []
            return rows
        except Exception:
            return []


def _fetch_completion_rate(recent_tasks: list[dict]) -> float:
    """Completion rate from the recent task window (0.0–1.0)."""
    if not recent_tasks:
        return 0.0
    completed = sum(1 for t in recent_tasks if t.get("done") or t.get("completion_state") == "completed")
    return round(completed / len(recent_tasks), 2)


def _fetch_mood_pattern(supabase, user_id: str) -> str:
    """
    Derive a simple mood label from the most recent inner_weather entries.
    Falls back to 'unknown' gracefully if table/column absent.
    """
    try:
        rows = (
            supabase.table("inner_weather_logs")
            .select("mood_label,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        ).data or []
        labels = [r.get("mood_label") for r in rows if r.get("mood_label")]
        if not labels:
            return "unknown"
        # Most common label across last 5 entries
        return Counter(labels).most_common(1)[0][0]
    except Exception:
        return "unknown"


# ── Main context builder ──────────────────────────────────────────────────────

def build_task_intelligence_context(
    supabase,
    user_id: str,
    local_date: str,
    resolved_struggles: list[str],
    current_streak: int = 0,
) -> dict:
    """
    Build the full reasoning context for a single user BEFORE the Gemini call.
    Returns raw material — every value feeds the chain-of-thought in the prompt.

    Uses EXISTING data sources only. No new tables.
    """
    # ── Focus areas + derived signals ────────────────────────────────────────
    focus_areas = [s.strip() for s in (resolved_struggles or []) if s and s.strip()]
    primary_ikigai_quadrant = _quadrant_from_focus_areas(focus_areas)
    inner_layer_focus = _inner_layers_from_focus_areas(focus_areas)

    # ── Parallel DB fetch: days-active, recent tasks, mood ───────────────────
    with ThreadPoolExecutor(max_workers=3) as _pool:
        _f_days   = _pool.submit(_fetch_days_active, supabase, user_id)
        _f_recent = _pool.submit(_fetch_recent_tasks, supabase, user_id, 14)
        _f_mood   = _pool.submit(_fetch_mood_pattern, supabase, user_id)
        days_active  = _f_days.result()
        recent_tasks = _f_recent.result()
        mood_pattern = _f_mood.result()

    journey_phase = _phase_from_days(days_active)

    # Non-repetition signals
    all_categories   = [t.get("category") for t in recent_tasks if t.get("category")]
    all_inner_layers = [t.get("inner_work_layer") for t in recent_tasks]
    all_angles       = [t.get("approach_angle") for t in recent_tasks]
    all_frameworks   = [t.get("framework_key") for t in recent_tasks]
    all_titles       = [t.get("title") for t in recent_tasks if t.get("title")]

    last_3_categories   = [v for v in all_categories[:9] if v][:3]
    last_3_inner_layers = [v for v in all_inner_layers[:9] if v][:3]
    last_3_angles       = [v for v in all_angles[:9] if v][:3]
    last_3_frameworks   = [v for v in all_frameworks[:9] if v][:3]

    # Avoidance: which category and inner layer are skipped most?
    skipped_tasks = [t for t in recent_tasks if t.get("skipped") or t.get("completion_state") == "skipped"]
    skip_category_counts = Counter(
        str(t.get("category") or "").lower()
        for t in skipped_tasks
        if t.get("category")
    )
    skip_layer_counts = Counter(
        t.get("inner_work_layer")
        for t in skipped_tasks
        if t.get("inner_work_layer") and t.get("inner_work_layer") != "none"
    )
    avoided_category = skip_category_counts.most_common(1)[0][0] if skip_category_counts else None
    avoided_layer = skip_layer_counts.most_common(1)[0][0] if skip_layer_counts else None

    # ── Performance signals ───────────────────────────────────────────────────
    completion_rate = _fetch_completion_rate(recent_tasks)

    return {
        "days_active":              days_active,
        "journey_phase":            journey_phase,
        "focus_areas":              focus_areas,
        "primary_ikigai_quadrant":  primary_ikigai_quadrant,
        "inner_layer_focus":        inner_layer_focus,
        "selected_goals":           focus_areas,           # same source for now
        "completion_rate":          completion_rate,
        "streak":                   current_streak,
        "mood_pattern":             mood_pattern,
        "last_3_categories":        last_3_categories,
        "last_3_inner_layers":      last_3_inner_layers,
        "last_3_angles":            last_3_angles,
        "last_3_frameworks":        last_3_frameworks,
        "avoided_category":         avoided_category,
        "avoided_layer":            avoided_layer,
        "recent_task_names":        all_titles[:7],        # last 7 titles for dedup
        # Pass through for downstream use
        "_recent_tasks_raw":        recent_tasks,
    }


# ── Reasoning block formatter ─────────────────────────────────────────────────

def build_intelligence_context_block(intel: dict) -> str:
    """
    Format the intelligence context dict into the reasoning block string
    that is injected into the task generation prompt.
    """
    focus_str        = ", ".join(intel.get("focus_areas") or ["not captured"])
    quadrant_str     = intel.get("primary_ikigai_quadrant") or "mission"
    inner_layers_str = ", ".join(intel.get("inner_layer_focus") or ["none identified"])
    goals_str        = ", ".join(intel.get("selected_goals") or ["not captured"])
    completion_pct   = f"{int((intel.get('completion_rate') or 0) * 100)}%"
    streak_str       = str(intel.get("streak") or 0)
    mood_str         = intel.get("mood_pattern") or "unknown"
    last_cats_str    = ", ".join(intel.get("last_3_categories") or []) or "none"
    last_layers_str  = ", ".join(intel.get("last_3_inner_layers") or []) or "none"
    last_angles_str  = ", ".join(intel.get("last_3_angles") or []) or "none"
    task_names       = intel.get("recent_task_names") or []
    task_names_str   = "\n".join(f"  • {name}" for name in task_names[:7]) or "  (no history yet)"
    avoided_category = intel.get("avoided_category") or "none detected"
    avoided          = intel.get("avoided_layer") or "none detected"
    phase_str        = intel.get("journey_phase") or "foundation"
    days_str         = str(intel.get("days_active") or 0)

    return f"""
━━━━━━━━━━━━━━━━━━━━
USER CONTEXT (this specific human, today)
━━━━━━━━━━━━━━━━━━━━

Days active: {days_str}
Journey phase: {phase_str}
Onboarding focus areas: {focus_str}
Primary direction (Ikigai): {quadrant_str}
Inner territories to attend to: {inner_layers_str}
Selected goals: {goals_str}
Recent completion rate: {completion_pct}
Current streak: {streak_str}
Mood pattern: {mood_str}

DO NOT REPEAT:
- Categories used in last 3 days: {last_cats_str}
- Inner layers used in last 3 days: {last_layers_str}
- Approach angles used recently: {last_angles_str}
- Recent task names (never duplicate or lightly reword these):
{task_names_str}

AVOIDANCE SIGNAL:
The user has been skipping category: {avoided_category}
The user has been skipping inner layer: {avoided}
This is the territory they most need. Do NOT abandon it.
Approach it from a DIFFERENT angle than before — if direct didn't work,
go oblique or embodied. Find the door that is open.

━━━━━━━━━━━━━━━━━━━━
REASONING STEP — Required before generating any task
━━━━━━━━━━━━━━━━━━━━

Silently reason through these before producing the JSON.
Do NOT include this reasoning in the output.

1. Who is this person today, given their phase ({phase_str}) and focus areas ({focus_str})?
2. Where are they in their journey?
3. What inner force needs attention — especially any being avoided ({avoided})?
4. What did they do recently, so I avoid repetition
   (different category from {last_cats_str}, different inner layer from {last_layers_str},
   different angle from {last_angles_str})?
5. What single action creates the most meaningful friction — not so easy it is ignored,
   not so hard it is refused?

Generate tasks FROM this reasoning.
Never from templates. Never from defaults.
If context is thin, reason harder about the little you know —
a user who selected "{focus_str.split(',')[0].strip() if focus_str else 'I feel lost'}" on day 1
still gives you everything you need to generate something specific to them.
""".strip()
