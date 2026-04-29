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

MOOD_DESCRIPTIONS = {
    "clear": "a clearer, steadier tone",
    "heavy": "a heavier emotional weather",
    "restless": "a restless current",
    "grateful": "a softer, grateful tone",
    "hopeful": "a hopeful pull toward movement",
    "quiet": "a quieter inner weather",
    "numb": "a harder-to-name inner weather",
    "sad": "a lower emotional weather",
    "low": "a lower emotional weather",
    "tired": "a tired, slower rhythm",
    "anxious": "a restless and uncertain rhythm",
    "overwhelmed": "a crowded inner weather",
    "drained": "a drained, low-energy pattern",
}

CATEGORY_LABELS = {
    "awareness": "noticing the pattern before acting",
    "action": "turning thought into one concrete step",
    "meaning": "connecting effort to something that matters",
}

DEFAULT_RECOMMENDATION = {
    "type": "task",
    "title": "Start one tiny action",
    "reason": "The Mirror noticed the week needs one grounded next step. A small thing that may help now is one visible action.",
    "action_label": "Open The Loop",
}

COMPANION_ACTIONS = {
    "loop": {"type": "loop", "label": "Open The Loop", "route": "/loop"},
    "reflection": {"type": "reflection", "label": "Open Reflection", "route": "/reflection"},
    "reset": {"type": "reset", "label": "Open Reset Space", "route": "/meditation"},
    "curator": {"type": "curator", "label": "Open Curator", "route": "/curator"},
    "weekly_mirror": {"type": "weekly_mirror", "label": "Open Dashboard", "route": "/dashboard"},
    "real_world_action": {"type": "real_world_action", "label": "Carry This Step", "route": None},
    "none": {"type": "none", "label": "No action", "route": None},
}

