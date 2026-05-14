import re as _fb_re

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
        "Sit With One Pattern",
        "Trace the Mood to Its Source",
        "Catch the Automatic Thought",
        "Name What Today Actually Feels Like",
        "Write the Sentence You Keep Avoiding",
        "Find the Pattern Behind the Pattern",
        "Watch One Habit Without Changing It",
        "Name the Gap Between Intention and Action",
        "Write One True Thing About Right Now",
    ],
    "action": [
        "Finish One Small Step",
        "Move One Task Forward",
        "Clear One Useful Thing",
        "Begin the Avoided Task",
        "Do One Thing Right Now",
        "Remove One Small Obstacle",
        "Spend Five Minutes on the Hardest Item",
        "Take the Next Visible Step",
        "Complete One Thing on the List",
        "Make One Decision You Have Been Postponing",
        "Start the Task With Just Two Minutes",
        "Do the Smallest Useful Thing",
    ],
    "meaning": [
        "Make Tomorrow Easier",
        "Choose One Helpful Act",
        "Support Your Future Self",
        "Do One Thing That Matters",
        "Name Who This Effort Helps",
        "Leave Something Better Than You Found It",
        "Do One Act That Aligns With Your Values",
        "Create One Good Thing Today",
        "Make One Small Contribution",
        "Do Something Future-You Will Thank You For",
        "Invest Five Minutes in Something That Lasts",
        "Connect One Action to a Larger Purpose",
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

BOOK_RECOMMENDATION_INTENTS = {
    "philosophy_novel_recommendation",
    "novel_recommendation",
    "self_growth_book_request",
    "book_recommendation",
    "reading_request",
    "curator_request",
    "reading_or_learning",
}


_FB_STOP_WORDS = {
    "a", "an", "the", "and", "or", "one", "your", "you", "this",
}


def _fb_significant_words(text: str) -> set[str]:
    return {
        w for w in _fb_re.findall(r"[a-z]{3,}", str(text or "").lower())
        if w not in _FB_STOP_WORDS
    }


def _fb_overlap_ratio(a: str, b: str) -> float:
    wa, wb = _fb_significant_words(a), _fb_significant_words(b)
    if len(wa) < 2 or len(wb) < 2:
        return 0.0
    inter = wa & wb
    union = wa | wb
    return len(inter) / len(union) if union else 0.0


def normalize_title(value: str) -> str:
    return " ".join(str(value or "").lower().split())


def avoid_recent_title(category: str, preferred_title: str, recent_titles: list[str]) -> str:
    avoided_normalized = {normalize_title(t) for t in recent_titles if normalize_title(t)}

    def _too_similar(candidate: str) -> bool:
        if normalize_title(candidate) in avoided_normalized:
            return True
        return any(_fb_overlap_ratio(candidate, t) >= 0.65 for t in recent_titles)

    if not _too_similar(preferred_title):
        return preferred_title

    for title in ALTERNATE_TITLES[category]:
        if not _too_similar(title):
            return title

    return f"{preferred_title} — One Step"


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
    reply_format: str | None = None,
    sections: list[dict] | None = None,
    intent: str | None = None,
) -> dict:
    result = {
        "reply": reply,
        "suggested_action": companion_action(action_type, label),
        "tone": tone,
        "safety": {
            "risk_level": risk_level,
            "message": safety_message,
        },
    }
    if reply_format is not None:
        result["reply_format"] = reply_format
    if sections is not None:
        result["sections"] = sections
    if intent is not None:
        result["intent"] = intent
    return result


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


def _wants_novels(message: str, intent: str) -> bool:
    lowered = str(message or "").lower()
    return intent in {"philosophy_novel_recommendation", "novel_recommendation"} or has_any(
        lowered,
        ["novel", "novels", "fiction"],
    )


def _wants_philosophy_novels(message: str, intent: str) -> bool:
    lowered = str(message or "").lower()
    return intent == "philosophy_novel_recommendation" or (
        has_any(lowered, ["philosophy", "philosophical"])
        and has_any(lowered, ["novel", "novels", "fiction"])
    )


