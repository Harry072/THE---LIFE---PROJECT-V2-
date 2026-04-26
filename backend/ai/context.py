from datetime import date, datetime, timedelta


ALLOWED_LOOP_CATEGORIES = {"awareness", "action", "meaning"}
CORE_CATEGORY_ORDER = ["awareness", "action", "meaning"]
MAX_CONTEXT_STRUGGLES = 4
MAX_STRUGGLE_CHARS = 48
MAX_RECENT_TITLES = 8
MAX_PROMPT_LABELS = 3

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
