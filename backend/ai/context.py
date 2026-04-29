import hashlib
import json
from collections import Counter
from datetime import date, datetime, timedelta


ALLOWED_LOOP_CATEGORIES = {"awareness", "action", "meaning"}
CORE_CATEGORY_ORDER = ["awareness", "action", "meaning"]
MAX_CONTEXT_STRUGGLES = 4
MAX_STRUGGLE_CHARS = 48
MAX_RECENT_TITLES = 8
MAX_PROMPT_LABELS = 3
MAX_WEEKLY_REFLECTIONS = 7
MAX_WEEKLY_TASKS = 21
MAX_WEEKLY_ANSWER_EXCERPTS = 2
MAX_WEEKLY_ANSWER_EXCERPT_CHARS = 180
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
            f"error={type(error).__name__}:{str(error)}"
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
    week_start = (current_date - timedelta(days=6)).isoformat()
    rows = table_select_optional(
        supabase,
        "loop_tasks",
        "loop_tasks_history",
        {
            "select": "title,category,done,completed_at,skipped,is_optional,duration_minutes,for_date,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("gte", ("for_date", week_start)),
                ("lte", ("for_date", current_date.isoformat())),
                ("order", ("for_date",), {"desc": True}),
                ("limit", (60,)),
            ],
        },
    )
    return rows, bool(rows)


def extract_prompt_label(item: object) -> str:
    if isinstance(item, dict):
        return clean_short_text(item.get("prompt") or item.get("q") or "", 56)
    if isinstance(item, str):
        return clean_short_text(item, 56)
    return ""


def extract_answer_excerpt(item: object) -> str:
    if not isinstance(item, dict):
        return ""
    answer = item.get("answer") if "answer" in item else item.get("a")
    return clean_short_text(answer, MAX_WEEKLY_ANSWER_EXCERPT_CHARS)


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
    rows = table_select_optional(
        supabase,
        "profiles",
        "life_companion_profile",
        {
            "select": "struggle_tags,struggle_cluster,onboarding_completed",
            "ops": [
                ("eq", ("id", user_id)),
                ("limit", (1,)),
            ],
        },
    )
    if not rows:
        return {}, False

    row = rows[0]
    struggle_tags = row.get("struggle_tags") if isinstance(row.get("struggle_tags"), list) else []
    return {
        "struggle_tags": [
            clean_short_text(tag, 48)
            for tag in struggle_tags
            if clean_short_text(tag, 48)
        ][:4],
        "struggle_cluster": clean_short_text(row.get("struggle_cluster"), 48),
        "onboarding_completed": bool(row.get("onboarding_completed")),
    }, True


