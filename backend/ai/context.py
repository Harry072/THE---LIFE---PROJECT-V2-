import hashlib
import json
from collections import Counter
from datetime import date, datetime, timedelta


ALLOWED_LOOP_CATEGORIES = {"awareness", "action", "meaning"}
CORE_CATEGORY_ORDER = ["awareness", "action", "meaning"]
MAX_CONTEXT_STRUGGLES = 4
MAX_STRUGGLE_CHARS = 48
MAX_RECENT_TITLES = 90     # 30 days × 3 tasks — full anti-repetition window
MAX_ANTI_REPEAT_DAYS = 29  # look back 30 days (inclusive of today = 29 delta)
MAX_PROMPT_LABELS = 3
MAX_WEEKLY_REFLECTIONS = 7
MAX_WEEKLY_TASKS = 21
MAX_COMPANION_TASKS = 6

CATEGORY_ALIASES = {
    "awareness": "awareness",
    "reflection": "awareness",
    "reflect": "awareness",
    "mindfulness": "awareness",
    "journaling": "awareness",
    "journal": "awareness",
    "clarity": "awareness",
    "breathing": "awareness",
    "action": "action",
    "focus": "action",
    "discipline": "action",
    "health": "action",
    "exercise": "action",
    "movement": "action",
    "sleep": "action",
    "connection": "action",
    "contribution": "meaning",
    "service": "meaning",
    "purpose": "meaning",
    "meaning": "meaning",
    "gratitude": "meaning",
    "ikigai": "meaning",
    "logotherapy": "meaning",
}

PATTERN_SIGNAL_KEYWORDS = {
    "distraction_or_scrolling": {
        "scroll",
        "phone",
        "distract",
        "distraction",
        "focus",
        "procrastinat",
        "avoid",
    },
    "overthinking_or_mental_noise": {
        "overthink",
        "thought",
        "thinking",
        "mind",
        "mental",
        "noise",
        "loop",
        "ruminat",
        "worry",
        "uncertain",
    },
    "loneliness_or_emotional_heaviness": {
        "alone",
        "lonely",
        "connection",
        "connect",
        "heavy",
        "sad",
        "low",
        "drained",
        "numb",
    },
    "lack_of_purpose_or_lost": {
        "purpose",
        "meaning",
        "lost",
        "direction",
        "why",
        "stuck",
        "empty",
    },
    "inconsistency_or_starting_quitting": {
        "consistent",
        "inconsistent",
        "quit",
        "restart",
        "start",
        "streak",
        "routine",
        "habit",
    },
}

HEAVY_MOOD_LABELS = {
    "heavy",
    "sad",
    "low",
    "tired",
    "anxious",
    "overwhelmed",
    "drained",
    "numb",
    "lonely",
}
HEAVY_FEEDBACK_MOOD_LABELS = HEAVY_MOOD_LABELS | {
    "still_heavy",
    "still heavy",
    "restless",
    "overwhelmed",
}
HEAVY_RESET_MOOD_LABELS = {"still_heavy", "heavy", "restless", "sleepy", "anxious", "overwhelmed", "drained"}
CALMER_RESET_MOOD_LABELS = {"calmer", "clearer", "clear", "focused", "grateful", "hopeful", "proud"}
CLEAR_FEEDBACK_MOOD_LABELS = {
    "clear",
    "clearer",
    "focused",
    "proud",
    "hopeful",
    "grateful",
}
TASK_FRICTION_LEVELS = {"too_easy", "right_sized", "too_heavy"}


def normalize_category(value: str | None) -> str:
    raw_category = str(value or "meaning").strip().lower().replace("_", "-")

    if raw_category in ALLOWED_LOOP_CATEGORIES:
        return raw_category

    if raw_category in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[raw_category]

    for token in raw_category.split("-"):
        if token in CATEGORY_ALIASES:
            return CATEGORY_ALIASES[token]

    return "meaning"


