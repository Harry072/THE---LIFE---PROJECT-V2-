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
        "i'm breaking", "i feel broken", "feel like giving up",
        "i am giving up", "giving up",
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
    # Shared regex vocabulary first: EMOTIONAL_STATE_SIGNALS["crisis"] below is
    # substring-only and therefore blind to inflection ("killing myself" does
    # not contain the substring "kill myself"). Consulting CRISIS_CORE_PATTERNS
    # here is what makes a future addition to the shared list reach this net
    # too, instead of silently covering only the two regex gates.
    if has_pattern(text, CRISIS_CORE_PATTERNS):
        return "crisis"
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


# Word-boundary keyword matching for detect_companion_intent.
#
# has_any above is substring-based, which made 11 keywords fire inside
# unrelated words: "friend" inside "friendly" (a request to talk in a friendly
# register classified as relationship_understanding), "app" inside "happy" /
# "appreciate" / "happened" -> app_guidance, "eq" inside "request" /
# "equipment" / "frequent" -> empathy_eq, "low" inside "slow" / "follow" /
# "allow" -> emotional_talk, plus "list", "plan", "spot", "exam", "sad",
# "alone", "friends".
#
# A plain \b...\b fix would have been a regression: 126 of the 145 single-token
# keywords have a plural or inflected form that is NOT separately listed
# ("relationship" -> "relationships", "discipline" -> "disciplined",
# "workout" -> "workouts") and currently match only because of substring
# behaviour. _inflected() -- already written above for the crisis vocabulary --
# covers base/-s/-ed/-ing with silent-e elision, so those keep matching while
# "friendly" (‑ly is not an inflection) correctly stops matching "friend".
_WORD_PATTERN_CACHE: dict[str, "re.Pattern[str]"] = {}


def _word_pattern(phrase: str) -> "re.Pattern[str]":
    cached = _WORD_PATTERN_CACHE.get(phrase)
    if cached is not None:
        return cached
    tokens = phrase.split()
    parts = [re.escape(token) for token in tokens[:-1]]
    last = tokens[-1]
    parts.append(_inflected(last) if last.isalpha() else re.escape(last))
    compiled = re.compile(r"\b" + r"\s+".join(parts) + r"\b", re.I)
    _WORD_PATTERN_CACHE[phrase] = compiled
    return compiled


def has_word(text: str, phrases: list[str]) -> bool:
    """Whole-word (inflection-tolerant) variant of has_any."""
    return any(_word_pattern(phrase).search(text) for phrase in phrases)


def has_pattern(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, re.I) for pattern in patterns)


# ── SHARED CRISIS VOCABULARY — ONE SOURCE OF TRUTH ───────────────────────────
# Every crisis net in the codebase consumes CRISIS_CORE_PATTERNS:
#   companion_agent.DISTRESS_SIGNALS["crisis"]  (pre-loop gate, main.py:2177)
#   validator.CRISIS_PATTERNS                    (pre-loop gate, main.py:2177)
#   CRISIS_PATTERNS below                        (detect_companion_intent)
#   detect_emotional_state                       (gateway crisis response)
# Adding a concept here reaches all four automatically. Before this existed
# the lists were maintained separately, which is the structural reason the
# gerund gap survived in every one of them at once.


def _inflected(stem: str, *, extra: tuple[str, ...] = ()) -> str:
    """Regex alternation covering a stem across regular English inflection:
    base / -s / -ed / -ing, with silent-e elision ("overdose" -> "overdosing").

    This is MORPHOLOGY, not vocabulary. English verb endings are a closed set
    that does not grow; the phrasings people actually use are unbounded.
    Enumerating kill|killing|killed is what let "killing myself" through in
    the first place — the next unlisted form always walks in. Adding a concept
    means adding ONE stem; every inflection of it follows for free.
    """
    forms = {stem, stem + "s", stem + "ed", stem + "ing"}
    if stem.endswith("e"):
        forms |= {stem + "d", stem[:-1] + "ing"}
    forms |= set(extra)
    return "(?:" + "|".join(sorted(forms, key=len, reverse=True)) + ")"