def build_life_companion_context(supabase, user_id: str, mode: str) -> dict:
    task_rows, has_tasks = fetch_life_companion_today_tasks(supabase, user_id)
    tree_data, has_tree = fetch_user_tree_context(supabase, user_id)
    latest_reflection, has_reflection = fetch_life_companion_latest_reflection(supabase, user_id)
    weekly_mirror, has_weekly_mirror = fetch_life_companion_weekly_mirror(supabase, user_id)
    onboarding_context, has_onboarding = fetch_life_companion_onboarding_context(supabase, user_id)
    task_summary = summarize_life_companion_tasks(task_rows)
    tree_summary = {
        "streak": safe_int(tree_data.get("streak"), 0) if has_tree else 0,
        "vitality": safe_int(tree_data.get("vitality"), 0) if has_tree else 0,
        "cumulative_score": safe_int(tree_data.get("cumulative_score"), 0) if has_tree else 0,
    }

    return {
        "user_id": user_id,
        "mode": mode,
        "local_date": date.today().isoformat(),
        "task_summary": task_summary,
        "latest_inner_weather": latest_reflection,
        "weekly_mirror": weekly_mirror,
        "tree_summary": tree_summary,
        "streak_band": choose_streak_band(tree_summary["streak"]),
        "onboarding_need": onboarding_context,
        "context_used": [
            source
            for source, present in {
                "today_tasks": has_tasks,
                "latest_mood": has_reflection and bool(latest_reflection.get("latest_mood")),
                "prompt_labels": has_reflection and bool(latest_reflection.get("prompt_labels")),
                "weekly_mirror": has_weekly_mirror,
                "user_tree": has_tree,
                "onboarding_need": has_onboarding,
            }.items()
            if present
        ],
    }


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
        answer_excerpts = [
            excerpt
            for excerpt in (extract_answer_excerpt(item) for item in questions)
            if excerpt
        ][:MAX_WEEKLY_ANSWER_EXCERPTS]
        prompt_context.append({
            "for_date": str(row.get("for_date") or ""),
            "mood": clean_short_text(row.get("mood"), 24),
            "prompt_labels": prompt_labels,
            "answer_excerpts": answer_excerpts,
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

    for row in rows:
        category = normalize_category(row.get("category"))
        if category not in stats or bool(row.get("is_optional")):
            continue

        stats[category]["total"] += 1
        if row.get("completed_at") or row.get("done"):
            stats[category]["completed"] += 1
        if row.get("skipped"):
            stats[category]["skipped"] += 1

        duration = safe_int(row.get("duration_minutes"), 0)
        if duration > 0:
            durations.append(duration)

        title = clean_short_text(row.get("title"), 56)
        title_key = title.lower()
        if title and title_key not in seen_titles:
            seen_titles.add(title_key)
            recent_titles.append(title)

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

    return {
        "completion_pattern": completion_pattern,
        "completion_rate": round(completion_rate, 2),
        "strong_categories": strong_categories[:2],
        "weak_categories": weak_categories[:2],
        "recent_titles_to_avoid": recent_titles[:MAX_RECENT_TITLES],
        "average_duration": average_duration,
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
) -> str:
    mood = str(latest_mood or "").lower()
    heavy_moods = {"heavy", "sad", "low", "tired", "anxious", "overwhelmed", "drained"}
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


def build_generation_context(
    struggles: list[str],
    current_streak: int,
    supabase=None,
    user_id: str | None = None,
    local_date: str | None = None,
    existing_tasks: list[dict] | None = None,
) -> dict:
    cleaned_struggles = clean_request_struggles(struggles)
    struggles_summary = (
        ", ".join(cleaned_struggles)
        if cleaned_struggles
        else "overthinking, distraction, and inconsistency"
    )
    request_streak = max(0, safe_int(current_streak, 0))
    tree_data: dict = {}
    task_history: list[dict] = []
    reflection_data: dict = {}
    context_used = ["streak"]

    if supabase is not None and user_id:
        tree_data, has_tree = fetch_user_tree_context(supabase, user_id)
        if has_tree:
            context_used.append("user_tree")

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

    history_summary = summarize_task_history(task_history)
    existing_titles = [
        str(task.get("title") or "").strip()
        for task in (existing_tasks or [])
        if str(task.get("title") or "").strip()
    ]
    recent_titles_to_avoid = [
        title
        for title in [*existing_titles, *history_summary["recent_titles_to_avoid"]]
        if title
    ][:MAX_RECENT_TITLES]

    current_day = max(0, safe_int(tree_data.get("streak"), request_streak))
    cumulative_score = safe_int(tree_data.get("cumulative_score"), 0) if tree_data else 0
    vitality = safe_int(tree_data.get("vitality"), 50) if tree_data else None
    latest_mood = reflection_data.get("latest_mood") or ""
    streak_band = choose_streak_band(current_day)
    suggested_intensity = choose_intensity(
        streak_band=streak_band,
        completion_pattern=history_summary["completion_pattern"],
        latest_mood=latest_mood,
        vitality=vitality,
    )

    if cleaned_struggles:
        context_used.append("struggles")

    return {
        "struggles": cleaned_struggles,
        "struggles_summary": struggles_summary,
        "current_day": current_day,
        "streak_band": streak_band,
        "cumulative_score": cumulative_score,
        "vitality": vitality,
        "journey_guidance": choose_journey_guidance(streak_band),
        "completion_pattern": history_summary["completion_pattern"],
        "completion_rate": history_summary["completion_rate"],
        "strong_categories": history_summary["strong_categories"],
        "weak_categories": history_summary["weak_categories"],
        "recent_titles": recent_titles_to_avoid,
        "recent_titles_to_avoid": recent_titles_to_avoid,
        "average_duration": history_summary["average_duration"],
        "suggested_intensity": suggested_intensity,
        "latest_mood": latest_mood,
        "prompt_labels": reflection_data.get("prompt_labels") or [],
        "context_note": build_context_note(
            history_summary["strong_categories"],
            history_summary["weak_categories"],
            history_summary["completion_pattern"],
        ),
        "context_used": sorted(set(context_used)),
    }