def safe_int(value, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def safe_float(value, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def parse_local_date(value: str) -> date:
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return date.today()


def clean_short_text(value: object, max_chars: int) -> str:
    cleaned = " ".join(str(value or "").replace("\n", " ").split()).strip()
    return cleaned[:max_chars].strip()


def clean_label(value: object, max_chars: int = 32) -> str:
    cleaned = clean_short_text(value, max_chars).lower().replace("-", "_").replace(" ", "_")
    return "".join(char for char in cleaned if char.isalnum() or char == "_")


def clean_request_struggles(struggles: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()

    for struggle in struggles:
        short_text = clean_short_text(struggle, MAX_STRUGGLE_CHARS)
        if not short_text:
            continue
        key = short_text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(short_text)
        if len(cleaned) >= MAX_CONTEXT_STRUGGLES:
            break

    return cleaned


def table_select_optional(supabase, table_name: str, label: str, build_query):
    try:
        query = supabase.table(table_name).select(build_query["select"])
        for operation in build_query.get("ops", []):
            method_name = operation[0]
            args = operation[1] if len(operation) > 1 else ()
            kwargs = operation[2] if len(operation) > 2 else {}
            query = getattr(query, method_name)(*args, **kwargs)
        return query.execute().data or []
    except Exception as error:
        print(
            "AI_CONTEXT "
            f"optional_query_failed source={label} "
            f"error={type(error).__name__}:{getattr(error, 'code', 'n/a') or 'n/a'}"
        )
        return []


def fetch_user_tree_context(supabase, user_id: str) -> tuple[dict, bool]:
    rows = table_select_optional(
        supabase,
        "user_tree",
        "user_tree",
        {
            "select": "streak,cumulative_score,vitality",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("limit", (1,)),
            ],
        },
    )
    return (rows[0], True) if rows else ({}, False)


def fetch_task_history_context(supabase, user_id: str, local_date: str) -> tuple[list[dict], bool]:
    current_date = parse_local_date(local_date)
    week_start = (current_date - timedelta(days=MAX_ANTI_REPEAT_DAYS)).isoformat()
    rows = table_select_optional(
        supabase,
        "loop_tasks",
        "loop_tasks_history",
        {
            "select": (
                "title,category,done,completed_at,skipped,is_optional,duration_minutes,"
                "for_date,created_at,task_friction_level,post_action_mood,mood_after,"
                "completion_state,skip_reason_label"
            ),
            "ops": [
                ("eq", ("user_id", user_id)),
                ("gte", ("for_date", week_start)),
                ("lte", ("for_date", current_date.isoformat())),
                ("order", ("for_date",), {"desc": True}),
                ("limit", (90,)),
            ],
        },
    )
    return rows, bool(rows)


def fetch_journey_context(supabase, user_id: str, local_date: str) -> dict:
    """
    Calculate the user's day number in their 30-day self-discovery journey
    by finding the date of their first loop task.
    Returns journey_day (1-based int) and journey_stage (str key).
    """
    rows = table_select_optional(
        supabase,
        "loop_tasks",
        "journey_start",
        {
            "select": "for_date",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("order", ("for_date",), {"desc": False}),
                ("limit", (1,)),
            ],
        },
    )
    current_date = parse_local_date(local_date)
    if rows and rows[0].get("for_date"):
        first_date = parse_local_date(str(rows[0]["for_date"]))
        day_number = max(1, (current_date - first_date).days + 1)
    else:
        day_number = 1

    if day_number <= 7:
        stage = "foundation"
    elif day_number <= 14:
        stage = "discovery"
    elif day_number <= 21:
        stage = "integration"
    else:
        stage = "mastery"

    return {"journey_day": day_number, "journey_stage": stage}


def extract_prompt_label(item: object) -> str:
    if isinstance(item, dict):
        return clean_short_text(item.get("prompt") or item.get("q") or "", 56)
    if isinstance(item, str):
        return clean_short_text(item, 56)
    return ""


def count_values(values: list[str]) -> dict:
    counts = Counter(value for value in values if value)
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def stable_hash(payload: object) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def contains_signal_keyword(values: list[str], keywords: set[str]) -> bool:
    joined = " ".join(str(value or "").lower() for value in values)
    return any(keyword in joined for keyword in keywords)


def category_completion_rate(category_counts: dict, category: str) -> float | None:
    stats = category_counts.get(category) if isinstance(category_counts, dict) else None
    if not isinstance(stats, dict):
        return None
    total = safe_int(stats.get("total"), 0)
    if total <= 0:
        return None
    return safe_int(stats.get("completed"), 0) / total


def choose_category_signal(category_counts: dict, *, strongest: bool) -> str:
    scored_categories: list[tuple[float, int, str]] = []
    if not isinstance(category_counts, dict):
        return ""

    for category in CORE_CATEGORY_ORDER:
        stats = category_counts.get(category) or {}
        total = safe_int(stats.get("total"), 0)
        if total <= 0:
            continue
        completed = safe_int(stats.get("completed"), 0)
        skipped = safe_int(stats.get("skipped"), 0)
        rate = completed / total
        score = rate if strongest else -rate
        pressure = completed if strongest else skipped
        scored_categories.append((score, pressure, category))

    if not scored_categories:
        return ""
    return sorted(scored_categories, reverse=True)[0][2]


def describe_completion_pattern(task_count: int, completed_count: int) -> str:
    if task_count <= 0:
        return "quiet"
    completion_rate = completed_count / task_count
    if completion_rate < 0.34:
        return "low"
    if completion_rate < 0.75:
        return "mixed"
    return "strong"


def build_weekly_pattern_signals(input_summary: dict, task_summary: dict) -> dict:
    mood_counts = input_summary.get("mood_counts") if isinstance(input_summary, dict) else {}
    prompt_labels = input_summary.get("prompt_labels") if isinstance(input_summary, dict) else []
    category_counts = task_summary.get("category_counts") if isinstance(task_summary, dict) else {}
    mood_labels = list((mood_counts or {}).keys())
    prompt_label_values = [str(label or "") for label in (prompt_labels or [])]
    safe_signal_text = [*mood_labels, *prompt_label_values]

    task_count = safe_int(task_summary.get("task_count"), 0)
    completed_count = safe_int(task_summary.get("completed_task_count"), 0)
    skipped_count = safe_int(task_summary.get("skipped_task_count"), 0)
    completion_rate = completed_count / task_count if task_count else 0.0
    action_rate = category_completion_rate(category_counts, "action")
    meaning_rate = category_completion_rate(category_counts, "meaning")
    most_common_mood = str(mood_labels[0]).lower() if mood_labels else ""

    distraction_signal = (
        contains_signal_keyword(
            safe_signal_text,
            PATTERN_SIGNAL_KEYWORDS["distraction_or_scrolling"],
        )
        or (action_rate is not None and action_rate < 0.5)
        or (task_count >= 3 and completion_rate < 0.4)
    )
    overthinking_signal = contains_signal_keyword(
        safe_signal_text,
        PATTERN_SIGNAL_KEYWORDS["overthinking_or_mental_noise"],
    )
    loneliness_signal = (
        contains_signal_keyword(
            safe_signal_text,
            PATTERN_SIGNAL_KEYWORDS["loneliness_or_emotional_heaviness"],
        )
        or most_common_mood in HEAVY_MOOD_LABELS
    )
    purpose_signal = (
        contains_signal_keyword(
            safe_signal_text,
            PATTERN_SIGNAL_KEYWORDS["lack_of_purpose_or_lost"],
        )
        or (meaning_rate is not None and meaning_rate < 0.5)
    )
    inconsistency_signal = (
        contains_signal_keyword(
            safe_signal_text,
            PATTERN_SIGNAL_KEYWORDS["inconsistency_or_starting_quitting"],
        )
        or (task_count >= 3 and 0 < completion_rate < 0.5)
        or (skipped_count > completed_count and skipped_count > 0)
    )

    return {
        "distraction_or_scrolling": bool(distraction_signal),
        "overthinking_or_mental_noise": bool(overthinking_signal),
        "loneliness_or_emotional_heaviness": bool(loneliness_signal),
        "lack_of_purpose_or_lost": bool(purpose_signal),
        "inconsistency_or_starting_quitting": bool(inconsistency_signal),
        "completion_pattern": describe_completion_pattern(task_count, completed_count),
        "weakest_category": choose_category_signal(category_counts, strongest=False),
        "strongest_category": choose_category_signal(category_counts, strongest=True),
        "reflection_count": safe_int(input_summary.get("reflection_count"), 0),
        "task_count": task_count,
    }


def fetch_latest_reflection_context(supabase, user_id: str) -> tuple[dict, bool]:
    rows = table_select_optional(
        supabase,
        "reflections",
        "latest_reflection",
        {
            "select": "mood,questions,for_date,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("order", ("for_date",), {"desc": True}),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (1,)),
            ],
        },
    )
    if not rows:
        return {}, False

    reflection = rows[0]
    questions = reflection.get("questions") if isinstance(reflection, dict) else []
    prompt_labels = [
        label
        for label in (extract_prompt_label(item) for item in (questions or []))
        if label
    ][:MAX_PROMPT_LABELS]

    return {
        "latest_mood": clean_short_text(reflection.get("mood"), 24) if isinstance(reflection, dict) else "",
        "prompt_labels": prompt_labels,
    }, True