def _wants_discipline_books(message: str) -> bool:
    lowered = str(message or "").lower()
    return has_any(
        lowered,
        [
            "discipline",
            "habit",
            "habits",
            "focus",
            "self-growth",
            "self growth",
            "self improvement",
            "productivity",
            "deep work",
        ],
    )


def _book_action_type(flags: dict) -> tuple[str, str | None]:
    if flags.get("no_app_action"):
        return "none", None
    return "curator", "Open Curator"


def build_book_recommendation_fallback(
    *,
    intent: str,
    user_message: str,
    flags: dict,
    safe_memory: dict | None = None,
    knowledge_chunks: list[dict] | None = None,
) -> dict:
    action_type, label = _book_action_type(flags)
    _chunk_ids = [str(chunk.get("id") or "") for chunk in (knowledge_chunks or []) if isinstance(chunk, dict)]
    wants_philosophy = _wants_philosophy_novels(user_message, intent) or "philosophy_novels" in _chunk_ids
    wants_novels = _wants_novels(user_message, intent)
    wants_discipline = intent == "self_growth_book_request" or _wants_discipline_books(user_message)
    support_style = str((safe_memory or {}).get("support_style") or "").lower()

    if wants_philosophy:
        reply = "You want a philosophy novel that soothes your mind, not another task. Start with these."
        if "gentle" in support_style:
            reply += " Keep the first pick light and reflective."
        return build_life_companion_response(
            reply=reply,
            action_type=action_type,
            label=label,
            tone="grounded",
            reply_format="book_recommendation",
            intent="philosophy_novel_recommendation",
            sections=[
                {
                    "title": "Start here",
                    "items": [
                        "Siddhartha - calm, spiritual, and about inner discovery.",
                        "The Alchemist - simple, reflective, and good when you feel directionless.",
                        "The Little Prince - short, poetic, and gentle for the mind.",
                    ],
                },
                {
                    "title": "If you want deeper",
                    "items": [
                        "The Stranger - philosophical, but colder and heavier.",
                        "The Unbearable Lightness of Being - reflective, mature, and emotionally complex.",
                    ],
                },
                {
                    "title": "Best first pick",
                    "body": "Start with Siddhartha if you want calm philosophy and inner reflection.",
                },
            ],
        )

    if wants_novels:
        return build_life_companion_response(
            reply=(
                "You do not want another routine right now. Here are novels that can give your mind a different space. "
                "These are suggestions, not prescriptions."
            ),
            action_type=action_type,
            label=label,
            tone="grounded",
            reply_format="book_recommendation",
            intent="novel_recommendation",
            sections=[
                {
                    "title": "Start here",
                    "items": [
                        "The Alchemist - simple, reflective, good when you feel lost.",
                        "Siddhartha - calm, spiritual, about inner discovery.",
                        "The Little Prince - short, poetic, emotionally gentle.",
                    ],
                },
                {
                    "title": "If you want deeper",
                    "items": [
                        "The Midnight Library - regret, choices, and meaning.",
                        "Norwegian Wood - reflective and emotional, but heavier.",
                    ],
                },
                {
                    "title": "Best first pick",
                    "body": "Start with The Alchemist if you want something light and meaningful.",
                },
            ],
        )

    if wants_discipline:
        return build_life_companion_response(
            reply=(
                "For discipline, start with non-fiction before novels. These are suggestions, not prescriptions."
            ),
            action_type=action_type,
            label=label,
            tone="grounded",
            reply_format="book_recommendation",
            intent="self_growth_book_request",
            sections=[
                {
                    "title": "Start here",
                    "items": [
                        "Atomic Habits - practical systems for making discipline easier.",
                        "Deep Work - focus, attention, and protecting serious work.",
                        "Man's Search for Meaning - responsibility and meaning under pressure.",
                    ],
                },
                {
                    "title": "If you want deeper",
                    "items": [
                        "The Courage to Be Disliked - agency, boundaries, and courage.",
                        "Think Like a Monk - reflective discipline and values.",
                    ],
                },
                {
                    "title": "Best first pick",
                    "body": "Start with Atomic Habits if you want a practical first step.",
                },
            ],
        )

    return build_life_companion_response(
        reply=(
            "Here are a few reading options, split between novels and self-growth books. "
            "These are suggestions, not prescriptions."
        ),
        action_type=action_type,
        label=label,
        tone="grounded",
        reply_format="book_recommendation",
        intent="book_recommendation",
        sections=[
            {
                "title": "Start here",
                "items": [
                    "The Alchemist - simple and reflective when you feel lost.",
                    "Siddhartha - calm, spiritual, and centered on inner discovery.",
                    "The Little Prince - short, poetic, and emotionally gentle.",
                ],
            },
            {
                "title": "Novels",
                "items": [
                    "The Midnight Library - choices, regret, and meaning.",
                    "Sophie's World - beginner-friendly philosophy through story.",
                ],
            },
            {
                "title": "Self-growth books",
                "items": [
                    "Atomic Habits - practical systems for discipline.",
                    "Man's Search for Meaning - meaning and responsibility.",
                ],
            },
            {
                "title": "If you want deeper",
                "items": [
                    "The Courage to Be Disliked - agency and self-respect.",
                    "The Stranger - philosophical, but colder and heavier.",
                ],
            },
            {
                "title": "Best first pick",
                "body": "Start with The Alchemist for fiction, or Atomic Habits for practical self-growth.",
            },
        ],
    )