_KILL = _inflected("kill")
_END = _inflected("end")
_HURT = _inflected("hurt")
_HARM = _inflected("harm")
_OVERDOSE = _inflected("overdose")

# Ideation framing ("I keep thinking about ...") paired with a lethal target.
# Some phrasings are only crisis signals when framed this way: "dying" alone
# is not ("my grandmother is dying"), but "thinking about dying" is.
_IDEATION_FRAME = (
    r"(?:want(?:s|ed)?|wish(?:es|ed)?|think(?:s|ing)?\s+about"
    r"|thought(?:s)?\s+of|keep(?:s)?\s+thinking\s+about)"
)
_LETHAL_TARGET = (
    r"(?:die|dies|died|dying|dead"
    r"|end(?:ing)?\s+it(?!\s+with)"      # "ending it" but not "ending it WITH someone"
    r"|not\s+be(?:ing)?\s+here"
    r"|not\s+wak(?:e|ing)\s+up)"
)

CRISIS_CORE_PATTERNS = [
    # Explicit self-directed lethality — escalate on sight, no framing needed.
    rf"\b{_KILL}\s+(?:my)?self\b",
    rf"\b(?:{_HURT}|{_HARM})\s+(?:my)?self\b",
    rf"\b{_END}\s+my\s+(?:own\s+)?life\b",
    rf"\b{_END}\s+it\s+all\b",
    r"\btak(?:e|es|ing|en)\s+my\s+own\s+life\b",
    rf"\b{_OVERDOSE}\b",
    r"\bself[-\s]?harm(?:s|ed|ing)?\b",
    r"\bsuicid(?:e|al)\b",
    # Ideation framing + lethal target.
    rf"\b{_IDEATION_FRAME}\b[^.?!]{{0,40}}?\b{_LETHAL_TARGET}\b",
]