def fetch_latest_reset_signal(supabase, user_id: str) -> tuple[dict, bool]:
    """Return safe reset mood summary for the most recent 3 sessions."""
    rows = table_select_optional(
        supabase,
        "reset_sessions",
        "latest_reset_signal",
        {
            "select": "mood_after,reflection_tag,next_step_type,completed_at,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("order", ("completed_at",), {"desc": True}),
                ("limit", (3,)),
            ],
        },
    )
    if not rows:
        return {}, False

    latest = rows[0]
    heavy_count = sum(
        1 for row in rows
        if clean_label(row.get("mood_after")) in HEAVY_RESET_MOOD_LABELS
    )
    calmer_count = sum(
        1 for row in rows
        if clean_label(row.get("mood_after")) in CALMER_RESET_MOOD_LABELS
    )
    overthinking_count = sum(
        1 for row in rows
        if clean_label(row.get("reflection_tag")) == "overthinking"
    )
    scrolling_count = sum(
        1 for row in rows
        if clean_label(row.get("reflection_tag")) in {"scrolling", "less_screen"}
    )
    return {
        "latest_mood_after_reset": clean_label(latest.get("mood_after")),
        "latest_reflection_tag": clean_label(latest.get("reflection_tag")),
        "latest_next_step_type": clean_label(latest.get("next_step_type")),
        "heavy_reset_count": heavy_count,
        "calmer_reset_count": calmer_count,
        "overthinking_reset_count": overthinking_count,
        "scrolling_reset_count": scrolling_count,
    }, True


def fetch_life_companion_today_tasks(supabase, user_id: str) -> tuple[list[dict], bool]:
    local_date = date.today().isoformat()
    rows = table_select_optional(
        supabase,
        "loop_tasks",
        "life_companion_today_tasks",
        {
            "select": "id,title,category,done,completed_at,skipped,is_optional,duration_minutes,preferred_time,sort_order,for_date",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("eq", ("for_date", local_date)),
                ("order", ("sort_order",), {"desc": False}),
                ("limit", (MAX_COMPANION_TASKS,)),
            ],
        },
    )
    return rows, bool(rows)


def summarize_life_companion_tasks(rows: list[dict]) -> dict:
    core_rows = [
        row for row in rows
        if not bool(row.get("is_optional"))
        and normalize_category(row.get("category")) in ALLOWED_LOOP_CATEGORIES
    ]
    completed_categories: list[str] = []
    skipped_categories: list[str] = []
    category_counts = {
        category: {"total": 0, "completed": 0, "skipped": 0}
        for category in CORE_CATEGORY_ORDER
    }
    task_cards: list[dict] = []

    for row in core_rows[:MAX_COMPANION_TASKS]:
        category = normalize_category(row.get("category"))
        completed = bool(row.get("completed_at") or row.get("done"))
        skipped = bool(row.get("skipped"))
        category_counts[category]["total"] += 1
        if completed:
            category_counts[category]["completed"] += 1
            completed_categories.append(category)
        if skipped:
            category_counts[category]["skipped"] += 1
            skipped_categories.append(category)

        task_cards.append({
            "title": clean_short_text(row.get("title"), 72),
            "category": category,
            "completed": completed,
            "skipped": skipped,
            "duration_minutes": safe_int(row.get("duration_minutes"), 0),
            "preferred_time": clean_short_text(row.get("preferred_time"), 24),
        })

    completed_count = len(completed_categories)
    total_count = len(core_rows)
    completion_pattern = describe_completion_pattern(total_count, completed_count)

    return {
        "today_tasks": task_cards,
        "task_count": total_count,
        "completed_task_count": completed_count,
        "skipped_task_count": len(skipped_categories),
        "completed_categories": count_values(completed_categories),
        "skipped_categories": count_values(skipped_categories),
        "category_counts": category_counts,
        "completion_pattern": completion_pattern,
        "strong_categories": [
            category
            for category in CORE_CATEGORY_ORDER
            if (category_completion_rate(category_counts, category) or 0) >= 0.67
        ][:2],
        "weak_categories": [
            category
            for category in CORE_CATEGORY_ORDER
            if (
                category_counts[category]["total"] > 0
                and (
                    (category_completion_rate(category_counts, category) or 0) < 0.5
                    or category_counts[category]["skipped"] > category_counts[category]["completed"]
                )
            )
        ][:2],
    }


def fetch_life_companion_latest_reflection(supabase, user_id: str) -> tuple[dict, bool]:
    reflection_data, has_reflection = fetch_latest_reflection_context(supabase, user_id)
    if not has_reflection:
        return {}, False
    return {
        "latest_mood": reflection_data.get("latest_mood") or "",
        "prompt_labels": reflection_data.get("prompt_labels") or [],
    }, True


def fetch_life_companion_latest_reflection_metadata(supabase, user_id: str) -> tuple[dict, bool]:
    rows = table_select_optional(
        supabase,
        "reflections",
        "life_companion_latest_reflection_metadata",
        {
            "select": "mood,for_date,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("order", ("for_date",), {"desc": True}),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (1,)),
            ],
        },
    )
    if not rows:
        return {}, False

    row = rows[0]
    return {
        "latest_mood": clean_short_text(row.get("mood"), 24) if isinstance(row, dict) else "",
        "prompt_labels": [],
    }, True


def fetch_life_companion_weekly_mirror(supabase, user_id: str) -> tuple[dict, bool]:
    rows = table_select_optional(
        supabase,
        "weekly_syntheses",
        "life_companion_weekly_mirror",
        {
            "select": "week_start,week_end,status,synthesis_json,prompt_version,updated_at,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("order", ("week_end",), {"desc": True}),
                ("order", ("updated_at",), {"desc": True}),
                ("limit", (1,)),
            ],
        },
    )
    if not rows:
        return {}, False

    row = rows[0]
    synthesis = row.get("synthesis_json") if isinstance(row.get("synthesis_json"), dict) else {}
    recommendation = synthesis.get("recommended_next_step")
    safe_recommendation = recommendation if isinstance(recommendation, dict) else {}
    return {
        "week_start": str(row.get("week_start") or ""),
        "week_end": str(row.get("week_end") or ""),
        "status": clean_short_text(row.get("status"), 24),
        "next_focus": clean_short_text(synthesis.get("next_focus"), 140),
        "recommended_next_step": {
            "type": clean_short_text(safe_recommendation.get("type"), 32),
            "title": clean_short_text(safe_recommendation.get("title"), 80),
            "reason": clean_short_text(safe_recommendation.get("reason"), 180),
            "action_label": clean_short_text(safe_recommendation.get("action_label"), 48),
        } if safe_recommendation else {},
    }, True


