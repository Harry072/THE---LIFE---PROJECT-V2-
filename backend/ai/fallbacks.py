from .context import CORE_CATEGORY_ORDER


INTENSITY_DURATIONS = {
    "gentle": {"awareness": 3, "action": 5, "meaning": 5},
    "normal": {"awareness": 10, "action": 15, "meaning": 10},
    "deeper": {"awareness": 20, "action": 25, "meaning": 20},
}

ALTERNATE_TITLES = {
    "awareness": [
        "Notice the Main Thought",
        "Name What Is Pulling You",
        "Write One Honest Line",
    ],
    "action": [
        "Finish One Small Step",
        "Move One Task Forward",
        "Clear One Useful Thing",
    ],
    "meaning": [
        "Make Tomorrow Easier",
        "Choose One Helpful Act",
        "Support Your Future Self",
    ],
}


def normalize_title(value: str) -> str:
    return " ".join(str(value or "").lower().split())


def avoid_recent_title(category: str, preferred_title: str, recent_titles: list[str]) -> str:
    avoided_titles = {normalize_title(title) for title in recent_titles if normalize_title(title)}
    if normalize_title(preferred_title) not in avoided_titles:
        return preferred_title

    for title in ALTERNATE_TITLES[category]:
        if normalize_title(title) not in avoided_titles:
            return title

    return f"{preferred_title} Today"


def get_duration(context: dict, category: str) -> int:
    intensity = str(context.get("suggested_intensity") or "normal").lower()
    return INTENSITY_DURATIONS.get(intensity, INTENSITY_DURATIONS["normal"])[category]


def minute_word(minutes: int) -> str:
    return "minute" if minutes == 1 else "minutes"


def generate_fallback_tasks(context: dict) -> list[dict]:
    current_day = int(context.get("current_day") or 0)
    struggles = context.get("struggles") or []
    struggles_summary = context.get("struggles_summary") or "today's loop"
    weak_categories = set(context.get("weak_categories") or [])
    latest_mood = str(context.get("latest_mood") or "").lower()
    recent_titles = context.get("recent_titles_to_avoid") or context.get("recent_titles") or []
    is_early = current_day < 5
    lowered_struggles = {str(struggle).lower() for struggle in struggles}
    has_scrolling = any("scroll" in struggle for struggle in lowered_struggles)
    has_low_motivation = any("motivation" in struggle for struggle in lowered_struggles)
    is_gentle = context.get("suggested_intensity") == "gentle"

    awareness_duration = get_duration(context, "awareness")
    action_duration = get_duration(context, "action")
    meaning_duration = get_duration(context, "meaning")

    if latest_mood == "heavy":
        awareness_action = "Write the thought that felt heaviest today."
        action_step = f"Give {action_duration} {minute_word(action_duration)} to one small task you can finish."
        meaning_action = "Do one thing that makes tomorrow easier."
    elif latest_mood == "restless":
        awareness_action = f"Sit for {min(awareness_duration, 5)} minutes and name where your mind keeps running."
        action_step = "Clear one small physical space."
        meaning_action = "Choose one action that supports the person you are becoming."
    else:
        awareness_action = (
            "Write the moment you most often reach for your phone today."
            if has_scrolling
            else "Write one loop you noticed in yourself today."
        )
        action_step = (
            "Stand up, drink water, and do one two-minute reset."
            if has_low_motivation or is_early or is_gentle
            else "Work for ten minutes on one task you have been avoiding."
        )
        meaning_action = "Do one thing that makes tomorrow easier for you or someone else."

    if "awareness" in weak_categories:
        awareness_action = "Write one honest sentence about what is happening right now."
    if "action" in weak_categories:
        action_step = "Spend five minutes on the easiest visible next step."
    if "meaning" in weak_categories:
        meaning_action = "Write one sentence naming who your next effort helps."

    tasks_by_category = {
        "awareness": {
            "category": "awareness",
            "title": avoid_recent_title("awareness", "Name Today's Loop", recent_titles),
            "subtitle": "Awareness Practice",
            "why_this_helps": f"Naming {struggles_summary} creates space for one clearer choice.",
            "detail_description": f"Clarity starts with one honest note. Action: {awareness_action}",
            "duration_minutes": awareness_duration,
            "preferred_time_of_day": "morning",
            "supportive_line": "You only need to notice one pattern today.",
            "why_chosen": "This keeps the first step small and visible.",
            "easier_version": "Write one sentence about the pattern.",
        },
        "action": {
            "category": "action",
            "title": avoid_recent_title("action", "Take One Useful Step", recent_titles),
            "subtitle": "Action Practice",
            "why_this_helps": "A small action interrupts the loop without asking for a perfect day.",
            "detail_description": f"Momentum returns through one useful movement. Action: {action_step}",
            "duration_minutes": action_duration,
            "preferred_time_of_day": "afternoon",
            "supportive_line": "Starting small still counts.",
            "why_chosen": "This turns pressure into a concrete next move.",
            "easier_version": "Do the first two minutes only.",
        },
        "meaning": {
            "category": "meaning",
            "title": avoid_recent_title("meaning", "Make Tomorrow Lighter", recent_titles),
            "subtitle": "Meaning Practice",
            "why_this_helps": "Meaning grows when one action serves a future you care about.",
            "detail_description": f"A small helpful act can reconnect effort to purpose. Action: {meaning_action}",
            "duration_minutes": meaning_duration,
            "preferred_time_of_day": "evening",
            "supportive_line": "Small service can make today feel less random.",
            "why_chosen": "This connects effort to something beyond the current mood.",
            "easier_version": "Write one sentence about who this effort helps.",
        },
    }

    return [tasks_by_category[category] for category in CORE_CATEGORY_ORDER]
