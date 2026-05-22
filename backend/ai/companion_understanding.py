"""
Life Companion Understanding Layer

Extracts the semantic understanding of the latest user message BEFORE intent routing.
Provides: request_type, subject, user_goal, constraints, answer_style, route.

Architecture role:
  message → understand_companion_message() → drives RAG, prompt, fallback, validator
  This is the first step in the adaptive reasoning core.
"""
import re


# ── Sentence-level request-type signals ──────────────────────────────────────

_SUGGESTION_VERBS = [
    "suggest", "recommend", "give me", "show me", "tell me about",
    "list", "what are some", "what are the best", "options for",
    "examples of", "best to visit", "best places", "any good places",
    "where should i go", "where can i go", "what should i visit",
    "any suggestions", "any recommendations", "can you suggest",
    "can you recommend", "what places", "which places",
]

_EXPLANATION_STARTERS = [
    "what is", "what are", "how does", "how do i", "how can i",
    "explain", "describe", "teach me", "help me understand",
    "what does", "how to", "can you explain", "what means",
    "how do you", "what do you",
]

_PLAN_STARTERS = [
    "make me a", "make me", "create a", "create me", "build me",
    "give me a plan", "give me a routine", "give me a schedule",
    "help me plan", "write me a", "design a", "set up a",
    "plan a", "plan my",
]

_EMOTIONAL_STARTERS = [
    "i feel", "i am feeling", "i've been feeling", "i have been feeling",
    "feeling sad", "feeling anxious", "feeling lost", "feeling empty",
    "i am so", "i just feel", "i cannot stop", "i can't stop",
    "i need to talk", "can we talk", "i want to vent", "just listen",
    "i've been", "i have been",
]

# ── Subject keyword groups ────────────────────────────────────────────────────

_PLACES = [
    "place", "places", "location", "locations", "spot", "spots",
    "visit", "wander", "go somewhere", "where to go", "destination",
    "somewhere to", "somewhere peaceful", "somewhere calm",
    "where should i", "travel",
]

_FITNESS = [
    "gym", "workout", "exercise", "fitness", "muscle", "body",
    "training", "bodybuilding", "strength", "protein",
    "grow body", "build body", "build muscle", "body growth",
    "weight", "diet plan",
]

_STUDY = [
    "study", "studies", "exam", "academic", "revision",
    "university", "college", "school", "marks", "grades", "lecture",
]

_ROUTINE = [
    "routine", "schedule", "timetable", "daily structure",
    "time management", "time table", "daily plan",
]

_BOOKS = [
    "book", "books", "novel", "novels", "fiction", "read", "reading",
    "literature", "philosophy novel", "what to read", "novels to read",
]

_EMPATHY = [
    "empathy", "empathize", "empathise", "emotional intelligence",
    "active listening", "listen better", "listening",
    "understand others", "understand people", "feelings of others",
]

_ANXIETY = [
    "anxious", "anxiety", "panic", "overwhelmed", "overthinking",
    "spiral", "restless", "calm down", "grounding", "too much in my mind",
    "panic attack",
]

_CAREER = [
    "career", "job", "internship", "skill", "skills", "coding",
    "programming", "resume", "portfolio", "roadmap to learn",
    "learning path", "tech",
]

_PURPOSE = [
    "purpose", "meaning", "direction", "identity", "who am i",
    "lost in life", "feel lost", "confused about life", "why am i",
]

_RELATIONSHIP = [
    "relationship", "friend", "family", "parents", "partner",
    "conflict", "argument", "communication", "boundaries",
]

_APP = [
    "loop", "reset space", "reflection", "curator", "weekly mirror",
    "growth tree", "life project", "the app", "feature", "section",
    "which feature", "what feature", "how to use the", "open the",
]

_SPIRITUAL = [
    "spiritual", "soul", "god", "prayer", "philosophy",
    "meaning of life", "existence", "universe",
]

_PEACE_MEDITATION = [
    "peace", "peaceful", "meditate", "meditation", "calm", "calming",
    "quiet", "serene", "tranquil",
]

# ── Country/location constraints ──────────────────────────────────────────────

_COUNTRIES = {
    "india": "India",
    "usa": "USA", "america": "USA", "united states": "USA",
    "uk": "UK", "england": "UK", "britain": "UK",
    "canada": "Canada", "australia": "Australia",
    "pakistan": "Pakistan", "dubai": "Dubai", "uae": "UAE",
    "singapore": "Singapore", "japan": "Japan",
}