def fetch_life_companion_onboarding_context(supabase, user_id: str) -> tuple[dict, bool]:
    # profiles table not created — read core_struggles from user_behavior instead.
    rows = table_select_optional(
        supabase,
        "user_behavior",
        "life_companion_profile",
        {
            "select": "core_struggles",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("limit", (1,)),
            ],
        },
    )
    if not rows:
        return {}, False

    raw_struggles = rows[0].get("core_struggles")
    struggle_tags = [
        clean_short_text(tag, 48)
        for tag in (raw_struggles if isinstance(raw_struggles, list) else [])
        if clean_short_text(tag, 48)
    ][:4]
    if not struggle_tags:
        return {}, False
    return {
        "struggle_tags": struggle_tags,
        "struggle_cluster": None,
        "onboarding_completed": True,
    }, True


def fetch_life_companion_recent_intents(supabase, user_id: str) -> tuple[dict, bool]:
    rows = table_select_optional(
        supabase,
        "companion_messages",
        "life_companion_recent_intents",
        {
            "select": "companion_intent,resolved_action_type,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("eq", ("role", "assistant")),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (8,)),
            ],
        },
    )
    if not rows:
        return {}, False

    intents = [
        clean_label(row.get("companion_intent"))
        for row in rows
        if clean_label(row.get("companion_intent"))
    ]
    action_types = [
        clean_label(row.get("resolved_action_type"))
        for row in rows
        if clean_label(row.get("resolved_action_type"))
    ]
    return {
        "recent_intents": intents[:6],
        "intent_counts": count_values(intents),
        "recent_action_types": action_types[:6],
    }, bool(intents or action_types)


def fetch_life_companion_curator_interest(supabase, user_id: str) -> tuple[dict, bool]:
    rows = table_select_optional(
        supabase,
        "curator_interactions",
        "life_companion_curator_interest",
        {
            "select": "book_id,path_slug,action_type,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (8,)),
            ],
        },
    )
    if not rows:
        return {}, False

    book_ids = [
        clean_short_text(row.get("book_id"), 80)
        for row in rows
        if clean_short_text(row.get("book_id"), 80)
    ]
    path_slugs = [
        clean_label(row.get("path_slug"))
        for row in rows
        if clean_label(row.get("path_slug"))
    ]
    action_types = [
        clean_label(row.get("action_type"))
        for row in rows
        if clean_label(row.get("action_type"))
    ]
    return {
        "recent_book_ids": book_ids[:5],
        "recent_path_slugs": path_slugs[:5],
        "action_counts": count_values(action_types),
    }, bool(book_ids or path_slugs or action_types)


def summarize_task_pattern(task_summary: dict) -> str:
    if not isinstance(task_summary, dict) or not task_summary.get("task_count"):
        return "not enough recent task signal"
    weak_categories = task_summary.get("weak_categories") or []
    skipped_categories = task_summary.get("skipped_categories") or {}
    if weak_categories:
        return f"{weak_categories[0]} tasks may need smaller first steps"
    if skipped_categories:
        first_skipped = next(iter(skipped_categories.keys()), "action")
        return f"{first_skipped} tasks have been skipped recently"
    pattern = task_summary.get("completion_pattern") or "mixed"
    return f"recent task completion looks {pattern}"


def summarize_mood_pattern(latest_inner_weather: dict, reset_signal: dict) -> str:
    latest_mood = clean_label((latest_inner_weather or {}).get("latest_mood"))
    latest_reset_mood = clean_label((reset_signal or {}).get("latest_mood_after_reset"))
    if latest_mood:
        return f"{latest_mood} appeared recently"
    if latest_reset_mood:
        return f"{latest_reset_mood} appeared after a reset"
    return "not enough recent mood signal"


def choose_companion_support_style(task_summary: dict, latest_inner_weather: dict, reset_signal: dict) -> str:
    task_pattern = summarize_task_pattern(task_summary)
    mood_pattern = summarize_mood_pattern(latest_inner_weather, reset_signal)
    if any(word in f"{task_pattern} {mood_pattern}" for word in ["heavy", "restless", "anxious", "skipped", "smaller"]):
        return "structured and gentle"
    return "direct and grounded"


def build_companion_safe_memory_summary(context: dict) -> dict:
    task_summary = context.get("task_summary") or {}
    latest_inner_weather = context.get("latest_inner_weather") or {}
    weekly_mirror = context.get("weekly_mirror") or {}
    onboarding_need = context.get("onboarding_need") or {}
    reset_signal = context.get("reset_signal") or {}
    recent_companion = context.get("recent_companion") or {}
    curator_interest = context.get("curator_interest") or {}

    struggle_tags = onboarding_need.get("struggle_tags") or []
    if not struggle_tags and onboarding_need.get("struggle_cluster"):
        struggle_tags = [onboarding_need.get("struggle_cluster")]

    return {
        "onboarding_need": [
            clean_label(tag, 32)
            for tag in struggle_tags
            if clean_label(tag, 32)
        ][:4],
        "task_pattern": summarize_task_pattern(task_summary),
        "recent_skipped_categories": list((task_summary.get("skipped_categories") or {}).keys())[:3],
        "mood_pattern": summarize_mood_pattern(latest_inner_weather, reset_signal),
        "weekly_focus": clean_short_text(weekly_mirror.get("next_focus"), 140) or "not enough weekly signal",
        "streak_band": clean_label(context.get("streak_band")) or "new",
        "recent_companion_intents": (recent_companion.get("recent_intents") or [])[:5],
        "curator_interest": {
            "recent_path_slugs": (curator_interest.get("recent_path_slugs") or [])[:4],
            "recent_book_ids": (curator_interest.get("recent_book_ids") or [])[:4],
        },
        "support_style": choose_companion_support_style(
            task_summary,
            latest_inner_weather,
            reset_signal,
        ),
    }