MIRROR_RECOMMENDATION_TO_COMPANION_ACTION = {
    "task": "loop",
    "reflection": "reflection",
    "reset": "reset",
    "book": "curator",
    "real_world_action": "real_world_action",
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


def first_key(counts: dict, fallback: str = "") -> str:
    if not isinstance(counts, dict) or not counts:
        return fallback
    return next(iter(counts.keys()), fallback)


def describe_category(category: str, fallback: str) -> str:
    return CATEGORY_LABELS.get(str(category or "").lower(), fallback)


def choose_weekly_recommendation(context: dict | None = None) -> dict:
    signals = (context or {}).get("pattern_signals") or {}

    if signals.get("distraction_or_scrolling"):
        return {
            "type": "task",
            "title": "Start one tiny action",
            "reason": "The Mirror noticed action was harder to carry this week. A small thing that may help now is one visible step.",
            "action_label": "Open The Loop",
        }

    if signals.get("overthinking_or_mental_noise"):
        return {
            "type": "reflection",
            "title": "Name the loop once",
            "reason": "This week seemed to ask for one quiet naming moment. A small reflection can turn mental noise into a clearer next step.",
            "action_label": "Reflect Tonight",
        }

    if signals.get("loneliness_or_emotional_heaviness"):
        return {
            "type": "real_world_action",
            "title": "Send one honest message",
            "reason": "The Mirror noticed heavier emotional weather this week. One grounded connection step may help the day feel less alone.",
            "action_label": "Carry This Step",
        }

    if signals.get("lack_of_purpose_or_lost"):
        return {
            "type": "book",
            "title": "Choose a purpose-led read",
            "reason": "This week seemed to ask for direction rather than a perfect answer. A carefully chosen book can give the next step a steadier frame.",
            "action_label": "Open Curator",
        }

    if signals.get("inconsistency_or_starting_quitting"):
        return {
            "type": "task",
            "title": "Repeat one small promise",
            "reason": "The Mirror noticed starts and stops around action this week. One tiny repeatable task can make consistency feel reachable.",
            "action_label": "Open The Loop",
        }

    return dict(DEFAULT_RECOMMENDATION)


def companion_action(action_type: str, label: str | None = None) -> dict:
    action = dict(COMPANION_ACTIONS.get(action_type, COMPANION_ACTIONS["none"]))
    if label:
        action["label"] = label
    return action


def build_life_companion_response(
    *,
    reply: str,
    action_type: str,
    label: str | None = None,
    tone: str = "grounded",
    risk_level: str = "none",
    safety_message: str | None = None,
) -> dict:
    return {
        "reply": reply,
        "suggested_action": companion_action(action_type, label),
        "tone": tone,
        "safety": {
            "risk_level": risk_level,
            "message": safety_message,
        },
    }


def generate_life_companion_crisis_response() -> dict:
    return build_life_companion_response(
        reply=(
            "I am really glad you said this here. If you might hurt yourself or you are in immediate danger, "
            "please contact local emergency services now or reach a trusted person who can stay with you. "
            "Do not stay alone with this if the danger feels close."
        ),
        action_type="none",
        tone="serious",
        risk_level="crisis",
        safety_message="Immediate support is more important than using the app right now.",
    )


def choose_companion_action_from_weekly_mirror(context: dict) -> dict | None:
    recommendation = ((context.get("weekly_mirror") or {}).get("recommended_next_step") or {})
    recommendation_type = str(recommendation.get("type") or "").strip().lower()
    action_type = MIRROR_RECOMMENDATION_TO_COMPANION_ACTION.get(recommendation_type)
    if not action_type:
        return None
    return companion_action(
        action_type,
        recommendation.get("action_label") or COMPANION_ACTIONS[action_type]["label"],
    )


def generate_life_companion_fallback(
    mode: str,
    context: dict | None = None,
    *,
    prompt_injection: bool = False,
) -> dict:
    safe_context = context or {}
    task_summary = safe_context.get("task_summary") or {}
    weekly_mirror = safe_context.get("weekly_mirror") or {}
    next_focus = weekly_mirror.get("next_focus") or "Begin with one honest, small step."
    weak_categories = task_summary.get("weak_categories") or []
    first_weak_category = weak_categories[0] if weak_categories else "action"

    if prompt_injection:
        return build_life_companion_response(
            reply=(
                "I cannot help with that request. What I can do is stay with your actual day: "
                "choose one grounded step, then return to the app area that supports it."
            ),
            action_type="loop",
            tone="grounded",
            risk_level="low",
            safety_message="The request tried to move outside the companion boundaries.",
        )

    if mode == "make_today_easier":
        return build_life_companion_response(
            reply=(
                "I hear the friction. When the day feels heavy, the useful move is not a perfect plan; "
                f"it is one smaller {first_weak_category} step. Open The Loop and choose the task that takes the least resistance."
            ),
            action_type="loop",
        )

    if mode == "reset_my_mind":
        return build_life_companion_response(
            reply=(
                "Your mind sounds like it needs less argument and more ground. Give it a short reset: breathe, lower the pressure, "
                "and let the next choice become visible after your body settles."
            ),
            action_type="reset",
        )

    if mode == "help_me_reflect":
        return build_life_companion_response(
            reply=(
                "You do not need a perfect reflection tonight. Start with one line: "
                "\"The thing I kept returning to today was...\" That is enough to open the door."
            ),
            action_type="reflection",
            label="Open Reflection",
        )

    if mode == "suggest_next_step":
        mirror_action = choose_companion_action_from_weekly_mirror(safe_context)
        if mirror_action:
            return {
                "reply": (
                    f"Your latest Weekly Mirror points toward this focus: {next_focus} "
                    "You do not need to solve the whole pattern today. Carry one clear next step."
                ),
                "suggested_action": mirror_action,
                "tone": "grounded",
                "safety": {"risk_level": "none", "message": None},
            }
        return build_life_companion_response(
            reply=(
                "The cleanest next step is to give the day one shape. Open The Loop and choose the smallest useful action available."
            ),
            action_type="loop",
        )

    return build_life_companion_response(
        reply=(
            "I hear you. When the inside feels crowded, it helps to name the pattern without turning it into a verdict. "
            "Take one honest step now, then let the larger answer come later."
        ),
        action_type="reflection",
        label="Open Reflection",
    )


def generate_insufficient_weekly_mirror(context: dict | None = None) -> dict:
    return {
        "week_sentence": "Your Weekly Mirror is still forming through a few more reflections and small actions.",
        "inner_weather_pattern": "There is not enough weekly signal yet to name a pattern with care.",
        "repeated_theme": "A clearer theme will appear after a little more lived data.",
        "helped_forward": "Saving one reflection or completing one small task will give the mirror something real to hold.",
        "pulled_back": "The week is still too quiet in the app to reflect back responsibly.",
        "weekly_question": "What is one small moment worth noticing before this week ends?",
        "next_focus": "Leave one honest trace each day.",
        "recommended_next_step": {
            "type": "reflection",
            "title": "Leave one honest trace",
            "reason": "The Mirror has only a little weekly signal so far. A small reflection will help next week's pattern form with more care.",
            "action_label": "Reflect Tonight",
        },
    }


def generate_fallback_weekly_mirror(context: dict) -> dict:
    input_summary = context.get("input_summary") or {}
    task_summary = context.get("task_summary") or {}
    tree_summary = context.get("tree_summary") or {}
    mood = first_key(input_summary.get("mood_counts") or {}, "")
    completed_category = first_key(task_summary.get("completed_categories") or {}, "")
    skipped_category = first_key(task_summary.get("skipped_categories") or {}, "")
    reflection_count = int((context.get("data_points") or {}).get("reflections") or 0)
    completed_count = int(task_summary.get("completed_task_count") or 0)
    skipped_count = int(task_summary.get("skipped_task_count") or 0)
    streak = int(tree_summary.get("streak") or 0)

    mood_phrase = MOOD_DESCRIPTIONS.get(mood.lower(), "mixed inner weather") if mood else "mixed inner weather"
    helped_phrase = (
        describe_category(completed_category, "small completed actions")
        if completed_count
        else "returning to awareness in small ways"
    )
    pulled_phrase = (
        describe_category(skipped_category, "an area that was harder to begin")
        if skipped_count
        else "the gap between noticing and beginning"
    )
    theme_phrase = describe_category(
        completed_category or skipped_category,
        "choosing a small next step before the whole week feels clear",
    )

    if reflection_count and completed_count:
        week_sentence = "This week seemed to pair reflection with small moments of movement."
    elif reflection_count:
        week_sentence = "This week seemed to leave a quiet trail of reflection and returning awareness."
    else:
        week_sentence = "This week began forming a pattern through small actions and returning awareness."

    if streak > 0:
        helped_forward = f"What helped most was {helped_phrase}, supported by a continuing streak."
    else:
        helped_forward = f"What helped most was {helped_phrase}."

    return {
        "week_sentence": week_sentence,
        "inner_weather_pattern": f"Your reflections suggest {mood_phrase}.",
        "repeated_theme": f"One pattern that appeared was {theme_phrase}.",
        "helped_forward": helped_forward,
        "pulled_back": f"What seemed to pull back momentum was {pulled_phrase}.",
        "weekly_question": "What small promise can still be kept when the mood changes?",
        "next_focus": "Begin smaller, but begin honestly.",
        "recommended_next_step": choose_weekly_recommendation(context),
    }
