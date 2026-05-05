from .companion_knowledge import detect_companion_intent
from .context import CORE_CATEGORY_ORDER


INTENSITY_DURATIONS = {
    "gentle": {"awareness": 3, "action": 5, "meaning": 5},
    "normal": {"awareness": 10, "action": 15, "meaning": 10},
    "deeper": {"awareness": 20, "action": 25, "meaning": 20},
}

INTENSITY_LIMITS = {
    "gentle": (2, 10),
    "normal": (10, 20),
    "deeper": (20, 30),
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
    "none": {"type": "none", "label": "", "route": None},
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
    base_duration = INTENSITY_DURATIONS.get(intensity, INTENSITY_DURATIONS["normal"])[category]
    adaptation_mode = str(context.get("adaptation_mode") or "steady").lower()
    try:
        multiplier = float(context.get("duration_multiplier") or 1.0)
    except (TypeError, ValueError):
        multiplier = 1.0

    if adaptation_mode == "simplify":
        multiplier = min(multiplier, 0.5)
    elif adaptation_mode == "stretch_slightly":
        multiplier = max(1.0, min(multiplier, 1.15))
    else:
        multiplier = 1.0

    adjusted = round(base_duration * multiplier)
    if adaptation_mode == "stretch_slightly":
        adjusted = min(base_duration + 5, adjusted)

    min_duration, max_duration = INTENSITY_LIMITS.get(intensity, INTENSITY_LIMITS["normal"])
    return max(min_duration, min(max_duration, adjusted))


def task_metadata(context: dict, success_condition: str, smaller_version: str) -> dict:
    intensity = str(context.get("suggested_intensity") or "normal").lower()
    if intensity not in INTENSITY_DURATIONS:
        intensity = "normal"
    return {
        "difficulty_level": intensity,
        "success_condition": success_condition,
        "smaller_version": smaller_version,
        "post_completion_question": "Was this too easy, right-sized, or too heavy?",
    }


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
            **task_metadata(
                context,
                "You write one honest sentence about the pattern.",
                "Write one sentence about the pattern.",
            ),
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
            **task_metadata(
                context,
                "You begin the visible next step, even briefly.",
                "Do the first two minutes only.",
            ),
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
            **task_metadata(
                context,
                "You complete one helpful action or name who it helps.",
                "Write one sentence about who this effort helps.",
            ),
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


def has_any(text: str, phrases: list[str]) -> bool:
    lowered = str(text or "").lower()
    return any(phrase in lowered for phrase in phrases)


def detect_companion_fallback_intent(message: str) -> dict:
    lowered = str(message or "").lower().replace("’", "'")
    normalized = lowered.replace("don't", "do not").replace("dont", "do not")
    no_reflection = (
        "do not send me to reflection" in lowered
        or "don't send me to reflection" in lowered
        or "dont send me to reflection" in lowered
        or "do not send me reflection" in lowered
        or "don't send me reflection" in lowered
        or "dont send me reflection" in lowered
        or "do not need reflection" in lowered
        or "don't need reflection" in lowered
        or "dont need reflection" in lowered
        or "i don't need reflection" in lowered
        or "i dont need reflection" in lowered
        or "no journaling" in lowered
        or "no journal" in lowered
        or "no reflection" in lowered
    )
    no_task = has_any(
        lowered,
        [
            "do not want a task",
            "don't want a task",
            "dont want a task",
            "i don't want a task",
            "i dont want a task",
            "no task",
            "not a task",
            "don't make this a task",
            "dont make this a task",
        ],
    )
    no_app_action = has_any(
        normalized,
        [
            "no app",
            "no action",
            "no suggested action",
            "do not send me anywhere",
            "do not open anything",
            "do not route me",
            "do not send me to loop",
            "no loop",
            "just answer",
        ],
    )
    serious_talk = has_any(
        lowered,
        [
            "something serious",
            "talk about something serious",
            "need to talk",
            "i need to talk",
            "can we talk",
            "we need to talk",
            "serious thing",
            "serious issue",
        ],
    )
    wants_talk = has_any(
        lowered,
        [
            "want to talk",
            "i want to talk",
            "need your assistance",
            "need assistance",
            "need your help",
            "talk to me",
            "help me understand",
            "can you help me",
            "i need help",
        ],
    )
    return {
        "quote_request": has_any(
            lowered,
            [
                "quote",
                "need quote",
                "give me a quote",
                "caption",
                "one line",
                "some words",
            ],
        ),
        "moral_question": has_any(
            lowered,
            [
                "good person",
                "bad person",
                "am i good",
                "can i be good",
                "right thing",
                "wrong thing",
                "moral",
                "guilt",
            ],
        ),
        "public_speaking": has_any(
            lowered,
            [
                "seminar",
                "speech",
                "public speaking",
                "presentation",
                "stage fear",
            ],
        ),
        "serious_talk": serious_talk,
        "wants_talk": wants_talk,
        "no_task": no_task,
        "no_reflection": no_reflection,
        "no_app_action": no_app_action,
        "physical_action": has_any(
            lowered,
            [
                "physical action",
                "stand up",
                "move my body",
                "body action",
                "one thing i can do now",
                "action i can do now",
                "away from the screen",
            ],
        ),
        "routine_request": has_any(
            normalized,
            [
                "make me routine",
                "make a routine",
                "make routine",
                "create routine",
                "create a routine",
                "better routine",
                "make me better routine",
                "skipping my routine",
                "skip my routine",
                "routine according",
                "routine",
            ],
        ),
        "time_management": has_any(normalized, ["time management", "manage my time", "managing my time", "time blocking"]),
        "study_plan": has_any(
            normalized,
            ["study routine", "study plan", "exam study", "exam timetable", "study timetable", "study schedule"],
        ),
        "schedule_request": has_any(
            normalized,
            ["make schedule", "create schedule", "make timetable", "create timetable", "daily plan", "schedule", "timetable", "time table"],
        ),
        "checklist_request": has_any(normalized, ["checklist", "check list", "to-do list", "todo list"]),
        "plan_request": has_any(
            normalized,
            ["give me plan", "make plan", "make a plan", "create plan", "create a plan", "roadmap", "make roadmap", "make a roadmap", "give me steps", "suggest steps", "according to my problem"],
        ),
        "direct_help_request": has_any(
            normalized,
            ["just simply make", "do not ask, make", "do not ask just make", "make me better", "according to my odds"],
        ),
        "next_action_request": has_any(
            normalized,
            ["what should i do now", "what should i do", "give me tasks", "give me task", "give me one task", "next action", "next step", "one thing to do", "suggest next step"],
        ),
        "scrolling": has_any(lowered, ["scrolling", "doomscroll", "wasting time", "waste time"]),
        "productivity": has_any(
            lowered,
            [
                "productive",
                "productivity",
                "focus",
                "study",
                "work",
                "task",
                "procrastinat",
                "discipline",
                "start working",
                "get started",
            ],
        ),
        "purpose": has_any(
            lowered,
            [
                "purpose",
                "meaning",
                "direction",
                "feel lost",
                "feeling lost",
                "philosophy",
                "what should i read",
                "book",
            ],
        ),
        "weekly_patterns": has_any(
            lowered,
            [
                "weekly mirror",
                "this week",
                "weekly pattern",
                "patterns this week",
                "week direction",
                "my week",
            ],
        ),
        "reflective_writing": (
            not no_reflection
            and has_any(
                lowered,
                [
                    "reflect",
                    "reflection",
                    "journal",
                    "write about",
                    "write this down",
                    "understand my thoughts",
                    "process my thoughts",
                ],
            )
        ),
        "overwhelmed": has_any(
            lowered,
            ["overwhelmed", "overthinking", "pressure", "crowded", "anxious", "spiral", "stressed", "too much", "heavy"],
        ),
        "lonely": has_any(lowered, ["lonely", "alone", "sad", "isolated"]),
    }


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
    user_message: str = "",
) -> dict:
    safe_context = context or {}
    task_summary = safe_context.get("task_summary") or {}
    weekly_mirror = safe_context.get("weekly_mirror") or {}
    next_focus = weekly_mirror.get("next_focus") or "Begin with one honest, small step."
    weak_categories = task_summary.get("weak_categories") or []
    first_weak_category = weak_categories[0] if weak_categories else "action"
    flags = detect_companion_fallback_intent(user_message)
    deterministic_intent = detect_companion_intent(user_message, mode)

    if prompt_injection or deterministic_intent == "prompt_injection":
        return build_life_companion_response(
            reply=(
                "I cannot help with that request. I can still help with what is happening for you right now, in ordinary words."
            ),
            action_type="none",
            tone="grounded",
            risk_level="low",
            safety_message="The request tried to move outside the companion boundaries.",
        )

    if deterministic_intent == "quote_request":
        return build_life_companion_response(
            reply=(
                "\"Do not wait to feel fearless. Carry your preparation calmly, and let one honest sentence begin the day.\""
            ),
            action_type="none",
            tone="grounded",
        )

    if deterministic_intent == "seminar_public_speaking":
        return build_life_companion_response(
            reply=(
                "\"Let your first sentence be steady, not perfect.\" Speak slower than your nerves want. "
                "The room does not need a flawless version of you; it needs your presence and one clear idea."
            ),
            action_type="none",
            tone="grounded",
        )

    if deterministic_intent == "moral_question":
        return build_life_companion_response(
            reply=(
                "Yes, you can become a good person, not by feeling perfect, but by choosing honestly again and again. "
                "What made you ask this today: did you hurt someone, disappoint yourself, or feel afraid of who you are becoming?"
            ),
            action_type="none",
            tone="grounded",
        )

    if deterministic_intent == "identity_question":
        return build_life_companion_response(
            reply=(
                "You are not only the worst thought you have about yourself. Identity is built through repeated choices, repairs, and responsibilities. "
                "What part of yourself are you questioning most right now?"
            ),
            action_type="none",
            tone="grounded",
        )

    if deterministic_intent in {"serious_talk", "wants_talk"}:
        return build_life_companion_response(
            reply=(
                "Okay. We do not need to turn this into a task right now. Tell me the main thing: did something happen, "
                "or is this a feeling that has been building?"
            ),
            action_type="none",
            tone="serious",
            risk_level="low" if deterministic_intent == "serious_talk" else "none",
        )

    if deterministic_intent == "physical_action":
        return build_life_companion_response(
            reply=(
                "Stand up, drink water, and put your phone across the room. Then do one visible task for two minutes. "
                "No reflection needed right now, just movement."
            ),
            action_type="real_world_action",
            label="Do one physical reset",
        )

    concrete_action_type = "none" if flags["no_task"] or flags["no_app_action"] else "loop"
    concrete_label = "Open The Loop" if concrete_action_type == "loop" else None

    if deterministic_intent in {"routine_request", "time_management"}:
        return build_life_companion_response(
            reply=(
                "Use this simple routine for now:\n\n"
                "1. Start with one anchor: wake, water, bed.\n"
                "2. Do one 25-minute focus block before checking your phone.\n"
                "3. Take a five-minute reset break.\n"
                "4. Do one 45-minute main task block.\n"
                "5. End the day by writing tomorrow's first task.\n\n"
                "Keep it small enough to repeat. Your goal is consistency, not perfection."
            ),
            action_type=concrete_action_type,
            label=concrete_label,
            tone="grounded",
        )

    if deterministic_intent == "study_plan":
        return build_life_companion_response(
            reply=(
                "Use this study routine today:\n\n"
                "1. First 10 minutes: list the exact chapters or topics.\n"
                "2. Block one: 40 minutes on the easiest important topic.\n"
                "3. Break: five minutes away from the phone.\n"
                "4. Block two: 45 minutes on the hardest topic.\n"
                "5. Close: 15 minutes of recall without looking at notes.\n\n"
                "Repeat this once more only if your energy stays steady."
            ),
            action_type=concrete_action_type,
            label=concrete_label,
            tone="grounded",
        )

    if deterministic_intent == "schedule_request":
        return build_life_companion_response(
            reply=(
                "Use this simple timetable:\n\n"
                "1. Morning: 25 minutes on the easiest important task.\n"
                "2. Late morning: 45 minutes on your main task.\n"
                "3. Afternoon: one small admin or cleanup task.\n"
                "4. Evening: 30 minutes of review, practice, or preparation.\n"
                "5. Night: write tomorrow's first move before sleep.\n\n"
                "Keep the blocks flexible; the anchor matters more than the exact clock."
            ),
            action_type=concrete_action_type,
            label=concrete_label,
            tone="grounded",
        )

    if deterministic_intent == "checklist_request":
        return build_life_companion_response(
            reply=(
                "Here is your checklist:\n\n"
                "1. Choose one priority for today.\n"
                "2. Remove one obvious distraction.\n"
                "3. Work for 25 minutes on the first step.\n"
                "4. Take a five-minute reset break.\n"
                "5. Finish by writing the next step, even if today was imperfect."
            ),
            action_type=concrete_action_type,
            label=concrete_label,
            tone="grounded",
        )

    if deterministic_intent in {"plan_request", "direct_help_request"}:
        return build_life_companion_response(
            reply=(
                "Here is a simple plan:\n\n"
                "1. Name the problem in one line.\n"
                "2. Pick the smallest action that proves movement.\n"
                "3. Do it for 25 minutes before checking your phone.\n"
                "4. Take a short reset instead of quitting completely.\n"
                "5. End by choosing tomorrow's first task.\n\n"
                "Do not build a perfect system. Build one repeatable move."
            ),
            action_type=concrete_action_type,
            label=concrete_label,
            tone="grounded",
        )

    if deterministic_intent == "next_action_request":
        next_action_type = "none" if flags["no_task"] or flags["no_app_action"] else "real_world_action"
        next_action_label = "Carry This Step" if next_action_type == "real_world_action" else None
        return build_life_companion_response(
            reply=(
                "Do this now: stand up, drink water, clear one small surface, then work for ten minutes on the easiest useful task. "
                "After ten minutes, stop and choose whether to continue for one more block."
            ),
            action_type=next_action_type,
            label=next_action_label,
            tone="grounded",
        )

    if flags["no_task"] or flags["no_reflection"]:
        if flags["no_reflection"]:
            reply = (
                "Understood. No Reflection page. We can keep this here: what do you need help sorting out first?"
            )
        else:
            reply = (
                "Got it. No task right now. Let's just name the shape of it: what feels most urgent to say?"
            )
        return build_life_companion_response(
            reply=reply,
            action_type="none",
        )

    if deterministic_intent == "anxiety_overwhelm":
        return build_life_companion_response(
            reply=(
                "First, lower the pressure to solve everything. Put both feet on the floor, unclench your jaw, "
                "and take one slow breath. What is the single thought looping the loudest right now?"
            ),
            action_type="reset",
            label="Open Reset Space",
            tone="grounded",
        )

    if deterministic_intent == "loneliness":
        return build_life_companion_response(
            reply=(
                "That sounds lonely, and it does not need a productivity answer. "
                "What kind of connection are you missing most right now: being understood, being included, or having someone stay?"
            ),
            action_type="none",
            tone="grounded",
        )

    if deterministic_intent == "scrolling_distraction":
        return build_life_companion_response(
            reply=(
                "The scrolling is probably doing a job: delaying the first uncomfortable step. Put the phone face down, "
                "stand up, drink water, then do two minutes of the smallest visible task."
            ),
            action_type="real_world_action",
            label="Break The Scroll",
        )

    if deterministic_intent == "productivity":
        return build_life_companion_response(
            reply=(
                "You do not need a perfect system right now. You need a clean first move. Open the smallest task, "
                "work for five minutes, and stop before your brain turns it into a life referendum."
            ),
            action_type="loop",
            label="Open The Loop",
        )

    if deterministic_intent == "reset_need":
        return build_life_companion_response(
            reply=(
                "When everything feels loud, the next move is not to solve everything. Lower the volume first: "
                "unclench your jaw, breathe once, and choose only the next visible step."
            ),
            action_type="reset",
            label="Open Reset Space",
        )

    if deterministic_intent == "purpose_question":
        return build_life_companion_response(
            reply=(
                "Purpose usually does not arrive as a lightning bolt; it shows up through repeated honest choices. "
                "Start with this: what responsibility, person, or skill still feels worth becoming stronger for?"
            ),
            action_type="none",
        )

    if deterministic_intent == "reading_or_learning":
        return build_life_companion_response(
            reply=(
                "A good idea can become a handrail when life feels vague. Choose one book or idea that makes you more honest, "
                "then test one sentence from it in your day."
            ),
            action_type="curator",
            label="Open Curator",
        )

    if deterministic_intent == "weekly_pattern":
        return build_life_companion_response(
            reply=(
                "For patterns, the useful view is wider than this one moment. Check your latest Weekly Mirror, then bring back the part that feels true."
            ),
            action_type="weekly_mirror",
            label="Open Dashboard",
        )

    if deterministic_intent == "reflective_writing":
        return build_life_companion_response(
            reply=(
                "Writing can help if you want to understand the thought rather than solve it instantly. Start with one plain line: what keeps returning?"
            ),
            action_type="reflection",
            label="Open Reflection",
        )

    if mode == "make_today_easier":
        return build_life_companion_response(
            reply=(
                "The friction makes sense. When the day feels heavy, the useful move is not a perfect plan; "
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
        if flags["no_reflection"]:
            return build_life_companion_response(
                reply=(
                    "Understood. We can skip Reflection. Say the problem in one plain sentence here, and we can work from that."
                ),
                action_type="none",
            )
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
            "I understand. Let's keep this close to the ground: name the strongest thing in the room right now, "
            "then we can decide whether this needs conversation, a reset, or a small action. What is the part you want help with first?"
        ),
        action_type="none",
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