CRISIS_PATTERNS = [
    *CRISIS_CORE_PATTERNS,
    r"\bkill me\b",
    r"\bi do not want to live\b",
    r"\bnot be alive\b",
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
        and not has_word(text, _PLACE_LOCATION_TERMS)
    )
    if not _is_book_only:
        # Explicit suggestion verb + place/location term → place recommendation
        if has_word(text, _SUGGESTION_VERBS) and has_word(text, _PLACE_LOCATION_TERMS):
            return "peaceful_knowledge_place_recommendation"
        # Explicit suggestion verb + peace/calm quality + any spatial word → place recommendation
        if has_word(text, _SUGGESTION_VERBS) and has_word(text, _PEACE_QUALITIES) and has_word(
            text, ["place", "location", "where", "visit", "go", "spot", "somewhere"]
        ):
            return "peaceful_knowledge_place_recommendation"
    # Place/location term + peace quality (no suggestion verb required)
    if has_word(text, _PLACE_LOCATION_TERMS) and has_word(text, _PEACE_QUALITIES):
        return "peaceful_knowledge_place_recommendation"

    if has_word(text, ["app", "feature", "where should i go", "which section", "which page", "how to use"]) and has_word(
        text,
        ["life project", "loop", "reflection", "reset", "curator", "weekly mirror", "growth tree", "feature", "app"],
    ):
        return "app_guidance"

    if has_word(text, ["quote", "caption", "one line", "speech line", "seminar quote", "motivation line"]):
        return "quote_request"
    if has_word(text, ["seminar", "presentation", "speech", "stage"]) and has_word(text, ["line", "quote", "words"]):
        return "quote_request"

    if has_pattern(text, [r"\b(novels?|fiction|books?|reads?)\b", r"\bwhat should i read\b", r"\bi want to read\b"]):
        return "book_recommendation"

    if has_word(text, ["scrolling", "screen time", "phone addiction", "doomscroll", "doom scrolling"]):
        return "scrolling_distraction"

    if has_word(text, ["mental toughness", "discipline", "willpower", "procrastination", "procrastinating", "procrastinate", "laziness", "productivity"]):
        return "productivity"

    if has_word(text, ["psychology", "mindset", "self improvement", "wealth", "money mindset", "financial"]):
        return "life_clarity"

    if has_word(text, ["confidence", "self esteem", "self worth"]):
        return "emotional_talk"

    if has_word(
        text,
        [
            "breakup", "break up", "broke up", "heartbreak", "heart broken",
            "girlfriend left", "boyfriend left", "my ex", "miss her", "miss him",
            "she left me", "he left me",
        ],
    ):
        return "emotional_talk"

    if has_word(text, ["study", "studies", "exam", "academic", "college", "university"]) and has_word(
        text,
        ["gym", "fitness", "workout", "exercise", "training"],
    ) and has_word(text, ["routine", "schedule", "plan", "structure", "timetable", "manage"]):
        return "study_gym_plan"

    if has_word(text, ["study", "studies", "exam", "academic", "college", "school"]) and has_word(
        text,
        ["focus", "cannot focus", "concentrate", "distracted", "distraction", "procrastinating"],
    ):
        return "routine_plan"

    if has_word(
        text,
        [
            "gym", "fitness", "workout", "training", "muscle", "strength",
            "bodybuilding", "body growth", "grow my body", "build my body",
            "build muscle", "diet", "protein",
        ],
    ):
        return "fitness_guidance"

    if has_word(
        text,
        [
            "career", "internship", "coding", "programming", "skill", "skills",
            "learning path", "roadmap to learn", "job", "resume", "portfolio",
        ],
    ):
        return "career_skill_guidance"

    if has_word(
        text,
        [
            "build empathy", "develop empathy", "be more empathetic", "empathy",
            "emotional intelligence", "active listening", "listen better", "eq",
            "learning the feelings of others", "feelings of others",
            "understand others feelings", "understand other people's feelings",
        ],
    ):
        return "empathy_eq"

    if has_word(
        text,
        [
            "relationship", "friend", "friends", "family", "parents", "conflict",
            "argument", "communication", "understand people", "understanding people",
            "understand someone", "boundaries",
        ],
    ):
        return "relationship_understanding"

    if has_word(text, ["physical action", "real-world action", "body action", "one physical action"]):
        return "physical_action"
    if has_word(text, ["what should i do now", "give me one action", "one thing i can do now", "next action now"]):
        return "physical_action"

    if has_word(text, ["routine", "schedule", "timetable", "time table", "daily structure", "daily plan"]):
        return "routine_plan"

    if has_word(text, ["how do i complete", "stop procrastinating", "procrastinate", "take action", "task help", "finish this", "get started"]):
        return "task_help"
    if has_word(text, ["give me steps", "make a plan", "create a plan", "roadmap", "checklist"]):
        return "task_help"

    if has_word(text, ["purpose", "direction", "meaning", "identity", "who am i", "lost in life", "feel lost", "confused about life"]):
        return "life_clarity"

    if has_word(text, ["spiritual", "soul", "god", "prayer", "philosophy", "philosophical", "meaning of life"]):
        return "spiritual_reflection"

    if has_word(text, ["anxious", "anxiety", "panic", "panicking", "overwhelmed", "overthinking", "spiral", "restless", "mentally crowded", "too much in my mind"]):
        return "anxiety_grounding"

    if has_word(text, ["worry", "rumination", "loneliness", "isolation", "connection"]):
        return "emotional_talk"

    if has_word(text, ["i feel", "i am feeling", "sad", "heavy", "lonely", "alone", "empty", "hurt", "low", "tired", "vent", "talk to me", "can we talk", "need to talk"]):
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
