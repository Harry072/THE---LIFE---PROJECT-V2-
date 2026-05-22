import re


EMOTIONAL_STATE_SIGNALS = {
    "crisis": [
        "want to die", "want to end it", "end my life", "kill myself",
        "suicide", "self harm", "hurt myself", "don't want to exist",
        "want to disappear forever", "not want to be here anymore",
        "everyone better off without me", "no point in living",
        "can't go on", "want it to stop permanently",
    ],
    "active_pain": [
        # Breakup / Rejection
        "breakup", "broke up", "she left", "he left", "rejected me",
        "rejection", "girlfriend rejected", "boyfriend rejected", "left me",
        "she doesn't want", "he doesn't want", "relationship ended",
        "we ended", "it's over", "they moved on",
        # Grief
        "passed away", "died", "lost them", "miss them so much",
        "they're gone", "i lost my",
        # Emotional heaviness
        "heart is heavy", "heart is shaking", "body feels numb",
        "feel numb", "feeling numb", "feel empty", "feel hollow",
        "can't hold this", "feel heavy", "this is heavy",
        "can't take it", "i can't do this", "it hurts so much",
        "i'm breaking", "i feel broken",
        # Anxiety / Panic
        "heart is racing", "can't breathe", "panicking",
        "panic attack", "shaking", "so anxious", "i'm scared",
        "overwhelming dread",
        # Shame / Worthlessness
        "feel like a burden", "everyone is better off",
        "i'm worthless", "i hate myself", "i always mess up",
        "i'm such a failure", "i deserve this",
        # Isolation
        "feel so alone", "nobody cares", "nobody understands",
        "feel invisible", "i have no one",
    ],
    "moderate": [
        "overthinking", "can't sleep", "not okay", "struggling",
        "really stressed", "exhausted", "burnt out", "so tired",
        "frustrated", "sad today", "feeling low", "not great",
        "things are hard", "difficult lately",
    ],
    "mild": [
        "bit off", "not motivated", "feeling meh", "kinda tired",
        "not at my best", "need a push", "a little lost",
    ],
}

FEATURE_REFUSAL_SIGNALS = [
    "don't want loop", "not in mood for loop", "skip loop",
    "no loop", "don't want tasks", "not feeling tasks",
    "not now", "maybe later", "don't want reflection",
    "not in mood", "don't want to use app", "just talk to me",
    "forget the features", "no suggestions please",
    "don't suggest", "just answer", "no app",
]

FEATURE_REFUSAL_MAP = {
    "loop": "open_loop",
    "tasks": "open_loop",
    "reflection": "open_reflection",
    "journal": "open_reflection",
    "reset": "open_reset",
    "curator": "open_curator",
    "books": "open_curator",
    "progress": "open_progress",
    "tree": "open_progress",
}

RECOMMENDATION_REQUEST_SIGNALS = [
    "places", "where to go", "where can i go", "suggest places",
    "peaceful places", "places in india", "recommend places",
    "good for peace", "books", "recommend books", "what should i read",
    "suggest a book", "exercises", "workout plan", "what to eat",
    "music for", "suggest something", "recommend something",
    "what are some", "can you list", "give me options",
]

CRISIS_SIGNALS = [
    "want to die", "end my life", "kill myself", "self harm",
    "hurt myself", "don't want to exist", "want to disappear forever",
    "everyone better off without me", "no point in living",
]

BREAKUP_SIGNALS = [
    "breakup", "broke up", "rejected me", "rejection", "left me",
    "she left", "he left", "girlfriend rejected", "boyfriend rejected",
    "relationship ended", "we ended", "it's over",
    "heart is shaking", "can't hold the truth",
]

PANIC_SIGNALS = [
    "heart is racing", "can't breathe", "panicking", "panic attack",
    "shaking right now", "i can't breathe", "help me calm",
]


def detect_emotional_state(message: str) -> str:
    """
    Classifies emotional state from latest user message.
    Returns: "crisis" | "active_pain" | "moderate" | "mild" | "none"
    Priority order: crisis > active_pain > moderate > mild > none
    """
    text = message.lower().strip()
    for level in ["crisis", "active_pain", "moderate", "mild"]:
        for signal in EMOTIONAL_STATE_SIGNALS.get(level, []):
            if signal in text:
                return level
    return "none"