def generate_life_companion_fallback(
    mode: str,
    context: dict | None = None,
    *,
    prompt_injection: bool = False,
    user_message: str = "",
    knowledge_chunks: list[dict] | None = None,
) -> dict:
    safe_context = context or {}
    task_summary = safe_context.get("task_summary") or {}
    weekly_mirror = safe_context.get("weekly_mirror") or {}
    next_focus = weekly_mirror.get("next_focus") or "Begin with one honest, small step."
    weak_categories = task_summary.get("weak_categories") or []
    first_weak_category = weak_categories[0] if weak_categories else "action"
    flags = detect_companion_fallback_intent(user_message)
    deterministic_intent = detect_companion_intent(user_message, mode)
    safe_memory = safe_context.get("safe_memory_summary") or {}

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

    if deterministic_intent in BOOK_RECOMMENDATION_INTENTS:
        return build_book_recommendation_fallback(
            intent=deterministic_intent,
            user_message=user_message,
            flags=flags,
            safe_memory=safe_memory,
            knowledge_chunks=knowledge_chunks,
        )

    if deterministic_intent == "quote_request":
        return build_life_companion_response(
            reply=(
                "\"Do not wait to feel fearless. Carry your preparation calmly, and let one honest sentence begin the day.\""
            ),
            action_type="none",
            tone="grounded",
            reply_format="quote",
            sections=[
                {"title": "The idea", "body": "\"Do not wait to feel fearless. Carry your preparation calmly, and let one honest sentence begin the day.\""},
                {"title": "Apply this", "body": "Before your next difficult moment, choose one sentence that is steady, not perfect."},
            ],
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
            reply_format="moral_reflection",
            sections=[
                {"title": "The direct answer", "body": "Yes, you can become a good person, not by feeling perfect, but by choosing honestly again and again."},
                {"title": "A deeper view", "body": "Character is built through repeated repairs, not flawless performance."},
                {"title": "One question", "body": "What made you ask this today: did you hurt someone, disappoint yourself, or feel afraid of who you are becoming?"},
            ],
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
            reply_format="conversation",
            sections=[
                {"title": "I hear this", "body": "We do not need to turn this into a task right now."},
                {"title": "One question", "body": "Tell me the main thing: did something happen, or is this a feeling that has been building?"},
            ],
        )

    if deterministic_intent == "physical_action":
        return build_life_companion_response(
            reply=(
                "Stand up, drink water, and put your phone across the room. Then do one visible task for two minutes. "
                "No reflection needed right now, just movement."
            ),
            action_type="real_world_action",
            label="Do one physical reset",
            reply_format="physical_action",
            sections=[
                {"title": "Do this now", "items": ["Stand up", "Drink water", "Put your phone across the room"]},
                {"title": "Then", "body": "Do one visible task for two minutes. No reflection needed right now, just movement."},
            ],
        )

    concrete_action_type = "none" if flags["no_task"] or flags["no_app_action"] else "loop"
    concrete_label = "Open The Loop" if concrete_action_type == "loop" else None

    if deterministic_intent == "study_gym_routine":
        return build_life_companion_response(
            reply=(
                "You want both study and gym in your day. Here is a structure that protects both without one destroying the other."
            ),
            action_type="none",
            tone="grounded",
            reply_format="structured_plan",
            intent="study_gym_routine",
            sections=[
                {"title": "What I understand", "body": "You want to fit both academic work and gym into your daily life. This is achievable with two protected anchors — everything else adjusts around them."},
                {"title": "Daily anchors", "items": [
                    "Morning: 60–90 minutes of focused study before distractions start.",
                    "Afternoon: 20–30 minutes of active revision or review from the morning's work.",
                    "Evening: gym session, 60–75 minutes.",
                    "After gym: meal, recovery, wind down — no heavy screen time.",
                    "Night: 10 minutes to prepare tomorrow's first task.",
                ]},
                {"title": "Keep it realistic", "body": "Protect only two things first: one study block and one gym time. Once those hold for a week, add more structure around them."},
                {"title": "Start today", "body": "Choose your gym time and one study block. Write them down. Those are your only obligations for the first three days."},
            ],
        )

    if deterministic_intent == "gym_routine":
        return build_life_companion_response(
            reply=(
                "Here is a simple gym-centered daily structure you can actually keep."
            ),
            action_type="none",
            tone="grounded",
            reply_format="structured_plan",
            intent="gym_routine",
            sections=[
                {"title": "Simple daily structure", "items": [
                    "Morning: light prep — water, stretch, or a short walk if gym is in the evening.",
                    "Work or study block: one focused session before your workout.",
                    "Gym: one consistent session. Time of day matters less than showing up.",
                    "Recovery: meal, sleep on time, avoid heavy screens before bed.",
                ]},
                {"title": "The rule", "body": "Consistency beats intensity. A workout that happens every day beats a perfect workout that happens twice a week."},
                {"title": "Start today", "body": "Choose one fixed gym time. Protect it for seven days. Then adjust based on what you learn."},
            ],
        )

    if deterministic_intent == "study_routine":
        return build_life_companion_response(
            reply="Here is a daily study structure you can repeat without burning out.",
            action_type="none",
            tone="grounded",
            reply_format="structured_plan",
            intent="study_routine",
            sections=[
                {"title": "Daily study structure", "items": [
                    "Morning: 60–90 minutes of deep focused study — no phone, one subject.",
                    "Afternoon: 20–30 minutes of active revision from today's material.",
                    "Evening: lighter study or reading, 30–45 minutes if energy allows.",
                    "Night: write tomorrow's first study task before bed.",
                ]},
                {"title": "The revision rule", "body": "Review the day's work the same evening — not a week later. 20 minutes of active recall cements more than 2 hours of re-reading."},
                {"title": "Start today", "body": "Open your notes from today and spend 15 minutes writing what you remember without looking. That is your first revision block."},
            ],
        )

    if deterministic_intent == "exam_study_plan":
        return build_life_companion_response(
            reply="Here is a focused plan for studying toward your exam.",
            action_type="none",
            tone="grounded",
            reply_format="structured_plan",
            intent="exam_study_plan",
            sections=[
                {"title": "Daily exam preparation", "items": [
                    "Morning: 60–90 minutes on the hardest or most unfamiliar topic.",
                    "Afternoon: 20–30 minutes of active recall — write from memory, no notes.",
                    "Evening: review any gaps and prepare tomorrow's first topic.",
                    "Night: one sentence about what you covered today.",
                ]},
                {"title": "The rule", "body": "One deep session per day is more effective than scattered hours. Consistent daily study beats a last-minute cram."},
                {"title": "Start today", "body": "Choose the one subject you have been avoiding. Study it for 25 minutes using only notes and memory, no scrolling. That is your first honest session."},
            ],
        )

    if deterministic_intent in {"daily_schedule", "weekly_schedule", "time_management_plan"}:
        return build_life_companion_response(
            reply="Here is a simple structure built around two or three protected anchors.",
            action_type="none",
            tone="grounded",
            reply_format="structured_plan",
            intent=deterministic_intent,
            sections=[
                {"title": "Your daily anchors", "items": [
                    "First anchor: one focused work or study block in the morning.",
                    "Second anchor: gym, exercise, or one physical reset in the evening.",
                    "Third anchor: a consistent sleep time — your recovery foundation.",
                ]},
                {"title": "How to use this", "body": "Protect only these three anchors for the first week. Everything else fits around them. A schedule that breaks by noon is not a schedule."},
                {"title": "Start today", "body": "Write down your three anchor times. Protect them tomorrow. Adjust after seven days based on what you learn."},
            ],
        )

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
            reply_format="structured_plan",
            sections=[
                {"title": "Your routine", "items": [
                    "Start with one anchor: wake, water, bed.",
                    "Do one 25-minute focus block before checking your phone.",
                    "Take a five-minute reset break.",
                    "Do one 45-minute main task block.",
                    "End the day by writing tomorrow's first task.",
                ]},
                {"title": "The rule", "body": "Keep it small enough to repeat. Your goal is consistency, not perfection."},
            ],
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
            reply_format="structured_plan",
            sections=[
                {"title": "Study routine", "items": [
                    "First 10 minutes: list the exact chapters or topics.",
                    "Block one: 40 minutes on the easiest important topic.",
                    "Break: five minutes away from the phone.",
                    "Block two: 45 minutes on the hardest topic.",
                    "Close: 15 minutes of recall without looking at notes.",
                ]},
                {"title": "Note", "body": "Repeat once more only if your energy stays steady."},
            ],
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
            reply_format="structured_plan",
            sections=[
                {"title": "Simple timetable", "items": [
                    "Morning: 25 minutes on the easiest important task.",
                    "Late morning: 45 minutes on your main task.",
                    "Afternoon: one small admin or cleanup task.",
                    "Evening: 30 minutes of review, practice, or preparation.",
                    "Night: write tomorrow's first move before sleep.",
                ]},
                {"title": "Remember", "body": "Keep the blocks flexible; the anchor matters more than the exact clock."},
            ],
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
            reply_format="structured_plan",
            sections=[
                {"title": "Your checklist", "items": [
                    "Choose one priority for today.",
                    "Remove one obvious distraction.",
                    "Work for 25 minutes on the first step.",
                    "Take a five-minute reset break.",
                    "Finish by writing the next step, even if today was imperfect.",
                ]},
            ],
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
            reply_format="structured_plan",
            sections=[
                {"title": "Simple plan", "items": [
                    "Name the problem in one line.",
                    "Pick the smallest action that proves movement.",
                    "Do it for 25 minutes before checking your phone.",
                    "Take a short reset instead of quitting completely.",
                    "End by choosing tomorrow's first task.",
                ]},
                {"title": "The rule", "body": "Do not build a perfect system. Build one repeatable move."},
            ],
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
            reply_format="grounding",
            sections=[
                {"title": "Lower the pressure", "body": "Put both feet on the floor, unclench your jaw, and take one slow breath."},
                {"title": "One question", "body": "What is the single thought looping the loudest right now?"},
            ],
        )

    if deterministic_intent == "loneliness":
        return build_life_companion_response(
            reply=(
                "That sounds lonely, and it does not need a productivity answer. "
                "What kind of connection are you missing most right now: being understood, being included, or having someone stay?"
            ),
            action_type="none",
            tone="grounded",
            reply_format="conversation",
            sections=[
                {"title": "I hear this", "body": "That sounds lonely, and it does not need a productivity answer."},
                {"title": "One question", "body": "What kind of connection are you missing most right now: being understood, being included, or having someone stay?"},
            ],
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
        if has_any(str(user_message or "").lower(), ["what should i use in this app", "which app feature", "what app feature"]):
            return build_life_companion_response(
                reply=(
                    "Use Reset Space first. If you are restless, the useful move is to lower the mental volume before choosing a task."
                ),
                action_type="reset",
                label="Open Reset Space",
                reply_format="app_guidance",
                sections=[
                    {"title": "Use this", "body": "Open Reset Space for a short grounding or breathing reset."},
                    {"title": "Then", "body": "After your mind settles, choose one small next step instead of planning the whole day."},
                ],
            )
        return build_life_companion_response(
            reply=(
                "When everything feels loud, the next move is not to solve everything. Lower the volume first: "
                "unclench your jaw, breathe once, and choose only the next visible step."
            ),
            action_type="reset",
            label="Open Reset Space",
            reply_format="grounding",
            sections=[
                {"title": "First move", "body": "Unclench your jaw, breathe once, and choose only the next visible step."},
                {"title": "The principle", "body": "When everything feels loud, the next move is not to solve everything. Lower the volume first."},
            ],
        )

    if deterministic_intent == "purpose_question":
        return build_life_companion_response(
            reply=(
                "Purpose usually does not arrive as a lightning bolt; it shows up through repeated honest choices. "
                "Start with this: what responsibility, person, or skill still feels worth becoming stronger for?"
            ),
            action_type="none",
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


import time as _ee_time

_EXECUTION_ENGINE_FALLBACKS: dict[str, list[dict]] = {
    "I can't stop scrolling": [
        {
            "taskTitle": "Put your phone face-down in another room for 10 minutes",
            "durationLabel": "10 minutes",
            "contextNote": "Physical distance from the device interrupts the dopamine loop before it restarts.",
        },
        {
            "taskTitle": "Put your phone in a drawer and close it",
            "durationLabel": "5 minutes",
            "contextNote": "Removing the device from sight removes the trigger that keeps the scroll going.",
        },
        {
            "taskTitle": "Walk to a different room and leave your phone behind",
            "durationLabel": "5 minutes",
            "contextNote": "Changing your physical location breaks the automatic reach-and-scroll pattern.",
        },
    ],
    "I feel lost": [
        {
            "taskTitle": "Touch 3 physical objects near you and name each one aloud",
            "durationLabel": "2 minutes",
            "contextNote": "Naming what is physically present grounds you in the concrete world rather than abstract worry.",
        },
        {
            "taskTitle": "Put both feet flat on the floor and press down for 30 seconds",
            "durationLabel": "30 seconds",
            "contextNote": "Physical pressure on the soles activates the body's orienting response and reduces drift.",
        },
        {
            "taskTitle": "Walk to a window and name 3 things you can see outside",
            "durationLabel": "2 minutes",
            "contextNote": "Visual anchoring in the physical environment replaces the feeling of floating.",
        },
    ],
    "I overthink everything": [
        {
            "taskTitle": "Write 1 sentence naming the thought you keep returning to",
            "durationLabel": "3 minutes",
            "contextNote": "Externalizing the thought onto paper removes it from the loop it runs in your head.",
        },
        {
            "taskTitle": "Write the 1 decision you are avoiding on a piece of paper",
            "durationLabel": "3 minutes",
            "contextNote": "Written words make the abstract concrete and stop the mind from repeating the same loop.",
        },
        {
            "taskTitle": "Write 3 words that describe what you are feeling right now",
            "durationLabel": "2 minutes",
            "contextNote": "Labeling feelings with words reduces the brain's threat response and slows overthinking.",
        },
    ],
    "I have no motivation": [
        {
            "taskTitle": "Drink 1 glass of water right now standing up",
            "durationLabel": "1 minute",
            "contextNote": "Standing and hydrating interrupts the inertia state and gives the body a signal to move.",
        },
        {
            "taskTitle": "Stand up and stretch your arms above your head for 30 seconds",
            "durationLabel": "30 seconds",
            "contextNote": "Physical movement changes blood flow and breaks the physiological stillness that blocks motivation.",
        },
        {
            "taskTitle": "Walk to your front door and back 3 times",
            "durationLabel": "2 minutes",
            "contextNote": "Minimal movement restarts momentum without requiring any decision about what to do next.",
        },
    ],
    "I can't sleep": [
        {
            "taskTitle": "Put your phone face-down 30 minutes before your target sleep time",
            "durationLabel": "1 minute",
            "contextNote": "Blue light suppresses melatonin; removing the screen begins the biological wind-down process.",
        },
        {
            "taskTitle": "Stand and stretch your neck and shoulders for 60 seconds",
            "durationLabel": "60 seconds",
            "contextNote": "Releasing held tension in the upper body signals the nervous system to downshift toward rest.",
        },
        {
            "taskTitle": "Splash cold water on your face and wrists once",
            "durationLabel": "1 minute",
            "contextNote": "Cold water on pulse points activates the dive reflex and lowers the heart rate quickly.",
        },
    ],
    "I feel empty inside": [
        {
            "taskTitle": "Touch 3 objects near you and name each texture aloud",
            "durationLabel": "2 minutes",
            "contextNote": "Sensory naming reconnects the brain to physical reality when emotional numbness disconnects it.",
        },
        {
            "taskTitle": "Hold something warm like a mug or your own hands for 1 minute",
            "durationLabel": "1 minute",
            "contextNote": "Warmth and physical contact activate comfort receptors that counter the flatness of emptiness.",
        },
        {
            "taskTitle": "Wash your hands with warm water and focus on the temperature",
            "durationLabel": "1 minute",
            "contextNote": "Directed sensory attention breaks the dissociation that emptiness creates.",
        },
    ],
    "I keep starting and quitting": [
        {
            "taskTitle": "Write the first physical step of 1 task on a piece of paper",
            "durationLabel": "3 minutes",
            "contextNote": "Writing the first step creates a commitment artifact that makes starting again concrete.",
        },
        {
            "taskTitle": "Write the name of 1 unfinished task and draw a box next to it",
            "durationLabel": "2 minutes",
            "contextNote": "A visible checkbox externalizes intention and reduces the mental weight of the unfinished thing.",
        },
        {
            "taskTitle": "Write 1 sentence finishing this: The smallest possible first step is",
            "durationLabel": "3 minutes",
            "contextNote": "Naming the smallest possible step removes the barrier that causes quitting at the start.",
        },
    ],
    "I don't know who I am": [
        {
            "taskTitle": "Write 1 answer to: what made you smile or feel okay this week",
            "durationLabel": "5 minutes",
            "contextNote": "Noticing small positive moments reveals values and preferences that define who you already are.",
        },
        {
            "taskTitle": "Write the name of 1 person you genuinely respect and 1 word why",
            "durationLabel": "3 minutes",
            "contextNote": "What you admire in others reflects what you value in yourself.",
        },
        {
            "taskTitle": "Write 1 thing you did in the last week that felt right to you",
            "durationLabel": "3 minutes",
            "contextNote": "Actions that feel right are anchors to values that exist even when identity feels unclear.",
        },
    ],
    "I feel completely alone": [
        {
            "taskTitle": "Text 1 person you have not spoken to this week",
            "durationLabel": "3 minutes",
            "contextNote": "Initiating one real contact breaks the isolation loop even before any reply comes.",
        },
        {
            "taskTitle": "Write the name of 1 person who would notice if you were gone",
            "durationLabel": "2 minutes",
            "contextNote": "Naming a real connection makes it concrete rather than a feeling that seems invisible.",
        },
        {
            "taskTitle": "Send a voice note to 1 contact saying one honest sentence",
            "durationLabel": "3 minutes",
            "contextNote": "Voice connection carries more warmth than text and reduces the sense of being unheard.",
        },
    ],
}


def get_execution_engine_fallback(pain_point: str) -> dict:
    variants = _EXECUTION_ENGINE_FALLBACKS.get(pain_point)
    if not variants:
        return {
            "taskTitle": "Drink 1 glass of water and stand up for 30 seconds",
            "durationLabel": "1 minute",
            "contextNote": "A small physical act interrupts inertia and gives the body a signal to begin.",
        }
    index = int(_ee_time.time() / 60) % len(variants)
    return dict(variants[index])
