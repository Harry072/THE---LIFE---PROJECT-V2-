from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field
import os
import time
from time import perf_counter

from ai.companion_classifier import map_from_classification
from ai.companion_intents import detect_emotional_state, detect_intent, detect_refused_features
from ai.companion_knowledge import detect_companion_intent, get_rag_filter_tags
from ai.companion_playbooks.loader import retrieve_playbook_chunks
from ai.context import get_companion_session, save_companion_session
from ai.fallbacks import generate_life_companion_crisis_response, generate_life_companion_fallback
from ai.memory_formatter import format_memory_for_prompt
from ai.pdf_knowledge import get_relevant_knowledge
from ai.prompts import build_life_companion_prompt
from ai.gemini_companion_gateway import (
    GeminiCompanionProviderError,
    GEMINI_FALLBACK_REASONS as _GEMINI_FALLBACK_REASONS,
    generate_life_companion_with_gemini,
)
from ai.groq_companion_gateway import (
    GroqCompanionProviderError,
    generate_life_companion_with_groq,
    generate_life_companion_with_groq_messages,
)
from ai.validator import (
    BOOK_RECOMMENDATION_INTENTS,
    LifeCompanionValidationError,
    SAFETY_INTENTS,
    parse_life_companion_json,
    validate_companion_response,
    validate_life_companion_response,
)
from ai.companion_intents import normalize_intent as _normalize_intent_gw

try:
    from openai import (
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        OpenAI,
        PermissionDeniedError,
        RateLimitError,
    )
except ImportError:  # pragma: no cover - exercised when dependency is not installed.
    OpenAI = None
    AuthenticationError = PermissionDeniedError = NotFoundError = BadRequestError = RateLimitError = None
    APITimeoutError = APIConnectionError = APIStatusError = None


PROVIDER_GEMINI = "gemini"
PROVIDER_OPENAI = "openai"
PROVIDER_GROQ = "groq"
PROVIDER_FALLBACK = "fallback"

# ── Per-user rate limiter (in-memory, resets on server restart) ────────────
_user_requests: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(user_id: str, max_per_minute: int = 10) -> bool:
    now = time.time()
    _user_requests[user_id] = [t for t in _user_requests[user_id] if now - t < 60]
    if len(_user_requests[user_id]) >= max_per_minute:
        print(f"COMPANION_RATE_LIMITED user_id={user_id} count={len(_user_requests[user_id])}")
        return False
    _user_requests[user_id].append(now)
    return True


# ── Input sanitization ─────────────────────────────────────────────────────
_INJECTION_PHRASES = {
    "ignore previous instructions",
    "ignore your system prompt",
    "you are now",
    "new instructions:",
    "disregard your",
    "forget your instructions",
    "override your",
    "act as if",
}

def sanitize_user_message(message: str) -> str:
    truncated = message[:2000]
    msg_lower = truncated.lower()
    for phrase in _INJECTION_PHRASES:
        if phrase in msg_lower:
            print(f"COMPANION_INJECTION_ATTEMPT phrase='{phrase}' msg_len={len(message)}")
    return truncated

REASON_AUTH_FAILED = "authentication_failed"
REASON_DEPENDENCY_MISSING = "provider_dependency_missing"
REASON_MODEL_UNAVAILABLE = "model_unavailable"
REASON_TIMEOUT = "provider_timeout"
REASON_UNAVAILABLE = "provider_unavailable"
REASON_RATE_LIMITED = "provider_rate_limited"
REASON_QUOTA = "provider_quota_exceeded"
REASON_EMPTY_OUTPUT = "empty_provider_response"
REASON_PROVIDER_EXCEPTION = "provider_exception"
REASON_INVALID_JSON = "invalid_json"
REASON_VALIDATOR_FAILED = "validator_failed"
REASON_UNSAFE_OUTPUT = "unsafe_output"
REASON_INVALID_ACTION_TYPE = "invalid_action_type"
REASON_INVALID_ACTION_ROUTE = "invalid_action_route"

OPENAI_TO_GROQ_FAILURE_REASONS = {
    REASON_QUOTA,
    REASON_RATE_LIMITED,
    REASON_TIMEOUT,
    REASON_UNAVAILABLE,
    REASON_MODEL_UNAVAILABLE,
    REASON_PROVIDER_EXCEPTION,
}

OPENAI_TO_GROQ_VALIDATION_REASONS = {
    REASON_INVALID_JSON,
    REASON_VALIDATOR_FAILED,
    REASON_UNSAFE_OUTPUT,
    REASON_INVALID_ACTION_TYPE,
    REASON_INVALID_ACTION_ROUTE,
}

SEVERITY_ORDER = {
    "none": 0,
    "mild": 1,
    "moderate": 2,
    "active_pain": 3,
    "crisis": 4,
}