def detect_intent(message: str, emotional_state: str) -> str:
    """
    Detects primary response intent from latest user message.
    Returns: "receive_and_reflect" | "solve_directly" |
             "recommend_list" | "ground_first" | "safety_path"
    """
    text = message.lower().strip()

    if emotional_state == "crisis":
        return "safety_path"

    for signal in PANIC_SIGNALS:
        if signal in text:
            return "ground_first"

    for signal in RECOMMENDATION_REQUEST_SIGNALS:
        if signal in text:
            return "recommend_list"

    solve_signals = [
        "what should i do", "how do i", "can you help me",
        "give me a plan", "steps to", "advice on", "how to",
        "what is the best way", "suggest a way",
    ]
    for signal in solve_signals:
        if signal in text:
            return "solve_directly"

    if emotional_state in ("active_pain", "moderate"):
        return "receive_and_reflect"

    return "solve_directly"


def detect_refused_features(message: str) -> list:
    """
    Detects which features the user is refusing in this message.
    Returns list of suggested_action type strings.
    """
    text = message.lower().strip()
    refused = []
    if any(sig in text for sig in FEATURE_REFUSAL_SIGNALS):
        for keyword, action_type in FEATURE_REFUSAL_MAP.items():
            if keyword in text:
                refused.append(action_type)
    return refused


CANONICAL_COMPANION_INTENTS = {
    "emotional_talk",
    "anxiety_grounding",
    "routine_plan",
    "study_gym_plan",
    "task_help",
    "life_clarity",
    "empathy_eq",
    "relationship_understanding",
    "book_recommendation",
    "quote_request",
    "physical_action",
    "app_guidance",
    "peaceful_knowledge_place_recommendation",
    "peaceful_place_recommendation",
    "career_skill_guidance",
    "fitness_guidance",
    "spiritual_reflection",
    "general_question",
    "correction_request",
    "safety",
}


LEGACY_INTENT_ALIASES = {
    "crisis": "safety",
    "prompt_injection": "safety",
    "anxiety_overwhelm": "anxiety_grounding",
    "reset_need": "anxiety_grounding",
    "emotional_support": "emotional_talk",
    "loneliness": "emotional_talk",
    "serious_talk": "emotional_talk",
    "wants_talk": "emotional_talk",
    "study_gym_routine": "study_gym_plan",
    "body_growth": "fitness_guidance",
    "gym_routine": "fitness_guidance",
    "routine_request": "routine_plan",
    "daily_schedule": "routine_plan",
    "weekly_schedule": "routine_plan",
    "schedule_request": "routine_plan",
    "time_management": "routine_plan",
    "time_management_plan": "routine_plan",
    "study_routine": "routine_plan",
    "study_plan": "routine_plan",
    "exam_study_plan": "routine_plan",
    "plan_request": "task_help",
    "direct_help_request": "task_help",
    "checklist_request": "task_help",
    "next_action_request": "physical_action",
    "productivity": "task_help",
    "scrolling_distraction": "task_help",
    "purpose_question": "life_clarity",
    "identity_question": "life_clarity",
    "moral_question": "spiritual_reflection",
    "reflective_writing": "emotional_talk",
    "philosophy_novel_recommendation": "book_recommendation",
    "novel_recommendation": "book_recommendation",
    "self_growth_book_request": "book_recommendation",
    "reading_request": "book_recommendation",
    "curator_request": "book_recommendation",
    "reading_or_learning": "book_recommendation",
    "weekly_pattern": "app_guidance",
    "seminar_public_speaking": "quote_request",
    "general": "general_question",
    "peaceful_place_recommendation": "peaceful_knowledge_place_recommendation",
}


def normalize_intent(intent: str | None) -> str:
    cleaned = str(intent or "").strip().lower()
    if cleaned in CANONICAL_COMPANION_INTENTS:
        return cleaned
    return LEGACY_INTENT_ALIASES.get(cleaned, "general_question")


def normalize_text(value: str) -> str:
    cleaned = str(value or "").lower().replace("’", "'")
    replacements = {
        "don't": "do not",
        "dont": "do not",
        "can't": "cannot",
        "cant": "cannot",
        "didn't": "did not",
        "didnt": "did not",
        "you're": "you are",
    }
    for source, target in replacements.items():
        cleaned = cleaned.replace(source, target)
    return " ".join(cleaned.split())


def has_any(text: str, phrases: list[str]) -> bool:
    return any(phrase in text for phrase in phrases)


def has_pattern(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, re.I) for pattern in patterns)