def build_life_companion_context(supabase, user_id: str, mode: str) -> dict:
    normalized_mode = str(mode or "understand_me").strip().lower()
    include_tasks = normalized_mode in {"make_today_easier", "suggest_next_step", "understand_me"}
    include_tree = normalized_mode in {"make_today_easier", "reset_my_mind", "suggest_next_step", "understand_me"}
    include_reflection = normalized_mode in {"reset_my_mind", "help_me_reflect", "understand_me"}
    include_weekly_mirror = normalized_mode == "suggest_next_step"
    include_onboarding = normalized_mode == "understand_me"
    include_reset_signal = normalized_mode in {"reset_my_mind", "make_today_easier", "suggest_next_step", "understand_me"}

    task_rows: list[dict] = []
    tree_data: dict = {}
    latest_reflection: dict = {}
    weekly_mirror: dict = {}
    onboarding_context: dict = {}
    reset_signal: dict = {}
    recent_companion: dict = {}
    curator_interest: dict = {}
    has_tasks = False
    has_tree = False
    has_reflection = False
    has_weekly_mirror = False
    has_onboarding = False
    has_reset_signal = False
    has_recent_companion = False
    has_curator_interest = False

    if include_tasks:
        task_rows, has_tasks = fetch_life_companion_today_tasks(supabase, user_id)
    if include_tree:
        tree_data, has_tree = fetch_user_tree_context(supabase, user_id)
    if include_reflection:
        latest_reflection, has_reflection = fetch_life_companion_latest_reflection_metadata(supabase, user_id)
    if include_weekly_mirror:
        weekly_mirror, has_weekly_mirror = fetch_life_companion_weekly_mirror(supabase, user_id)
    if include_onboarding:
        onboarding_context, has_onboarding = fetch_life_companion_onboarding_context(supabase, user_id)
    if include_reset_signal:
        reset_signal, has_reset_signal = fetch_latest_reset_signal(supabase, user_id)
    recent_companion, has_recent_companion = fetch_life_companion_recent_intents(supabase, user_id)
    curator_interest, has_curator_interest = fetch_life_companion_curator_interest(supabase, user_id)

    task_summary = summarize_life_companion_tasks(task_rows)
    tree_summary = {
        "streak": safe_int(tree_data.get("streak"), 0) if has_tree else 0,
        "vitality": safe_int(tree_data.get("vitality"), 0) if has_tree else 0,
        "cumulative_score": safe_int(tree_data.get("cumulative_score"), 0) if has_tree else 0,
    }

    context = {
        "user_id": user_id,
        "mode": normalized_mode,
        "local_date": date.today().isoformat(),
        "task_summary": task_summary,
        "latest_inner_weather": latest_reflection,
        "weekly_mirror": weekly_mirror,
        "tree_summary": tree_summary,
        "streak_band": choose_streak_band(tree_summary["streak"]),
        "onboarding_need": onboarding_context,
        "reset_signal": reset_signal,
        "recent_companion": recent_companion,
        "curator_interest": curator_interest,
        "context_used": [
            source
            for source, present in {
                "today_tasks": has_tasks,
                "latest_mood": has_reflection and bool(latest_reflection.get("latest_mood")),
                "prompt_labels": has_reflection and bool(latest_reflection.get("prompt_labels")),
                "weekly_mirror": has_weekly_mirror,
                "user_tree": has_tree,
                "onboarding_need": has_onboarding,
                "reset_signal": has_reset_signal,
                "recent_companion_intents": has_recent_companion,
                "curator_interest": has_curator_interest,
            }.items()
            if present
        ],
    }
    context["safe_memory_summary"] = build_companion_safe_memory_summary(context)
    return context


def fetch_weekly_reflection_rows(
    supabase,
    user_id: str,
    week_start: str,
    week_end: str,
) -> list[dict]:
    rows = table_select_optional(
        supabase,
        "reflections",
        "weekly_reflections",
        {
            "select": "id,for_date,mood,questions,created_at,updated_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("gte", ("for_date", week_start)),
                ("lte", ("for_date", week_end)),
                ("order", ("for_date",), {"desc": True}),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (MAX_WEEKLY_REFLECTIONS,)),
            ],
        },
    )
    return rows


def fetch_weekly_task_rows(
    supabase,
    user_id: str,
    week_start: str,
    week_end: str,
) -> list[dict]:
    rows = table_select_optional(
        supabase,
        "loop_tasks",
        "weekly_loop_tasks",
        {
            "select": "id,title,category,done,completed_at,skipped,is_optional,for_date,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("gte", ("for_date", week_start)),
                ("lte", ("for_date", week_end)),
                ("order", ("for_date",), {"desc": True}),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (MAX_WEEKLY_TASKS,)),
            ],
        },
    )
    return rows


def build_reflection_prompt_context(rows: list[dict]) -> list[dict]:
    prompt_context: list[dict] = []
    for row in rows[:MAX_WEEKLY_REFLECTIONS]:
        questions = row.get("questions") if isinstance(row.get("questions"), list) else []
        prompt_labels = [
            label
            for label in (extract_prompt_label(item) for item in questions)
            if label
        ][:MAX_PROMPT_LABELS]
        prompt_context.append({
            "for_date": str(row.get("for_date") or ""),
            "mood": clean_short_text(row.get("mood"), 24),
            "prompt_labels": prompt_labels,
        })
    return prompt_context


def summarize_weekly_tasks(rows: list[dict]) -> dict:
    core_rows = [
        row for row in rows
        if not bool(row.get("is_optional"))
        and normalize_category(row.get("category")) in ALLOWED_LOOP_CATEGORIES
    ]
    completed_categories: list[str] = []
    skipped_categories: list[str] = []
    category_counts = {
        category: {"total": 0, "completed": 0, "skipped": 0}
        for category in CORE_CATEGORY_ORDER
    }

    for row in core_rows:
        category = normalize_category(row.get("category"))
        category_counts[category]["total"] += 1
        if row.get("completed_at") or row.get("done"):
            category_counts[category]["completed"] += 1
            completed_categories.append(category)
        if row.get("skipped"):
            category_counts[category]["skipped"] += 1
            skipped_categories.append(category)

    completed_count = len(completed_categories)
    skipped_count = len(skipped_categories)
    return {
        "task_count": len(core_rows),
        "completed_task_count": completed_count,
        "skipped_task_count": skipped_count,
        "completed_categories": count_values(completed_categories),
        "skipped_categories": count_values(skipped_categories),
        "category_counts": category_counts,
    }