LIFE_TOPIC_OVERRIDES = [
    {
        "phrases": ("scrolling", "screen time", "phone addiction"),
        "intent": "emotional_support",
        "subject": "scrolling",
        "emotional_state": "mild",
        "user_goal": "break digital addiction and regain awareness.",
    },
    {
        "phrases": ("anxious", "anxiety", "panic", "panicking"),
        "intent": "emotional_support",
        "subject": "anxiety",
        "emotional_state": "moderate",
        "user_goal": "ground anxiety and re-enter the present moment.",
    },
    {
        "phrases": ("mental toughness", "discipline", "willpower"),
        "intent": "motivation",
        "subject": "discipline",
        "emotional_state": "none",
        "user_goal": "build inner resilience and disciplined action.",
    },
    {
        "phrases": ("procrastination", "procrastinating", "procrastinate", "laziness", "productivity"),
        "intent": "motivation",
        "subject": "procrastination",
        "emotional_state": "mild",
        "user_goal": "move through resistance and take action.",
    },
    {
        "phrases": ("wealth", "money mindset", "financial"),
        "intent": "advice",
        "subject": "wealth",
        "emotional_state": "none",
        "user_goal": "build financial discipline and a healthier money mindset.",
    },
    {
        "phrases": ("psychology", "mindset", "self improvement"),
        "intent": "advice",
        "subject": "mindset",
        "emotional_state": "none",
        "user_goal": "understand personal patterns and improve self-awareness.",
    },
    {
        "phrases": ("purpose", "meaning", "direction"),
        "intent": "life_planning",
        "subject": "purpose",
        "emotional_state": "mild",
        "user_goal": "find direction and connect actions to meaning.",
    },
    {
        "phrases": ("confidence", "self esteem", "self worth"),
        "intent": "emotional_support",
        "subject": "confidence",
        "emotional_state": "mild",
        "user_goal": "rebuild self-trust and inner worth.",
    },
    {
        "phrases": ("habits", "routine", "morning routine"),
        "intent": "advice",
        "subject": "habits",
        "emotional_state": "none",
        "user_goal": "shape habits and routine around growth.",
    },
    {
        "phrases": ("overthinking", "worry", "rumination"),
        "intent": "emotional_support",
        "subject": "overthinking",
        "emotional_state": "moderate",
        "user_goal": "calm rumination and regain perspective.",
    },
    {
        "phrases": ("loneliness", "isolation", "connection"),
        "intent": "emotional_support",
        "subject": "loneliness",
        "emotional_state": "moderate",
        "user_goal": "understand loneliness and move toward real connection.",
    },
    {
        "phrases": ("giving up", "give up"),
        "intent": "emotional_support",
        "subject": "giving_up",
        "emotional_state": "active_pain",
        "user_goal": "stay with the pain without surrendering the whole future to it.",
    },
]

LIFE_TOPIC_FALLBACK_REPLIES = {
    "scrolling": (
        "Your phone is not the real enemy; it is the easiest escape from discomfort. "
        "Break the loop physically first: put it across the room, stand up, and do one "
        "two-minute action before you decide whether to pick it up again."
    ),
    "anxiety": (
        "Put both feet on the floor and let your shoulders drop. Breathe in for four, "
        "out for six, twice. Anxiety wants you to solve the whole future; right now, "
        "come back to the next minute."
    ),
    "discipline": (
        "Mental toughness is not feeling hard all the time. It is keeping a small promise "
        "while your mood argues with you. Choose one uncomfortable action today and finish it without negotiation."
    ),
    "mindset": (
        "Start with this: your patterns are more honest than your intentions. Watch what you avoid, "
        "what you repeat, and what you defend; that is where self-awareness begins."
    ),
    "procrastination": (
        "Procrastination is often resistance wearing a productivity mask. Do not try to feel ready; "
        "make the first step so small that your nervous system has no dramatic story to tell about it."
    ),
    "wealth": (
        "Wealth starts as behavior before it becomes money. Track what leaks your attention and cash, "
        "then build one rule you can keep even when you feel impulsive."
    ),
    "purpose": (
        "Purpose rarely arrives as a perfect answer. It becomes visible when you take responsibility "
        "for one direction long enough to be changed by it."
    ),
    "confidence": (
        "Confidence grows when your actions become evidence. Keep one promise small enough to complete today; "
        "self-trust is built by proof, not self-hype."
    ),
    "habits": (
        "A habit is not a personality test; it is an environment plus a repeatable cue. Make the first move visible, "
        "easy, and tied to a moment that already happens."
    ),
    "overthinking": (
        "Overthinking tries to create certainty before action. Give the mind a smaller job: write the decision, "
        "name what you control, and take one reversible step."
    ),
    "loneliness": (
        "Loneliness is not just the absence of people; it is the absence of being met. Start with one honest reach-out, "
        "not a performance: one sentence that says what is real."
    ),
    "giving_up": (
        "Part of you wants to stop because carrying this has become too heavy. "
        "Do not decide your whole future from this state. Sit down, breathe once, drink water, "
        "and name the one thing that feels impossible right now."
    ),
}

WEAK_COMPANION_REPLY_MARKERS = (
    "it can be tough",
    "it can be really tough",
    "it's great that",
    "it takes courage",
    "it takes a lot of courage",
    "one thing that might help",
    "one valuable psychology tip",
    "building mental toughness is about",
    "procrastination can be a tough habit",
)


def _normalize_topic_text(value: str) -> str:
    return " ".join(str(value or "").lower().replace("-", " ").replace("_", " ").split())


def life_topic_override_for_message(latest_message: str) -> dict | None:
    text = _normalize_topic_text(latest_message)
    if not text:
        return None
    for rule in LIFE_TOPIC_OVERRIDES:
        if any(phrase in text for phrase in rule["phrases"]):
            return dict(rule)
    return None