CRISIS_PATTERNS = [
    r"\bkill myself\b",
    r"\bkill me\b",
    r"\bend my life\b",
    r"\bi want to die\b",
    r"\bi do not want to live\b",
    r"\bnot be alive\b",
    r"\bsuicid(e|al)\b",
    r"\bself[-\s]?harm\b",
    r"\bhurt myself\b",
    r"\bharm myself\b",
    r"\boverdose\b",
    r"\bno reason to live\b",
    r"\bimmediate danger\b",
    r"\bgoing to hurt\b",
]

PROMPT_INJECTION_PATTERNS = [
    r"\bignore (all )?(previous|prior) (instructions?|rules)\b",
    r"\boverride (the )?(system|developer|instructions?)\b",
    r"\b(show|reveal|print) (me )?(your )?(prompt|system prompt|hidden prompt|hidden instructions?)\b",
    r"\bdeveloper message\b",
    r"\bsystem message\b",
    r"\bservice role\b",
    r"\bapi key\b",
    r"\bjailbreak\b",
]


def detect_companion_intent(message: str, mode: str | None = None) -> str:
    """Classify only the latest user message. Mode is intentionally ignored."""
    text = normalize_text(message)

    if has_pattern(text, CRISIS_PATTERNS) or has_pattern(text, PROMPT_INJECTION_PATTERNS):
        return "safety"

    if has_pattern(
        text,
        [
            r"\byou (are|r) not (answering|giving) (my )?(question|answer)\b",
            r"\byou (are|r) not giving my question'?s answer\b",
            r"\byou (are|r) not giving my answer\b",
            r"\bnot (my|the) question\b",
            r"\bnot what i asked\b",
            r"\bdid not answer\b",
            r"\bdidn't answer\b",
            r"\banswer my question\b",
            r"\bwrong answer\b",
            r"\bmissed (my|the) question\b",
        ],
    ):
        return "correction_request"

    # RULE: explicit request beats emotional tone.
    # If the user asks for suggestions/options/places/locations, answer that first.
    # Only bypass this for book-only requests that have no place context.
    _SUGGESTION_VERBS = [
        "suggest", "recommend", "give me", "show me", "tell me",
        "options", "list", "examples", "best to visit", "where should i",
        "best places", "any places", "any good places", "what places",
    ]
    _PLACE_LOCATION_TERMS = [
        "place", "places", "location", "locations", "spot", "spots",
        "visit", "wander", "go somewhere", "where should i go",
        "somewhere peaceful", "somewhere to meditate", "meditate somewhere",
        "peaceful place", "calm place", "peaceful location", "peaceful spot",
        "feel peace somewhere",
    ]
    _PEACE_QUALITIES = [
        "peace", "peaceful", "calm", "quiet", "serene", "tranquil",
        "meditate", "meditation", "knowledge", "learn", "learning",
        "wisdom", "reading", "museum", "library", "garden", "heritage",
    ]
    _is_book_only = (
        has_pattern(text, [r"\b(novels?|books?|reads?)\b"])
        and not has_any(text, _PLACE_LOCATION_TERMS)
    )
    if not _is_book_only:
        # Explicit suggestion verb + place/location term → place recommendation
        if has_any(text, _SUGGESTION_VERBS) and has_any(text, _PLACE_LOCATION_TERMS):
            return "peaceful_knowledge_place_recommendation"
        # Explicit suggestion verb + peace/calm quality + any spatial word → place recommendation
        if has_any(text, _SUGGESTION_VERBS) and has_any(text, _PEACE_QUALITIES) and has_any(
            text, ["place", "location", "where", "visit", "go", "spot", "somewhere"]
        ):
            return "peaceful_knowledge_place_recommendation"
    # Place/location term + peace quality (no suggestion verb required)
    if has_any(text, _PLACE_LOCATION_TERMS) and has_any(text, _PEACE_QUALITIES):
        return "peaceful_knowledge_place_recommendation"

    if has_any(text, ["app", "feature", "where should i go", "which section", "which page", "how to use"]) and has_any(
        text,
        ["life project", "loop", "reflection", "reset", "curator", "weekly mirror", "growth tree", "feature", "app"],
    ):
        return "app_guidance"

    if has_any(text, ["quote", "caption", "one line", "speech line", "seminar quote", "motivation line"]):
        return "quote_request"
    if has_any(text, ["seminar", "presentation", "speech", "stage"]) and has_any(text, ["line", "quote", "words"]):
        return "quote_request"

    if has_pattern(text, [r"\b(novels?|fiction|books?|reads?)\b", r"\bwhat should i read\b", r"\bi want to read\b"]):
        return "book_recommendation"

    if has_any(
        text,
        [
            "breakup", "break up", "broke up", "heartbreak", "heart broken",
            "girlfriend left", "boyfriend left", "my ex", "miss her", "miss him",
            "she left me", "he left me",
        ],
    ):
        return "emotional_talk"

    if has_any(text, ["study", "studies", "exam", "academic", "college", "university"]) and has_any(
        text,
        ["gym", "fitness", "workout", "exercise", "training"],
    ) and has_any(text, ["routine", "schedule", "plan", "structure", "timetable", "manage"]):
        return "study_gym_plan"

    if has_any(text, ["study", "studies", "exam", "academic", "college", "school"]) and has_any(
        text,
        ["focus", "cannot focus", "concentrate", "distracted", "distraction", "procrastinating"],
    ):
        return "routine_plan"

    if has_any(
        text,
        [
            "gym", "fitness", "workout", "training", "muscle", "strength",
            "bodybuilding", "body growth", "grow my body", "build my body",
            "build muscle", "diet", "protein",
        ],
    ):
        return "fitness_guidance"

    if has_any(
        text,
        [
            "career", "internship", "coding", "programming", "skill", "skills",
            "learning path", "roadmap to learn", "job", "resume", "portfolio",
        ],
    ):
        return "career_skill_guidance"

    if has_any(
        text,
        [
            "build empathy", "develop empathy", "be more empathetic", "empathy",
            "emotional intelligence", "active listening", "listen better", "eq",
            "learning the feelings of others", "feelings of others",
            "understand others feelings", "understand other people's feelings",
        ],
    ):
        return "empathy_eq"

    if has_any(
        text,
        [
            "relationship", "friend", "friends", "family", "parents", "conflict",
            "argument", "communication", "understand people", "understanding people",
            "understand someone", "boundaries",
        ],
    ):
        return "relationship_understanding"

    if has_any(text, ["physical action", "real-world action", "body action", "one physical action"]):
        return "physical_action"
    if has_any(text, ["what should i do now", "give me one action", "one thing i can do now", "next action now"]):
        return "physical_action"

    if has_any(text, ["routine", "schedule", "timetable", "time table", "daily structure", "daily plan"]):
        return "routine_plan"

    if has_any(text, ["how do i complete", "stop procrastinating", "procrastinate", "take action", "task help", "finish this", "get started"]):
        return "task_help"
    if has_any(text, ["give me steps", "make a plan", "create a plan", "roadmap", "checklist"]):
        return "task_help"

    if has_any(text, ["purpose", "direction", "meaning", "identity", "who am i", "lost in life", "feel lost", "confused about life"]):
        return "life_clarity"

    if has_any(text, ["spiritual", "soul", "god", "prayer", "philosophy", "philosophical", "meaning of life"]):
        return "spiritual_reflection"

    if has_any(text, ["anxious", "anxiety", "panic", "panicking", "overwhelmed", "overthinking", "spiral", "restless", "mentally crowded", "too much in my mind"]):
        return "anxiety_grounding"

    if has_any(text, ["i feel", "i am feeling", "sad", "heavy", "lonely", "alone", "empty", "hurt", "low", "tired", "vent", "talk to me", "can we talk", "need to talk"]):
        return "emotional_talk"

    return "general_question"


def topic_label_from_intent(intent: str | None) -> str:
    labels = {
        "emotional_talk": "talking through feelings",
        "anxiety_grounding": "grounding anxious or crowded thoughts",
        "routine_plan": "building a practical routine",
        "study_gym_plan": "balancing studies and gym",
        "task_help": "taking action on a task",
        "life_clarity": "finding direction or purpose",
        "empathy_eq": "learning empathy and active listening",
        "relationship_understanding": "understanding people and communication",
        "book_recommendation": "reading recommendations",
        "quote_request": "a quote or short line",
        "physical_action": "one physical next step",
        "app_guidance": "using The Life Project",
        "peaceful_knowledge_place_recommendation": "peaceful places that also teach",
        "peaceful_place_recommendation": "peaceful places to visit",
        "career_skill_guidance": "skills, career, or learning path",
        "fitness_guidance": "gym, body growth, and recovery",
        "spiritual_reflection": "spiritual or philosophical reflection",
        "general_question": "general question",
        "correction_request": "correcting a missed answer",
        "safety": "safety boundary",
    }
    return labels.get(normalize_intent(intent), "general question")