def build_weekly_input_summary(
    *,
    week_start: str,
    week_end: str,
    reflection_rows: list[dict],
    task_rows: list[dict],
    task_summary: dict,
    tree_data: dict,
    has_tree: bool,
) -> dict:
    moods = [
        clean_short_text(row.get("mood"), 24)
        for row in reflection_rows
        if clean_short_text(row.get("mood"), 24)
    ]
    prompt_labels: list[str] = []
    for row in reflection_rows:
        questions = row.get("questions") if isinstance(row.get("questions"), list) else []
        prompt_labels.extend(
            label
            for label in (extract_prompt_label(item) for item in questions)
            if label
        )

    fingerprint_payload = {
        "week_start": week_start,
        "week_end": week_end,
        "reflections": [
            {
                "id": row.get("id"),
                "for_date": str(row.get("for_date") or ""),
                "mood": clean_short_text(row.get("mood"), 24),
                "updated_at": str(row.get("updated_at") or row.get("created_at") or ""),
            }
            for row in reflection_rows
        ],
        "tasks": [
            {
                "id": row.get("id"),
                "for_date": str(row.get("for_date") or ""),
                "category": normalize_category(row.get("category")),
                "completed_at": str(row.get("completed_at") or ""),
                "done": bool(row.get("done")),
                "skipped": bool(row.get("skipped")),
                "created_at": str(row.get("created_at") or ""),
            }
            for row in task_rows
        ],
        "tree": {
            "streak": safe_int(tree_data.get("streak"), 0) if has_tree else 0,
            "vitality": safe_int(tree_data.get("vitality"), 0) if has_tree else 0,
            "updated_at": str(tree_data.get("updated_at") or "") if has_tree else "",
        },
    }

    input_summary = {
        "week_start": week_start,
        "week_end": week_end,
        "reflection_count": len(reflection_rows),
        "task_count": task_summary["task_count"],
        "completed_task_count": task_summary["completed_task_count"],
        "skipped_task_count": task_summary["skipped_task_count"],
        "mood_counts": count_values(moods),
        "prompt_labels": list(count_values(prompt_labels).keys())[:MAX_PROMPT_LABELS],
        "completed_categories": task_summary["completed_categories"],
        "skipped_categories": task_summary["skipped_categories"],
        "task_category_counts": task_summary["category_counts"],
        "tree_summary": {
            "streak": safe_int(tree_data.get("streak"), 0) if has_tree else 0,
            "vitality": safe_int(tree_data.get("vitality"), 0) if has_tree else 0,
            "cumulative_score": safe_int(tree_data.get("cumulative_score"), 0) if has_tree else 0,
        },
        "context_used": [
            source
            for source, present in {
                "reflections": bool(reflection_rows),
                "moods": bool(moods),
                "loop_tasks": bool(task_rows),
                "user_tree": has_tree,
            }.items()
            if present
        ],
        "source_fingerprint": stable_hash(fingerprint_payload),
    }
    input_summary["pattern_signals"] = build_weekly_pattern_signals(
        input_summary,
        task_summary,
    )
    return input_summary


def build_weekly_mirror_context(
    supabase,
    user_id: str,
    week_start: str,
    week_end: str,
) -> dict:
    reflection_rows = fetch_weekly_reflection_rows(supabase, user_id, week_start, week_end)
    task_rows = fetch_weekly_task_rows(supabase, user_id, week_start, week_end)
    tree_data, has_tree = fetch_user_tree_context(supabase, user_id)
    task_summary = summarize_weekly_tasks(task_rows)
    input_summary = build_weekly_input_summary(
        week_start=week_start,
        week_end=week_end,
        reflection_rows=reflection_rows,
        task_rows=task_rows,
        task_summary=task_summary,
        tree_data=tree_data,
        has_tree=has_tree,
    )
    reflection_prompt_context = build_reflection_prompt_context(reflection_rows)
    data_points = {
        "reflections": len(reflection_rows),
        "tasks": task_summary["task_count"],
    }
    meaningful_data_points = (
        len(reflection_rows)
        + task_summary["completed_task_count"]
        + task_summary["skipped_task_count"]
    )

    return {
        "user_id": user_id,
        "week_start": week_start,
        "week_end": week_end,
        "reflections": reflection_prompt_context,
        "task_summary": task_summary,
        "tree_summary": input_summary["tree_summary"],
        "pattern_signals": input_summary.get("pattern_signals") or {},
        "input_summary": input_summary,
        "data_points": data_points,
        "meaningful_data_points": meaningful_data_points,
    }