# ── Subjects that can be answered without app-specific RAG ───────────────────

_DIRECT_ANSWER_SUBJECTS = {
    "places", "fitness", "books", "empathy", "career",
    "purpose", "study", "spiritual", "relationship",
}

# ── Safety and injection patterns ────────────────────────────────────────────

_CRISIS_PAT = [
    r"\bkill myself\b", r"\bend my life\b", r"\bi want to die\b",
    r"\bsuicid(e|al)\b", r"\bself[-\s]?harm\b", r"\bhurt myself\b",
]
_INJECT_PAT = [
    r"\bignore (all )?(previous|prior) (instructions?|rules)\b",
    r"\boverride (the )?(system|developer|instructions?)\b",
]
_CORRECT_PAT = [
    r"\byou (are|r) not (answering|giving)\b",
    r"\bnot what i asked\b", r"\bdid not answer\b",
    r"\banswer my question\b", r"\bwrong answer\b",
    r"\bmissed (my|the) question\b",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    t = str(text or "").lower().replace("’", "'")
    for src, tgt in [
        ("don't", "do not"), ("dont", "do not"),
        ("can't", "cannot"), ("cant", "cannot"),
        ("i've", "i have"), ("i'm", "i am"),
    ]:
        t = t.replace(src, tgt)
    return " ".join(t.split())


def _any(text: str, phrases: list) -> bool:
    return any(p in text for p in phrases)


def _pat(text: str, patterns: list) -> bool:
    return any(re.search(p, text, re.I) for p in patterns)


# ── Request-type detection ────────────────────────────────────────────────────

def _request_type(text: str) -> str:
    if _pat(text, _CRISIS_PAT) or _pat(text, _INJECT_PAT):
        return "safety"
    if _pat(text, _CORRECT_PAT):
        return "correction"
    # App help: has app keywords + question opener
    if _any(text, _APP) and _any(
        text, ["what", "how", "which", "where", "feature", "use", "open", "should i"]
    ):
        return "app_help"
    # Plan: has plan-starter verb + plan-like subject
    if _any(text, _PLAN_STARTERS) and _any(
        text, _ROUTINE + _STUDY + _FITNESS + ["plan", "schedule", "structure", "timetable", "routine"]
    ):
        return "plan"
    # Recommendation: explicit suggestion verb (before emotional check)
    if _any(text, _SUGGESTION_VERBS):
        return "recommendation"
    # Explanation: how/what/explain starters
    if _any(text, _EXPLANATION_STARTERS):
        return "explanation"
    # Emotional support: emotional openers without explicit request verbs
    if _any(text, _EMOTIONAL_STARTERS) and not _any(text, _SUGGESTION_VERBS + _PLAN_STARTERS):
        return "emotional_support"
    # Factual question: starts with question word
    if _pat(text, [r"^(what|where|how|why|when|which|can you|could you)\b"]):
        return "factual_question"
    return "general"


# ── Subject detection ─────────────────────────────────────────────────────────

def _subject(text: str, request_type: str) -> str:
    # App usage takes priority
    if _any(text, _APP):
        return "app_usage"
    # Anxiety without spatial context → pure anxiety subject
    if _any(text, _ANXIETY) and not _any(text, _PLACES) and not (
        _any(text, _PEACE_MEDITATION) and _any(text, ["go", "visit", "where", "location", "spot", "somewhere"])
    ):
        return "anxiety"
    # Places — direct place terms or peace+spatial context
    if _any(text, _PLACES):
        return "places"
    if _any(text, _PEACE_MEDITATION) and _any(
        text, ["go", "visit", "where", "location", "spot", "somewhere", "travel"]
    ):
        return "places"
    # Domain subjects in specificity order
    if _any(text, _FITNESS):
        return "fitness"
    if _any(text, _BOOKS):
        return "books"
    if _any(text, _EMPATHY):
        return "empathy"
    if _any(text, _CAREER):
        return "career"
    if _any(text, _STUDY) and not _any(text, _ROUTINE):
        return "study"
    if _any(text, _ROUTINE):
        return "routine"
    if _any(text, _RELATIONSHIP):
        return "relationship"
    if _any(text, _PURPOSE):
        return "purpose"
    if _any(text, _SPIRITUAL):
        return "spirituality"
    if _any(text, _ANXIETY):
        return "anxiety"
    # Peace/meditation without spatial words still suggests places intent
    if _any(text, _PEACE_MEDITATION):
        return "places"
    return "unknown"


# ── Constraint extraction ─────────────────────────────────────────────────────

def _constraints(text: str) -> list[str]:
    out: list[str] = []
    for kw, label in _COUNTRIES.items():
        if kw in text:
            out.append(label)
            break
    if _any(text, _PEACE_MEDITATION):
        out.append("peace/meditation")
    if _any(text, ["beginner", "new to", "never done", "just started"]):
        out.append("beginner")
    for t in ["morning", "evening", "night", "afternoon"]:
        if t in text:
            out.append(t)
            break
    return out


# ── Answer style ──────────────────────────────────────────────────────────────

def _style(request_type: str, subject: str) -> str:
    if request_type in {"recommendation", "list"}:
        return "direct_list"
    if request_type == "plan":
        return "structured_plan"
    if request_type == "explanation":
        if subject in {"fitness", "empathy", "career", "study"}:
            return "step_by_step"
        return "factual_summary"
    if request_type == "emotional_support":
        return "gentle_conversation"
    return "factual_summary"


# ── Route ─────────────────────────────────────────────────────────────────────

def _route(request_type: str, subject: str) -> str:
    if request_type == "safety":
        return "safety"
    if subject == "app_usage" or request_type == "app_help":
        return "app_rag"
    if request_type == "emotional_support" and subject in {"anxiety", "unknown"}:
        return "hybrid"
    if request_type == "correction":
        return "hybrid"
    if subject in _DIRECT_ANSWER_SUBJECTS:
        return "direct_answer"
    if request_type in {"recommendation", "list", "explanation", "factual_question", "plan"}:
        return "direct_answer"
    return "hybrid"


# ── Goal phrase ───────────────────────────────────────────────────────────────

def _goal(request_type: str, subject: str, constraints: list[str]) -> str:
    loc = next(
        (c for c in constraints if c not in {"peace/meditation", "beginner", "morning", "evening", "night", "afternoon"}),
        "",
    )
    loc_str = f" in {loc}" if loc else ""
    goals = {
        "places": f"find peaceful places{loc_str} to visit or meditate",
        "fitness": "learn how to build fitness or grow body in the gym",
        "books": "find books or novels to read",
        "empathy": "understand or develop empathy and active listening",
        "career": f"understand career skills or learning path{loc_str}",
        "study": "build a study plan or improve academic focus",
        "routine": "create a practical daily routine",
        "relationship": "understand relationships and communication",
        "purpose": "find direction or understand personal purpose",
        "spirituality": "explore a spiritual or philosophical question",
        "anxiety": "feel calmer or less overwhelmed",
        "app_usage": "get help with a Life Project feature",
    }
    if subject in goals:
        base = goals[subject]
        if request_type == "plan" and subject not in {"places"}:
            return f"get a {subject} plan or structure"
        return base
    if request_type == "explanation":
        return "get a clear explanation"
    return "get a direct useful answer"


# ── Public API ────────────────────────────────────────────────────────────────

def understand_companion_message(message: str, mode: str | None = None) -> dict:
    """
    Returns the semantic understanding of the latest user message.

    Fields
    ------
    request_type  : recommendation | list | explanation | plan |
                    emotional_support | factual_question | app_help |
                    correction | safety | general
    subject       : places | fitness | study | routine | empathy | books |
                    anxiety | career | purpose | relationship | app_usage |
                    spirituality | unknown
    user_goal     : short phrase describing what the user actually wants
    constraints   : list of detected constraints (country, mood, time)
    answer_style  : direct_list | structured_plan | step_by_step |
                    gentle_conversation | factual_summary
    route         : safety | direct_answer | app_rag | hybrid
    """
    text = _norm(message)
    rt = _request_type(text)
    subj = _subject(text, rt)
    cons = _constraints(text)
    style = _style(rt, subj)
    route = _route(rt, subj)
    goal = _goal(rt, subj, cons)
    return {
        "request_type": rt,
        "subject": subj,
        "user_goal": goal,
        "constraints": cons,
        "answer_style": style,
        "route": route,
    }