def apply_life_topic_override(classification: dict, latest_message: str) -> dict:
    rule = life_topic_override_for_message(latest_message)
    if not rule:
        return _complete_understanding_classification(classification)

    updated = _complete_understanding_classification(dict(classification or {}))
    updated["intent"] = rule["intent"]
    updated["subject"] = rule["subject"]
    updated["user_goal"] = rule["user_goal"]
    updated["answer_posture"] = rule["intent"]
    updated["life_topic_route"] = rule["intent"]
    try:
        confidence = float(updated.get("confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0.0
    updated["confidence"] = max(confidence, 0.9)

    current_state = str(updated.get("emotional_state") or "none")
    override_state = rule["emotional_state"]
    if SEVERITY_ORDER.get(override_state, 0) > SEVERITY_ORDER.get(current_state, 0):
        updated["emotional_state"] = override_state
    return updated


def apply_life_topic_response_floor(response: dict, latest_message: str) -> dict:
    rule = life_topic_override_for_message(latest_message)
    if not rule:
        return response

    subject = rule["subject"]
    floor_reply = LIFE_TOPIC_FALLBACK_REPLIES.get(subject)
    if not floor_reply:
        return response

    reply = str(response.get("reply") or "").strip()
    reply_lower = reply.lower()
    should_replace = (
        not reply
        or len(reply) > 360
        or any(marker in reply_lower for marker in WEAK_COMPANION_REPLY_MARKERS)
    )
    if not should_replace:
        return response

    updated = dict(response)
    updated["reply"] = floor_reply
    updated["suggested_action"] = {"type": "none", "label": "", "route": None}
    updated["tone"] = "serious" if rule["emotional_state"] == "active_pain" else "grounded"
    updated["safety"] = {"risk_level": "none", "message": None}
    updated.setdefault("reply_format", "conversation")
    return updated


def _fallback_understanding_classification(latest_message: str) -> dict:
    es = detect_emotional_state(latest_message)
    it = detect_intent(latest_message, es)
    refused = detect_refused_features(latest_message)
    return {
        "emotional_state": es,
        "intent": it,
        "subject": "unknown",
        "user_goal": "",
        "wants_to_talk": it == "receive_and_reflect",
        "is_refusing_feature": bool(refused),
        "refused_feature": (refused[0].replace("open_", "") if refused else "none"),
        "answer_posture": it,
        "confidence": 0.5,
    }


def _complete_understanding_classification(classification: dict) -> dict:
    intent = str(classification.get("intent") or "solve_directly").strip() or "solve_directly"
    emotional_state = str(classification.get("emotional_state") or "none").strip() or "none"
    classification.setdefault("subject", "unknown")
    classification.setdefault("user_goal", "")
    classification.setdefault("wants_to_talk", intent == "receive_and_reflect")
    classification.setdefault("is_refusing_feature", False)
    classification.setdefault("refused_feature", "none")
    classification.setdefault("answer_posture", intent)
    classification.setdefault("confidence", 0.5)
    classification["intent"] = intent
    classification["emotional_state"] = emotional_state
    return classification


def run_understanding_pass(
    latest_message: str,
    conversation_history: list,
) -> dict:
    """
    PASS 1 - LLM classification for true meaning understanding.
    Falls back to keyword detection if the LLM call fails.
    """
    from ai.prompts import UNDERSTANDING_PROMPT

    recent = (conversation_history or [])[-6:]
    history_text = "\n".join(
        f"{t.get('role', 'user')}: {t.get('content', '')}"
        for t in recent
        if isinstance(t, dict)
    )
    prompt = (
        f"{UNDERSTANDING_PROMPT}\n\n"
        f"[RECENT CONVERSATION]\n{history_text}\n\n"
        f"[LATEST MESSAGE TO CLASSIFY]\n{latest_message}"
    )

    try:
        provider_response = generate_life_companion_with_groq(
            prompt,
            prompt_version="life_companion_understanding_v1",
            timeout_seconds=6,
        )
        classification = parse_life_companion_json(provider_response.text)
        if classification and "emotional_state" in classification and "intent" in classification:
            return apply_life_topic_override(classification, latest_message)
    except Exception:
        pass

    return apply_life_topic_override(
        _fallback_understanding_classification(latest_message),
        latest_message,
    )


def merge_with_safety_net(classification: dict, latest_message: str) -> dict:
    """
    Merges LLM understanding with keyword crisis safety net.
    Always takes the MORE SEVERE emotional state. Keyword crisis forces safety.
    """
    classification = apply_life_topic_override(classification or {}, latest_message)
    keyword_state = detect_emotional_state(latest_message)
    llm_state = classification.get("emotional_state", "none")

    if SEVERITY_ORDER.get(keyword_state, 0) > SEVERITY_ORDER.get(llm_state, 0):
        classification["emotional_state"] = keyword_state

    if keyword_state == "crisis":
        classification["emotional_state"] = "crisis"
        classification["intent"] = "safety_path"
        classification["answer_posture"] = "safety_path"

    keyword_refused = detect_refused_features(latest_message)
    if keyword_refused:
        classification["is_refusing_feature"] = True
        if classification.get("refused_feature", "none") == "none":
            classification["refused_feature"] = keyword_refused[0].replace("open_", "")

    return classification


def _validator_intent_from_classification(classification: dict, user_message: str, mode: str) -> str:
    intent = classification.get("intent")
    subject = classification.get("subject")
    if intent == "safety_path":
        return "safety"
    if intent == "ground_first":
        return "anxiety_grounding"
    if intent == "receive_and_reflect":
        return "emotional_talk"
    if intent == "app_help":
        return "app_guidance"
    if intent == "recommend_list":
        subject_map = {
            "places": "peaceful_knowledge_place_recommendation",
            "books": "book_recommendation",
            "fitness": "fitness_guidance",
            "study": "routine_plan",
            "routine": "routine_plan",
            "career": "career_skill_guidance",
        }
        return subject_map.get(subject, "general_question")
    return detect_companion_intent(user_message, mode)


_WEB_SEARCH_TRIGGER_PHRASES = {
    "latest",
    "current",
    "today",
    "now",
    "recent",
    "news",
    "price",
    "prices",
    "weather",
    "forecast",
    "schedule",
    "score",
    "scores",
    "near me",
    "nearby",
    "best",
    "top",
    "open now",
    "2025",
    "2026",
}

_WEB_SEARCH_INTENTS = {
    "factual_question",
    "recommend_list",
    "solve_directly",
    "app_help",
}

_WEB_SEARCH_SUBJECTS = {
    "places",
    "books",
    "career",
    "fitness",
    "study",
    "routine",
    "app_usage",
    "general",
    "unknown",
}


def should_use_web_research(classification: dict, latest_message: str) -> bool:
    """
    Decide whether to add web research. Keep web out of crisis/active-pain turns.
    """
    if not get_env_bool("LIFE_COMPANION_WEB_RESEARCH_ENABLED", True):
        return False
    emotional_state = classification.get("emotional_state", "none")
    if emotional_state in {"active_pain", "crisis"}:
        return False
    intent = classification.get("intent", "")
    subject = classification.get("subject", "")
    text = str(latest_message or "").lower()
    if "search web" in text or "look up" in text or "browse" in text:
        return True
    if intent in {"conversational", "receive_and_reflect", "ground_first", "safety_path"}:
        return False
    if any(phrase in text for phrase in _WEB_SEARCH_TRIGGER_PHRASES):
        return True
    return intent in _WEB_SEARCH_INTENTS and subject in _WEB_SEARCH_SUBJECTS


def run_web_research_pass(latest_message: str, classification: dict) -> str:
    """
    Optional research pass for current/factual queries. Never logs prompt/output.
    """
    if not should_use_web_research(classification, latest_message):
        return ""
    api_key = get_env_value("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        return ""

    model = get_env_value("OPENAI_WEB_SEARCH_MODEL") or "gpt-4o-mini"
    client = OpenAI(api_key=api_key, timeout=8, max_retries=0)
    research_prompt = (
        "Research the user's latest message on the web when useful, then return "
        "a compact factual brief for another assistant. Do not write the final "
        "companion reply. Include only facts that help answer the user, and include "
        "URLs when they are available.\n\n"
        f"User message: {latest_message}\n"
        f"Understanding: intent={classification.get('intent')}, "
        f"subject={classification.get('subject')}, "
        f"goal={classification.get('user_goal')}"
    )

    try:
        response = client.responses.create(
            model=model,
            tools=[{"type": "web_search"}],
            tool_choice="auto",
            input=research_prompt,
            max_output_tokens=700,
        )
    except TypeError:
        try:
            response = client.responses.create(
                model=model,
                tools=[{"type": "web_search_preview"}],
                tool_choice="auto",
                input=research_prompt,
                max_output_tokens=700,
            )
        except Exception:
            return ""
    except Exception:
        return ""

    text = extract_openai_output_text(response)
    return text[:3000].strip()


class CompanionProviderError(Exception):
    def __init__(
        self,
        reason: str,
        message: str = "Life Companion provider failed.",
        latency_ms: int | None = None,
    ):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms


@dataclass
class CompanionProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


@dataclass
class CompanionProviderAttempt:
    provider: str
    failure_class: str | None = None
    validation_failure_reason: str | None = None
    output_present: bool = False
    validation_pass: bool = False
    latency_ms: int | None = None
    validation_ms: int | None = None


@dataclass
class CompanionGatewayResult:
    status: str
    companion_response: dict
    provider: str
    final_response_mode: str
    latency_ms: int | None = None
    provider_ms: int | None = None
    validation_ms: int | None = None
    fallback_reason: str | None = None
    error_reason: str | None = None
    validation_failure_reason: str | None = None
    attempts: list[CompanionProviderAttempt] = field(default_factory=list)
    prompt_build_ms: int | None = None


def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip("\"").strip("'") or None


def get_companion_provider_order() -> list[str]:
    # Gemini Flash primary → Groq 70B/8B fallback → static fallback
    return [PROVIDER_GEMINI, PROVIDER_GROQ]


def get_env_bool(name: str, default: bool = False) -> bool:
    value = get_env_value(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def allow_groq_fallback_for_openai_auth_failure() -> bool:
    return get_env_bool("LIFE_COMPANION_ALLOW_AUTH_FALLBACK_TO_GROQ", False)


def get_openai_companion_config() -> tuple[str, str]:
    api_key = get_env_value("OPENAI_API_KEY")
    model = get_env_value("OPENAI_COMPANION_MODEL") or "gpt-5.5-mini"
    if not api_key:
        raise CompanionProviderError(REASON_UNAVAILABLE, "OpenAI API key is not configured.")
    if OpenAI is None:
        raise CompanionProviderError(REASON_UNAVAILABLE, "OpenAI SDK is not installed.")
    return api_key, model


def get_value(item, name: str):
    if isinstance(item, dict):
        return item.get(name)
    return getattr(item, name, None)


def extract_openai_output_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output_items = getattr(response, "output", None) or []
    text_parts: list[str] = []
    for item in output_items:
        content_items = get_value(item, "content") or []
        for content_item in content_items:
            text = get_value(content_item, "text")
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())

    return "\n".join(text_parts).strip()


def classify_openai_error(error: Exception) -> str:
    if AuthenticationError is not None and isinstance(error, AuthenticationError):
        return REASON_AUTH_FAILED
    if PermissionDeniedError is not None and isinstance(error, PermissionDeniedError):
        return REASON_AUTH_FAILED
    if NotFoundError is not None and isinstance(error, NotFoundError):
        return REASON_MODEL_UNAVAILABLE
    if BadRequestError is not None and isinstance(error, BadRequestError):
        return REASON_MODEL_UNAVAILABLE
    if RateLimitError is not None and isinstance(error, RateLimitError):
        message = str(error).lower()
        if "insufficient_quota" in message or "quota" in message or "billing" in message:
            return REASON_QUOTA
        return REASON_RATE_LIMITED
    if APITimeoutError is not None and isinstance(error, APITimeoutError):
        return REASON_TIMEOUT
    if APIConnectionError is not None and isinstance(error, APIConnectionError):
        return REASON_UNAVAILABLE
    if APIStatusError is not None and isinstance(error, APIStatusError):
        status_code = getattr(error, "status_code", None)
        if status_code in {401, 403}:
            return REASON_AUTH_FAILED
        if status_code in {400, 404}:
            return REASON_MODEL_UNAVAILABLE
        if status_code == 429:
            return REASON_QUOTA if "quota" in str(error).lower() else REASON_RATE_LIMITED
        if status_code in {500, 502, 503, 504}:
            return REASON_UNAVAILABLE
    return REASON_PROVIDER_EXCEPTION


def _prompt_parts_to_string(prompt_parts: dict) -> str:
    """Flatten a prompt_parts dict to a plain string for providers that expect one."""
    parts: list[str] = [prompt_parts.get("system", "")]
    ctx = prompt_parts.get("context", "")
    if ctx:
        parts.append(ctx)
    for turn in (prompt_parts.get("history") or []):
        if isinstance(turn, dict):
            role = str(turn.get("role", "user")).upper()
            content = str(turn.get("content", ""))
            if content:
                parts.append(f"[{role}]: {content}")
    user_msg = prompt_parts.get("user_message", "")
    if user_msg:
        parts.append(f"[USER]: {user_msg}")
    return "\n\n".join(p for p in parts if p)


def _prompt_parts_to_messages(prompt_parts: dict) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": prompt_parts["system"]}]
    ctx = prompt_parts.get("context", "")
    if ctx:
        messages.append({"role": "system", "content": ctx})
    for turn in (prompt_parts.get("history") or [])[-10:]:
        if not isinstance(turn, dict):
            continue
        role = str(turn.get("role") or "").strip().lower()
        content = str(turn.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        messages.append({"role": role, "content": content})
    user_msg = prompt_parts.get("user_message", "")
    if user_msg:
        messages.append({"role": "user", "content": user_msg})
    return messages


def _call_openai(prompt_parts: dict, timeout_seconds: int) -> str:
    api_key, model = get_openai_companion_config()
    client = OpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=0)
    messages: list[dict] = [{"role": "system", "content": prompt_parts["system"]}]
    ctx = prompt_parts.get("context", "")
    if ctx:
        messages.append({"role": "system", "content": ctx})
    for turn in (prompt_parts.get("history") or []):
        if isinstance(turn, dict) and turn.get("role") and turn.get("content"):
            messages.append({"role": turn["role"], "content": str(turn["content"])})
    user_msg = prompt_parts.get("user_message", "")
    if user_msg:
        messages.append({"role": "user", "content": user_msg})
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        max_tokens=600,
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise CompanionProviderError(REASON_EMPTY_OUTPUT, "OpenAI returned an empty response.")
    return text


def generate_life_companion_with_openai(
    prompt_parts: dict,
    prompt_version: str,
    timeout_seconds: int = 10,
) -> CompanionProviderResponse:
    return call_provider_with_timeout(
        PROVIDER_OPENAI,
        lambda: _call_openai(prompt_parts, timeout_seconds),
        prompt_version=prompt_version,
        timeout_seconds=timeout_seconds,
    )


def normalize_life_companion_validation_failure(reason: str) -> str:
    cleaned = str(reason or "").strip().lower()
    if cleaned.startswith(REASON_INVALID_JSON):
        return REASON_INVALID_JSON
    if cleaned == "book_intent_loop_action":
        return cleaned
    if cleaned == "reflection_rejected_by_user":
        return cleaned
    if cleaned == REASON_INVALID_ACTION_TYPE:
        return REASON_INVALID_ACTION_TYPE
    if cleaned == REASON_INVALID_ACTION_ROUTE:
        return REASON_INVALID_ACTION_ROUTE
    if cleaned.startswith("unsafe_"):
        return REASON_UNSAFE_OUTPUT
    return REASON_VALIDATOR_FAILED


def log_companion_provider_call(*, provider: str, timeout_seconds: int) -> None:
    print(
        "LIFE_COMPANION_PROVIDER_CALL "
        "provider_called=true "
        f"provider={provider} "
        f"timeout_seconds={timeout_seconds}"
    )


def call_provider_with_timeout(
    provider: str,
    call,
    *,
    prompt_version: str,
    timeout_seconds: int,
) -> CompanionProviderResponse:
    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(call)

    try:
        text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise CompanionProviderError(REASON_TIMEOUT, latency_ms=latency_ms) from exc
    except CompanionProviderError:
        executor.shutdown(wait=False, cancel_futures=True)
        raise
    except Exception as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise CompanionProviderError(classify_openai_error(exc), latency_ms=latency_ms) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)
    return CompanionProviderResponse(
        text=text,
        provider=provider,
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )


def attempt_provider(
    provider: str,
    *,
    prompt_parts: dict,
    prompt_version: str,
    expected_intent: str | None = None,
    user_message: str | None = None,
    understanding: dict | None = None,
) -> tuple[dict | None, CompanionProviderAttempt]:
    attempt = CompanionProviderAttempt(provider=provider)
    try:
        if provider == PROVIDER_GEMINI:
            log_companion_provider_call(provider=provider, timeout_seconds=20)
            try:
                provider_response = generate_life_companion_with_gemini(
                    prompt_parts,
                    prompt_version=prompt_version,
                    classified_intent=expected_intent,
                    timeout_seconds=20,
                )
            except GeminiCompanionProviderError as error:
                raise CompanionProviderError(
                    error.reason,
                    latency_ms=error.latency_ms,
                ) from error
        elif provider == PROVIDER_OPENAI:
            log_companion_provider_call(provider=provider, timeout_seconds=10)
            provider_response = generate_life_companion_with_openai(
                prompt_parts,
                prompt_version=prompt_version,
            )
        elif provider == PROVIDER_GROQ:
            log_companion_provider_call(provider=provider, timeout_seconds=14)
            try:
                provider_response = generate_life_companion_with_groq_messages(
                    _prompt_parts_to_messages(prompt_parts),
                    prompt_version=prompt_version,
                    timeout_seconds=14,
                )
            except GroqCompanionProviderError as error:
                raise CompanionProviderError(
                    error.reason,
                    latency_ms=error.latency_ms,
                ) from error
        else:
            raise CompanionProviderError(REASON_UNAVAILABLE)

        attempt.latency_ms = provider_response.latency_ms
        attempt.output_present = bool(provider_response.text.strip())

        # ── FAST-PATH BYPASS for non-safety intents ───────────────────────
        # Accept any AI response that has a non-empty reply without running
        # the full validation chain. Validation failures must never discard
        # a valid practical answer. Only safety intents get strict checks.
        _norm_intent = _normalize_intent_gw(expected_intent) if expected_intent else ""
        if _norm_intent not in SAFETY_INTENTS and _norm_intent not in BOOK_RECOMMENDATION_INTENTS:
            try:
                _payload = parse_life_companion_json(provider_response.text)
                if isinstance(_payload.get("companion_response"), dict):
                    _payload = _payload["companion_response"]
                _reply = str(_payload.get("reply") or "").strip()
                if _reply:
                    _tone = str(_payload.get("tone") or "grounded").strip().lower()
                    if _tone not in {"light", "grounded", "serious"}:
                        _tone = "grounded"
                    _risk = str((_payload.get("safety") or {}).get("risk_level") or "none").strip().lower()
                    if _risk not in {"none", "low", "medium", "crisis"}:
                        _risk = "none"
                    companion_response = {
                        "reply": _reply if _reply[-1] in ".!?" else _reply + ".",
                        "suggested_action": {"type": "none", "label": "", "route": None},
                        "tone": _tone,
                        "safety": {"risk_level": _risk, "message": None},
                        "intent": _normalize_intent_gw(_payload.get("intent") or expected_intent or "general_question"),
                    }
                    attempt.validation_ms = 0
                    attempt.validation_pass = True
                    print(f"COMPANION_BYPASS_PASS provider={provider} intent={_norm_intent} reply_len={len(_reply)}")
                    return companion_response, attempt
            except Exception as _bypass_err:
                print(f"COMPANION_BYPASS_FALLTHROUGH provider={provider} err={_bypass_err!r}")
        # ─────────────────────────────────────────────────────────────────

        validation_started = perf_counter()
        try:
            companion_response = validate_life_companion_response(
                provider_response.text,
                expected_intent=expected_intent,
                user_message=user_message,
                understanding=understanding,
            )
        finally:
            attempt.validation_ms = int((perf_counter() - validation_started) * 1000)
        if expected_intent:
            companion_response.setdefault("intent", expected_intent)
        attempt.validation_pass = True
        return companion_response, attempt
    except LifeCompanionValidationError as error:
        attempt.validation_failure_reason = normalize_life_companion_validation_failure(error.reason)
        attempt.failure_class = attempt.validation_failure_reason
        attempt.validation_pass = False
        attempt.output_present = True
        return None, attempt
    except CompanionProviderError as error:
        attempt.failure_class = error.reason
        attempt.latency_ms = error.latency_ms
        return None, attempt


def should_try_groq_after_openai_attempt(attempt: CompanionProviderAttempt) -> bool:
    if attempt.validation_failure_reason:
        return attempt.validation_failure_reason in OPENAI_TO_GROQ_VALIDATION_REASONS
    if attempt.failure_class == REASON_AUTH_FAILED:
        return allow_groq_fallback_for_openai_auth_failure()
    return attempt.failure_class in OPENAI_TO_GROQ_FAILURE_REASONS


def log_companion_provider_summary(
    *,
    provider_order: list[str],
    selected_provider: str,
    attempts: list[CompanionProviderAttempt],
    final_response_mode: str,
    latency_ms: int,
) -> None:
    failure_class = ";".join(
        f"{attempt.provider}:{attempt.failure_class or 'none'}"
        for attempt in attempts
        if attempt.failure_class
    ) or "none"
    output_present = any(attempt.output_present for attempt in attempts)
    validation_pass = any(attempt.validation_pass for attempt in attempts)
    provider_ms = sum(attempt.latency_ms or 0 for attempt in attempts)
    validation_ms = sum(attempt.validation_ms or 0 for attempt in attempts)
    validation_failure_reason = ";".join(
        f"{attempt.provider}:{attempt.validation_failure_reason}"
        for attempt in attempts
        if attempt.validation_failure_reason
    ) or "none"
    print(
        "LIFE_COMPANION_PROVIDER "
        f"provider_attempt_order={','.join(provider_order)} "
        f"provider_selected={selected_provider} "
        f"provider_failure_class={failure_class} "
        f"output_present={output_present} "
        f"output_text_present={output_present} "
        f"validation_pass={validation_pass} "
        f"validation_failure_reason={validation_failure_reason} "
        f"final_response_mode={final_response_mode} "
        f"provider_ms={provider_ms} "
        f"validation_ms={validation_ms} "
        f"latency_ms={latency_ms}"
    )


def generate_life_companion_response(
    *,
    prompt: str = "",
    prompt_version: str,
    mode: str,
    context: dict | None,
    user_message: str,
    knowledge_chunks: list[dict] | None = None,
    understanding: dict | None = None,
    conversation_history: list | None = None,
) -> CompanionGatewayResult:
    started = perf_counter()

    # ── Input sanitization ─────────────────────────────────────────────────
    user_message = sanitize_user_message(str(user_message or ""))

    # ── Per-user rate limiting ─────────────────────────────────────────────
    _uid = (context or {}).get("user_id", "anonymous")
    if not check_rate_limit(_uid):
        rate_reply = {
            "reply": "You are sending messages very fast. Take a breath and try again in a moment.",
            "intent": "rate_limited",
            "tone": "grounded",
            "suggested_action": {"type": "none", "label": "", "route": None},
            "safety": {"risk_level": "none", "message": None},
        }
        return CompanionGatewayResult(
            status="rate_limited",
            companion_response=rate_reply,
            provider="rate_limiter",
            final_response_mode="rate_limited",
            latency_ms=0,
        )

    # ── PIPELINE: Two-pass understanding and session state ─────────────────
    latest_message = str(user_message or "").strip()
    user_id = (context or {}).get("user_id", "")
    session_id = (context or {}).get("conversation_id") or (context or {}).get("session_id", "default")
    conversation_history = conversation_history or []

    classification = run_understanding_pass(latest_message, conversation_history)
    classification = merge_with_safety_net(classification, latest_message)

    emotional_state = classification.get("emotional_state", "none")
    intent = classification.get("intent", "solve_directly")

    session = get_companion_session(user_id, session_id)
    refused_this_turn = []
    if classification.get("is_refusing_feature"):
        refused_feature = classification.get("refused_feature", "none")
        if refused_feature != "none":
            refused_this_turn.append(f"open_{refused_feature}")
    session.update(emotional_state, refused_this_turn)
    save_companion_session(user_id, session_id, session)
    _rag_tags = get_rag_filter_tags(emotional_state, intent)

    # ── STAGE 1: Classify intent into richer UserIntent model ─────────────
    user_intent = map_from_classification(classification, latest_message)
    # ───────────────────────────────────────────────────────────────────────

    # ── PIPELINE: Playbook RAG retrieval ──────────────────────────────────
    prompt_build_started = perf_counter()
    rag_context_string = retrieve_playbook_chunks(
        query=latest_message,
        filter_tags=_rag_tags if _rag_tags else None,
        top_k=4,
    )
    if len(rag_context_string.strip()) < 100:
        rag_context_string = (
            "[NOTE: No specific playbook content matched this query. "
            "Answer from your general knowledge as a thoughtful, knowledgeable "
            "guide. Be direct and complete. Never use any fallback phrase.]"
        )
    web_context_string = run_web_research_pass(latest_message, classification)
    # ───────────────────────────────────────────────────────────────────────

    # ── STAGE 2a: Format memory properly (fixes empty-summary bug) ────────
    _safe_memory = (context or {}).get("safe_memory_summary") or {}
    _formatted_memory = format_memory_for_prompt(_safe_memory, user_intent.intent)
    # ───────────────────────────────────────────────────────────────────────

    # ── STAGE 2b: Route knowledge by intent ───────────────────────────────
    _knowledge_chunks = knowledge_chunks or []
    _intent_knowledge = get_relevant_knowledge(
        user_intent.intent,
        _knowledge_chunks,
        max_chunks=3,
    )
    # ───────────────────────────────────────────────────────────────────────

    # ── PIPELINE: Build structured prompt (Stages 1-3 wired in) ──────────
    prompt_parts = build_life_companion_prompt(
        user_message=latest_message,
        rag_context=rag_context_string,
        conversation_history=conversation_history,
        session_context=session.to_summary(),
        classification=classification,
        web_context=web_context_string,
        user_intent=user_intent,
        formatted_memory=_formatted_memory,
        intent_knowledge=_intent_knowledge,
    )
    provider_prompt_parts = {
        **prompt_parts,
        "user_message": latest_message[:1200],
    }
    _prompt_build_ms = int((perf_counter() - prompt_build_started) * 1000)
    # ───────────────────────────────────────────────────────────────────────

    provider_order = get_companion_provider_order()
    attempts: list[CompanionProviderAttempt] = []
    expected_intent = _validator_intent_from_classification(classification, user_message, mode)

    if expected_intent == "safety" or emotional_state == "crisis":
        companion_response = generate_life_companion_crisis_response()
        latency_ms = int((perf_counter() - started) * 1000)
        return CompanionGatewayResult(
            status="safety",
            companion_response=companion_response,
            provider="deterministic",
            final_response_mode="safety",
            latency_ms=latency_ms,
            provider_ms=0,
            validation_ms=0,
            attempts=[],
            prompt_build_ms=_prompt_build_ms,
        )

    for provider in provider_order:
        if provider == PROVIDER_GROQ and attempts:
            prev = attempts[-1]
            if (
                prev.provider == PROVIDER_OPENAI
                and not should_try_groq_after_openai_attempt(prev)
            ):
                break
            # Always try Groq as fallback after Gemini failure
        companion_response, attempt = attempt_provider(
            provider,
            prompt_parts=provider_prompt_parts,
            prompt_version=prompt_version,
            expected_intent=expected_intent,
            user_message=user_message,
            understanding=classification,
        )
        attempts.append(attempt)
        if companion_response:
            # ── PIPELINE: Action suppression ─────────────────────────────
            _action_type = (companion_response.get("suggested_action") or {}).get("type", "none")
            if session.should_suppress_action(_action_type):
                companion_response["suggested_action"] = {"type": "none", "label": "", "reason": ""}
                companion_response["route_locked"] = True

            companion_response = apply_life_topic_response_floor(
                companion_response,
                latest_message,
            )

            # ── PIPELINE: Semantic response validation ────────────────────
            _validation = validate_companion_response(
                response=companion_response,
                latest_message=latest_message,
                emotional_state=emotional_state,
                refused_features=list(session.refused_features),
                conversation_turn=session.turn_count,
                intent=intent,
            )
            if not _validation["valid"] and _validation["fallback"]:
                companion_response["reply"] = _validation["fallback"]
                companion_response["suggested_action"] = {"type": "none", "label": "", "reason": ""}
                companion_response["route_locked"] = True
            # ─────────────────────────────────────────────────────────────

            latency_ms = int((perf_counter() - started) * 1000)
            provider_ms = sum(item.latency_ms or 0 for item in attempts)
            validation_ms = sum(item.validation_ms or 0 for item in attempts)
            final_response_mode = f"live_{provider}"
            log_companion_provider_summary(
                provider_order=provider_order,
                selected_provider=provider,
                attempts=attempts,
                final_response_mode=final_response_mode,
                latency_ms=latency_ms,
            )
            return CompanionGatewayResult(
                status="success",
                companion_response=companion_response,
                provider=provider,
                final_response_mode=final_response_mode,
                latency_ms=latency_ms,
                provider_ms=provider_ms,
                validation_ms=validation_ms,
                attempts=attempts,
                prompt_build_ms=_prompt_build_ms,
            )

    topic_rule = life_topic_override_for_message(latest_message)
    if expected_intent == "safety" or emotional_state == "crisis":
        fallback_response = generate_life_companion_crisis_response()
    elif topic_rule and topic_rule["subject"] in LIFE_TOPIC_FALLBACK_REPLIES:
        fallback_response = {
            "reply": LIFE_TOPIC_FALLBACK_REPLIES[topic_rule["subject"]],
            "reply_format": "conversation",
            "sections": [],
            "suggested_action": {"type": "none", "label": "", "route": None},
            "tone": "grounded",
            "safety": {"risk_level": "none", "message": None},
            "intent": expected_intent or "general_question",
        }
    else:
        fallback_response = generate_life_companion_fallback(
            mode,
            context,
            user_message=user_message,
            knowledge_chunks=knowledge_chunks,
        )
    if expected_intent:
        fallback_response.setdefault("intent", expected_intent)
    latency_ms = int((perf_counter() - started) * 1000)
    validation_failed = any(attempt.validation_failure_reason for attempt in attempts)
    first_failure = next((attempt.failure_class for attempt in attempts if attempt.failure_class), None)
    first_validation_failure = next(
        (attempt.validation_failure_reason for attempt in attempts if attempt.validation_failure_reason),
        None,
    )
    fallback_reason = first_validation_failure if validation_failed else first_failure
    provider_ms = sum(attempt.latency_ms or 0 for attempt in attempts)
    validation_ms = sum(attempt.validation_ms or 0 for attempt in attempts)
    log_companion_provider_summary(
        provider_order=provider_order,
        selected_provider=PROVIDER_FALLBACK,
        attempts=attempts,
        final_response_mode=PROVIDER_FALLBACK,
        latency_ms=latency_ms,
    )
    return CompanionGatewayResult(
        status="fallback",
        companion_response=fallback_response,
        provider=PROVIDER_FALLBACK,
        final_response_mode=PROVIDER_FALLBACK,
        latency_ms=latency_ms,
        provider_ms=provider_ms,
        validation_ms=validation_ms,
        fallback_reason=fallback_reason or REASON_UNAVAILABLE,
        error_reason=first_failure if not validation_failed else None,
        validation_failure_reason=first_validation_failure if validation_failed else None,
        attempts=attempts,
        prompt_build_ms=_prompt_build_ms,
    )