def summarize_task_history(rows: list[dict]) -> dict:
    stats = {
        category: {"total": 0, "completed": 0, "skipped": 0}
        for category in CORE_CATEGORY_ORDER
    }
    durations: list[int] = []
    recent_titles: list[str] = []
    seen_titles: set[str] = set()
    friction_values: list[str] = []
    mood_after_values: list[str] = []
    skip_reason_values: list[str] = []
    recent_task_fingerprints: list[dict] = []

    for row in rows:
        category = normalize_category(row.get("category"))
        if category not in stats or bool(row.get("is_optional")):
            continue

        stats[category]["total"] += 1
        if row.get("completed_at") or row.get("done"):
            stats[category]["completed"] += 1
        if row.get("skipped"):
            stats[category]["skipped"] += 1
            skip_reason = clean_label(row.get("skip_reason_label"))
            if skip_reason:
                skip_reason_values.append(skip_reason)

        duration = safe_int(row.get("duration_minutes"), 0)
        if duration > 0:
            durations.append(duration)

        friction = clean_label(row.get("task_friction_level"))
        if friction in TASK_FRICTION_LEVELS:
            friction_values.append(friction)

        mood_after = clean_label(row.get("mood_after") or row.get("post_action_mood"))
        if mood_after:
            mood_after_values.append(mood_after)

        title = clean_short_text(row.get("title"), 56)
        title_key = title.lower()
        if title and title_key not in seen_titles:
            seen_titles.add(title_key)
            recent_titles.append(title)
            if len(recent_task_fingerprints) < 14:
                recent_task_fingerprints.append({
                    "title": title,
                    "category": category,
                    "for_date": str(row.get("for_date") or "")[:10],
                })

    total_tasks = sum(item["total"] for item in stats.values())
    completed_tasks = sum(item["completed"] for item in stats.values())
    completion_rate = completed_tasks / total_tasks if total_tasks else 0.5

    if total_tasks == 0:
        completion_pattern = "mixed"
    elif completion_rate < 0.34:
        completion_pattern = "low"
    elif completion_rate < 0.75:
        completion_pattern = "mixed"
    else:
        completion_pattern = "strong"

    strong_categories: list[str] = []
    weak_categories: list[str] = []
    for category, category_stats in stats.items():
        total = category_stats["total"]
        if total <= 0:
            continue
        category_rate = category_stats["completed"] / total
        if category_rate >= 0.67:
            strong_categories.append(category)
        if category_rate < 0.5 or category_stats["skipped"] > category_stats["completed"]:
            weak_categories.append(category)

    average_duration = round(sum(durations) / len(durations)) if durations else 10
    friction_counts = count_values(friction_values)
    mood_after_counts = count_values(mood_after_values)
    skip_reason_counts = count_values(skip_reason_values)
    _top_skip_reasons = [
        label
        for label, _ in sorted(skip_reason_counts.items(), key=lambda kv: -kv[1])
        if label
    ][:2]
    skip_reason_summary = (
        " and ".join(_top_skip_reasons).replace("_", " ")
        if _top_skip_reasons
        else ""
    )
    too_heavy_count = safe_int(friction_counts.get("too_heavy"), 0)
    too_easy_count = safe_int(friction_counts.get("too_easy"), 0)
    heavy_mood_count = sum(
        safe_int(mood_after_counts.get(label), 0)
        for label in HEAVY_FEEDBACK_MOOD_LABELS
    )
    clear_mood_count = sum(
        safe_int(mood_after_counts.get(label), 0)
        for label in CLEAR_FEEDBACK_MOOD_LABELS
    )
    skipped_tasks = sum(item["skipped"] for item in stats.values())
    adaptation_mode = "steady"
    duration_multiplier = 1.0
    feedback_note = "No strong post-action friction signal yet."
    if (
        too_heavy_count >= 1
        or skipped_tasks >= max(2, completed_tasks + 1)
        or (heavy_mood_count >= 2 and completion_pattern == "low")
    ):
        adaptation_mode = "simplify"
        duration_multiplier = 0.5
        feedback_note = (
            "Recent safe feedback suggests tasks may need to be halved or made easier to begin."
        )
    elif (
        too_easy_count >= 2
        and clear_mood_count >= 1
        and completion_pattern == "strong"
    ):
        adaptation_mode = "stretch_slightly"
        duration_multiplier = 1.15
        feedback_note = (
            "Recent safe feedback suggests a slight increase is okay, while keeping a smaller version."
        )

    # Compact safe summary of the last 3 tasks that have any feedback.
    # Only safe enumerated labels (no raw text, no private data).
    feedback_rows_with_signal = [
        row for row in rows
        if (
            clean_label(row.get("task_friction_level")) in TASK_FRICTION_LEVELS
            or clean_label(row.get("mood_after") or row.get("post_action_mood"))
        )
        and not bool(row.get("is_optional"))
    ]
    feedback_rows_with_signal.sort(
        key=lambda r: str(r.get("for_date") or ""),
        reverse=True,
    )
    recent_feedback_signals: list[dict] = []
    for row in feedback_rows_with_signal[:3]:
        signal: dict = {}
        for_date_raw = str(row.get("for_date") or "").strip()
        if for_date_raw:
            signal["for_date"] = for_date_raw[:10]
        friction = clean_label(row.get("task_friction_level"))
        if friction in TASK_FRICTION_LEVELS:
            signal["friction"] = friction
        mood = clean_label(row.get("mood_after") or row.get("post_action_mood"))
        if mood:
            signal["mood"] = mood
        cat = normalize_category(row.get("category"))
        if cat in ALLOWED_LOOP_CATEGORIES:
            signal["category"] = cat
        if signal:
            recent_feedback_signals.append(signal)

    return {
        "completion_pattern": completion_pattern,
        "completion_rate": round(completion_rate, 2),
        "strong_categories": strong_categories[:2],
        "weak_categories": weak_categories[:2],
        "recent_titles_to_avoid": recent_titles[:MAX_RECENT_TITLES],
        "recent_task_fingerprints": recent_task_fingerprints,
        "average_duration": average_duration,
        "task_feedback_summary": {
            "feedback_count": len(friction_values) + len(mood_after_values),
            "friction_counts": friction_counts,
            "mood_after_counts": mood_after_counts,
            "skip_reason_counts": skip_reason_counts,
            "skip_reason_summary": skip_reason_summary,
            "recent_feedback_signals": recent_feedback_signals,
            "adaptation_mode": adaptation_mode,
            "duration_multiplier": duration_multiplier,
            "feedback_note": feedback_note,
        },
    }


def choose_streak_band(streak: int) -> str:
    if streak < 5:
        return "new"
    if streak <= 15:
        return "building"
    return "consistent"


def choose_journey_guidance(streak_band: str) -> str:
    if streak_band == "new":
        return "Focus on gentle awareness and low-pressure action."
    if streak_band == "building":
        return "Focus on clear action and building consistency."
    return "Focus on purpose, meaning, and identity-level growth."


def choose_intensity(
    *,
    streak_band: str,
    completion_pattern: str,
    latest_mood: str,
    vitality: int | None,
    feedback_adaptation: str = "steady",
    latest_reset_mood: str = "",
) -> str:
    mood = str(latest_mood or "").lower()
    reset_mood = str(latest_reset_mood or "").lower()
    heavy_moods = {"heavy", "sad", "low", "tired", "anxious", "overwhelmed", "drained"}
    if feedback_adaptation == "simplify":
        return "gentle"
    # Reset mood from recent session is a strong real-time signal
    if reset_mood in HEAVY_RESET_MOOD_LABELS:
        return "gentle"
    if mood in heavy_moods or completion_pattern == "low" or streak_band == "new":
        return "gentle"
    if vitality is not None and vitality < 35:
        return "gentle"
    if completion_pattern == "strong" and streak_band == "consistent":
        return "deeper"
    return "normal"


def build_context_note(
    strong_categories: list[str],
    weak_categories: list[str],
    completion_pattern: str,
) -> str:
    if strong_categories and weak_categories:
        return (
            f"User often completes {strong_categories[0]} tasks but may need a more approachable "
            f"{weak_categories[0]} task."
        )
    if weak_categories:
        return f"Make the {weak_categories[0]} task especially approachable today."
    if completion_pattern == "strong":
        return "User has been completing tasks consistently; keep practices meaningful but doable."
    if completion_pattern == "low":
        return "Keep tasks small enough to restart momentum without pressure."
    return "Use balanced, concrete tasks that are easy to start today."


def fetch_onboarding_struggles_from_db(supabase, user_id: str) -> list[str]:
    """Fetch user struggles from user_behavior when the request sends none.

    profiles and user_context tables are not created — use user_behavior only.
    Returns on first non-empty result; all failures are safe-caught.
    """
    rows = table_select_optional(
        supabase,
        "user_behavior",
        "user_behavior_struggles_fallback",
        {
            "select": "core_struggles",
            "ops": [("eq", ("user_id", user_id)), ("limit", (1,))],
        },
    )
    if rows:
        raw = rows[0].get("core_struggles")
        result = clean_request_struggles([str(s) for s in (raw if isinstance(raw, list) else []) if s])
        if result:
            return result

    return []


def build_generation_context(
    struggles: list[str],
    current_streak: int,
    supabase=None,
    user_id: str | None = None,
    local_date: str | None = None,
    existing_tasks: list[dict] | None = None,
) -> dict:
    cleaned_struggles = clean_request_struggles(struggles)
    _db_struggles_used = False
    request_streak = max(0, safe_int(current_streak, 0))
    tree_data: dict = {}
    task_history: list[dict] = []
    reflection_data: dict = {}
    reset_signal: dict = {}
    context_used = ["streak"]

    if supabase is not None and user_id:
        tree_data, has_tree = fetch_user_tree_context(supabase, user_id)
        if has_tree:
            context_used.append("user_tree")
        if not cleaned_struggles:
            db_struggles = fetch_onboarding_struggles_from_db(supabase, user_id)
            if db_struggles:
                cleaned_struggles = db_struggles
                _db_struggles_used = True

    journey: dict = {}
    if supabase is not None and user_id and local_date:
        task_history, has_task_history = fetch_task_history_context(supabase, user_id, local_date)
        if has_task_history:
            context_used.append("task_history")
        reflection_data, has_reflection = fetch_latest_reflection_context(supabase, user_id)
        if has_reflection:
            if reflection_data.get("latest_mood"):
                context_used.append("latest_mood")
            if reflection_data.get("prompt_labels"):
                context_used.append("prompt_labels")
        reset_signal, has_reset = fetch_latest_reset_signal(supabase, user_id)
        if has_reset:
            context_used.append("reset_signal")
        journey = fetch_journey_context(supabase, user_id, local_date)
        if journey.get("journey_day", 1) > 1:
            context_used.append("journey")

    struggles_summary = (
        ", ".join(cleaned_struggles)
        if cleaned_struggles
        else "overthinking, distraction, and inconsistency"
    )

    history_summary = summarize_task_history(task_history)
    task_feedback_summary = history_summary.get("task_feedback_summary") or {}
    feedback_adaptation = task_feedback_summary.get("adaptation_mode") or "steady"
    existing_titles = [
        str(task.get("title") or "").strip()
        for task in (existing_tasks or [])
        if str(task.get("title") or "").strip()
    ]
    # Full 30-day title history for anti-repetition — deduplicated, most recent first
    all_history_titles_raw = [
        clean_short_text(row.get("title"), 120)
        for row in task_history
        if clean_short_text(row.get("title"), 120)
    ]
    all_history_titles: list[str] = []
    _seen_titles: set[str] = set()
    for _t in [*existing_titles, *all_history_titles_raw]:
        _k = _t.lower().strip()
        if _k and _k not in _seen_titles:
            _seen_titles.add(_k)
            all_history_titles.append(_t)
    all_history_titles = all_history_titles[:MAX_RECENT_TITLES]
    recent_titles_to_avoid = all_history_titles[:21]  # compat: first 21 for fingerprint block

    current_day = max(0, safe_int(tree_data.get("streak"), request_streak))
    cumulative_score = safe_int(tree_data.get("cumulative_score"), 0) if tree_data else 0
    vitality = safe_int(tree_data.get("vitality"), 50) if tree_data else None
    latest_mood = reflection_data.get("latest_mood") or ""
    streak_band = choose_streak_band(current_day)
    latest_reset_mood = reset_signal.get("latest_mood_after_reset") or ""
    suggested_intensity = choose_intensity(
        streak_band=streak_band,
        completion_pattern=history_summary["completion_pattern"],
        latest_mood=latest_mood,
        vitality=vitality,
        feedback_adaptation=feedback_adaptation,
        latest_reset_mood=latest_reset_mood,
    )

    if cleaned_struggles:
        context_used.append("struggles_db_fallback" if _db_struggles_used else "struggles")
    if task_feedback_summary.get("feedback_count"):
        context_used.append("task_feedback")

    context_note = build_context_note(
        history_summary["strong_categories"],
        history_summary["weak_categories"],
        history_summary["completion_pattern"],
    )
    feedback_note = task_feedback_summary.get("feedback_note")
    if feedback_note:
        context_note = f"{context_note} {feedback_note}"

    # Select active frameworks for today's stage
    journey_day = journey.get("journey_day") or 1
    journey_stage = journey.get("journey_stage") or "foundation"
    from ai.prompts import JOURNEY_STAGES as _JOURNEY_STAGES
    _stage = _JOURNEY_STAGES.get(journey_stage) or _JOURNEY_STAGES["foundation"]
    active_frameworks = _stage["active_frameworks"]

    return {
        "struggles": cleaned_struggles,
        "struggles_summary": struggles_summary,
        "current_day": current_day,
        "streak_band": streak_band,
        "cumulative_score": cumulative_score,
        "vitality": vitality,
        "journey_guidance": choose_journey_guidance(streak_band),
        "journey_day": journey_day,
        "journey_stage": journey_stage,
        "active_frameworks": active_frameworks,
        "completion_pattern": history_summary["completion_pattern"],
        "completion_rate": history_summary["completion_rate"],
        "strong_categories": history_summary["strong_categories"],
        "weak_categories": history_summary["weak_categories"],
        "recent_titles": recent_titles_to_avoid,
        "recent_titles_to_avoid": recent_titles_to_avoid,
        "all_history_titles": all_history_titles,
        "recent_task_fingerprints": history_summary.get("recent_task_fingerprints") or [],
        "average_duration": history_summary["average_duration"],
        "task_feedback_summary": task_feedback_summary,
        "adaptation_mode": feedback_adaptation,
        "duration_multiplier": safe_float(task_feedback_summary.get("duration_multiplier"), 1.0),
        "suggested_intensity": suggested_intensity,
        "latest_mood": latest_mood,
        "prompt_labels": reflection_data.get("prompt_labels") or [],
        "reset_signal": reset_signal,
        "context_note": context_note,
        "context_used": sorted(set(context_used)),
    }
