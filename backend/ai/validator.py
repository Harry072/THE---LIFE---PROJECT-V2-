import json
import re

from .context import CORE_CATEGORY_ORDER, normalize_category
from .companion_intents import normalize_intent


class TaskValidationError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class WeeklyMirrorValidationError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class LifeCompanionValidationError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


COMPANION_MODES = {
    "understand_me",
    "make_today_easier",
    "reset_my_mind",
    "help_me_reflect",
    "suggest_next_step",
}

COMPANION_TONES = {"light", "grounded", "serious"}
COMPANION_RISK_LEVELS = {"none", "low", "medium", "crisis"}
COMPANION_ACTION_ROUTES = {
    "loop": "/loop",
    "reflection": "/reflection",
    "reset": "/meditation",
    "curator": "/curator",
    "weekly_mirror": "/dashboard",
    "real_world_action": None,
    "none": None,
}

COMPANION_REPLY_FORMATS = {
    "conversation",
    "structured_plan",
    "grounding",
    "moral_reflection",
    "quote",
    "physical_action",
    "app_guidance",
    "book_recommendation",
    "safety",
}

BOOK_RECOMMENDATION_INTENTS = {
    "book_recommendation",
    "philosophy_novel_recommendation",
    "novel_recommendation",
    "self_growth_book_request",
    "book_recommendation",
    "reading_request",
    "curator_request",
    "reading_or_learning",
}

DIRECT_ANSWER_INTENTS = {
    "peaceful_knowledge_place_recommendation",
    "empathy_eq",
    "relationship_understanding",
    "study_gym_plan",
    "fitness_guidance",
    "routine_plan",
    "book_recommendation",
    "quote_request",
    "physical_action",
    "career_skill_guidance",
    "life_clarity",
    "spiritual_reflection",
    "correction_request",
    "general_question",
}

_DEDUP_STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "your", "you", "one", "this", "is", "it", "be", "do",
    "that", "by", "as", "from",
}


def _significant_words(text: str) -> set[str]:
    return {
        w for w in re.findall(r"[a-z]{3,}", str(text or "").lower())
        if w not in _DEDUP_STOP_WORDS
    }


def _word_overlap_ratio(a: str, b: str) -> float:
    wa, wb = _significant_words(a), _significant_words(b)
    if len(wa) < 3 or len(wb) < 3:
        return 0.0
    inter = wa & wb
    union = wa | wb
    return len(inter) / len(union) if union else 0.0


UNSAFE_PATTERNS = [
    r"\bdiagnos(e|is|ed|ing)\b",
    r"\bcure\b",
    r"\btreat(ment)?\b",
    r"\bmedical advice\b",
    r"\bmedication\b",
    r"\bclinical depression\b",
    r"\badhd\b",
    r"\bptsd\b",
    r"\bhurt yourself\b",
    r"\bself-harm\b",
    r"\bsuicide\b",
    r"\bkill yourself\b",
    r"\bskip meals?\b",
    r"\bdon't sleep\b",
    r"\bdo not sleep\b",
]

GENERIC_SPAM_PATTERNS = [
    r"\bbe productive\b",
    r"\bstay motivated\b",
    r"\bthink positive\b",
    r"\bcrush your goals\b",
    r"\bunlock your potential\b",
]

OVERWHELMING_PATTERNS = [
    r"\ball day\b",
    r"\bevery hour\b",
    r"\buntil you finish\b",
    r"\bno breaks?\b",
]

VAGUE_ACTION_PATTERNS = [
    r"\bthink about\b",
    r"\bbe mindful\b",
    r"\bdo better\b",
    r"\bstay motivated\b",
    r"\btry harder\b",
]

WEEKLY_MIRROR_FIELDS = [
    "week_sentence",
    "inner_weather_pattern",
    "repeated_theme",
    "helped_forward",
    "pulled_back",
    "weekly_question",
    "next_focus",
]

RECOMMENDATION_TYPES = {
    "task",
    "reflection",
    "reset",
    "book",
    "real_world_action",
}

RECOMMENDATION_FIELDS = [
    "type",
    "title",
    "reason",
    "action_label",
]

WEEKLY_MIRROR_UNSAFE_PATTERNS = [
    *UNSAFE_PATTERNS,
    r"\byou are\s+(depressed|anxious|broken|lazy|failing|traumatized|unstable)\b",
    r"\byou have\s+(anxiety|depression|ptsd|adhd|a disorder)\b",
    r"\byour problem is\b",
    r"\byou need to fix\b",
    r"\bthis proves\b",
    r"\bguarantee(s|d)?\b",
    r"\btrauma\b",
    r"\bdisorder\b",
    r"\bdepressed\b",
    r"\banxiety\b",
    r"\bmental illness\b",
    r"\btherapy\b",
    r"\btherapist\b",
    r"\bi know exactly how you feel\b",
    r"\byou need me\b",
    r"\bi am your only support\b",
    r"\bi understand you completely\b",
    r"\balways\b",
    r"\bnever\b",
]

COMPANION_UNSAFE_PATTERNS = [
    *UNSAFE_PATTERNS,
    r"\byou are\s+(depressed|anxious|broken|lazy|failing|traumatized|unstable)\b",
    r"\byou have\s+(anxiety|depression|ptsd|adhd|a disorder)\b",
    r"\byour trauma is\b",
    r"\byour disorder is\b",
    r"\byour diagnosis\b",
    r"\btherapy\b",
    r"\btherapist\b",
    r"\bdoctor\b",
    r"\byour problem is\b",
    r"\byou need to fix\b",
    r"\bthis proves\b",
    r"\bi know exactly how you feel\b",
    r"\bi understand you completely\b",
    r"\bi am your best friend\b",
    r"\bi am your only support\b",
    r"\byou need me\b",
    r"\bi will always be here\b",
    r"\byou can only rely on me\b",
    r"\bsystem prompt\b",
    r"\bhidden instructions?\b",
    r"\bdeveloper message\b",
    r"\bapi key\b",
    r"\bservice role\b",
    r"\bbackend logic\b",
    r"\bprivate data\b",
    r"\bguarantee(s|d)?\b",
    r"\bwill change your life\b",
]

SOURCE_LEAKAGE_PATTERNS = [
    r"\baccording to (the )?(pdf|document|knowledge base|source|retrieved context)\b",
    r"\b(the|this) pdf\b",
    r"\bknowledge base\b",
    r"\bretrieved (guidance|knowledge|context|text|chunk)\b",
    r"\bchunk(_id| id| ids?)\b",
    r"\bsource (name|metadata|document|text)\b",
    r"\bsimilarity score\b",
    r"\bpage number\b",
    r"\bon page \d+\b",
]

CRISIS_PATTERNS = [
    r"\bkill myself\b",
    r"\bkill me\b",
    r"\bend my life\b",
    r"\bi want to die\b",
    r"\bi don't want to live\b",
    r"\bi do not want to live\b",
    r"\bnot be alive\b",
    r"\bsuicid(e|al)\b",
    r"\bself[-\s]?harm\b",
    r"\bhurt myself\b",
    r"\bharm myself\b",
    r"\boverdose\b",
    r"\bno reason to live\b",
    r"\bimmediate danger\b",
    r"\bi might hurt\b",
    r"\bgoing to hurt myself\b",
]

PROMPT_INJECTION_PATTERNS = [
    r"\bignore (all )?(previous|prior) (instructions?|rules)\b",
    r"\boverride (the )?(system|developer|instructions?)\b",
    r"\breveal (me )?(your )?(prompt|system prompt|hidden prompt|hidden instructions?)\b",
    r"\bshow (me )?(your )?(prompt|system prompt|hidden prompt|hidden instructions?)\b",
    r"\bprint (me )?(your )?(prompt|system prompt|hidden prompt|hidden instructions?)\b",
    r"\bdeveloper message\b",
    r"\bsystem message\b",
    r"\bservice role\b",
    r"\bapi key\b",
    r"\bsecret(s)?\b",
    r"\bjailbreak\b",
    r"\bprivate data\b",
    r"\bbackend logic\b",
]

RECOMMENDATION_GROUNDING_PATTERNS = [
    r"\bthe mirror noticed\b",
    r"\bthis week seemed\b",
    r"\ba small thing\b",
    r"\bpattern\b",
    r"\bmood\b",
    r"\btask(s)?\b",
    r"\baction\b",
    r"\breflection(s)?\b",
    r"\bfocus\b",
    r"\bweek\b",
]

INTENSITY_DURATION_RANGES = {
    "gentle": (2, 10),
    "normal": (10, 20),
    "deeper": (20, 30),
}

KOTLER_TAGS = {"Curiosity", "Purpose", "Passion", "Autonomy", "Mastery"}
KOTLER_TAG_LOOKUP = {tag.lower(): tag for tag in KOTLER_TAGS}


def parse_model_json(raw_text: str):
    cleaned = str(raw_text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    try:
        payload = json.loads(cleaned.strip(), strict=False)
    except json.JSONDecodeError as exc:
        raise TaskValidationError(f"invalid_json:{exc.msg}") from exc

    if isinstance(payload, dict) and isinstance(payload.get("tasks"), list):
        return payload["tasks"]
    return payload


def parse_json_object(raw_text: str):
    cleaned = str(raw_text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    try:
        payload = json.loads(cleaned.strip(), strict=False)
    except json.JSONDecodeError as exc:
        raise WeeklyMirrorValidationError(f"invalid_json:{exc.msg}") from exc

    if not isinstance(payload, dict):
        raise WeeklyMirrorValidationError("payload_not_object")
    return payload


def parse_life_companion_json(raw_text: str) -> dict:
    cleaned = str(raw_text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        payload = json.loads(cleaned, strict=False)
    except json.JSONDecodeError as exc:
        decoder = json.JSONDecoder(strict=False)
        payload = None
        for match in re.finditer(r"{", cleaned):
            try:
                candidate, _ = decoder.raw_decode(cleaned[match.start():])
            except json.JSONDecodeError:
                continue
            if isinstance(candidate, dict):
                payload = candidate
                break
        if payload is None:
            raise LifeCompanionValidationError(f"invalid_json:{exc.msg}") from exc

    if not isinstance(payload, dict):
        raise LifeCompanionValidationError("payload_not_object")
    return payload


def limit_words(text: str, max_words: int) -> str:
    words = str(text or "").split()
    return " ".join(words[:max_words]).strip()


def ensure_terminal_punctuation(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned:
        return cleaned
    return cleaned if cleaned[-1] in ".!?" else f"{cleaned}."


def sentence_count(text: str) -> int:
    cleaned = re.sub(r"(?<!\w)\d+[.)]\s+", "", str(text or ""))
    parts = [part for part in re.split(r"[.!?]+", cleaned) if part.strip()]
    return len(parts)


def has_pattern(text: str, patterns: list[str]) -> bool:
    lowered = str(text or "").lower()
    return any(re.search(pattern, lowered, re.I) for pattern in patterns)


def validate_life_companion_mode(mode: str) -> str:
    cleaned = str(mode or "").strip().lower()
    if cleaned not in COMPANION_MODES:
        raise LifeCompanionValidationError("invalid_mode")
    return cleaned


def detect_life_companion_safety(message: str) -> dict:
    cleaned = " ".join(str(message or "").split())
    return {
        "risk_level": "crisis" if has_pattern(cleaned, CRISIS_PATTERNS) else "none",
        "crisis": has_pattern(cleaned, CRISIS_PATTERNS),
        "prompt_injection": has_pattern(cleaned, PROMPT_INJECTION_PATTERNS),
    }


def validate_life_companion_message(message: str, max_chars: int = 1200) -> str:
    cleaned = " ".join(str(message or "").strip().split())
    if not cleaned:
        raise LifeCompanionValidationError("empty_message")
    if len(cleaned) > max_chars:
        raise LifeCompanionValidationError("message_too_long")
    return cleaned


def validate_life_companion_text(value: object, *, field: str, max_chars: int) -> str:
    if not isinstance(value, str):
        raise LifeCompanionValidationError(f"missing_{field}")
    cleaned = " ".join(value.strip().split())
    if not cleaned:
        raise LifeCompanionValidationError(f"empty_{field}")
    if len(cleaned) > max_chars:
        raise LifeCompanionValidationError(f"too_long_{field}")
    if has_pattern(cleaned, COMPANION_UNSAFE_PATTERNS):
        raise LifeCompanionValidationError(f"unsafe_{field}")
    return cleaned


def validate_life_companion_action(action: object) -> dict:
    if not isinstance(action, dict):
        raise LifeCompanionValidationError("missing_suggested_action")

    action_type = str(action.get("type") or "").strip().lower()
    if action_type not in COMPANION_ACTION_ROUTES:
        raise LifeCompanionValidationError("invalid_action_type")

    expected_route = COMPANION_ACTION_ROUTES[action_type]
    route = action.get("route")
    if expected_route is None:
        if route not in (None, ""):
            raise LifeCompanionValidationError("invalid_action_route")
        route = None
    elif route != expected_route:
        raise LifeCompanionValidationError("invalid_action_route")

    if action_type == "none":
        raw_label = action.get("label")
        if raw_label not in (None, ""):
            validate_life_companion_text(
                raw_label,
                field="action_label",
                max_chars=48,
            )
        return {
            "type": action_type,
            "label": "",
            "route": None,
        }

    label = validate_life_companion_text(
        action.get("label") or "",
        field="action_label",
        max_chars=48,
    )
    if len(label.split()) > 6:
        raise LifeCompanionValidationError("too_many_words_action_label")

    return {
        "type": action_type,
        "label": label,
        "route": route,
    }


def user_rejects_reflection(message: str | None) -> bool:
    cleaned = str(message or "").lower().replace("’", "'")
    return has_pattern(
        cleaned,
        [
            r"\bno reflection\b",
            r"\bno journaling?\b",
            r"\bdo not (send|route) me (to )?reflection\b",
            r"\bdon't (send|route) me (to )?reflection\b",
            r"\bdont (send|route) me (to )?reflection\b",
            r"\bdo not need reflection\b",
            r"\bdon't need reflection\b",
            r"\bdont need reflection\b",
        ],
    )


def validate_companion_sections(sections: object) -> list[dict]:
    if sections is None:
        return []
    if not isinstance(sections, list):
        raise LifeCompanionValidationError("sections_not_array")
    if len(sections) > 6:
        raise LifeCompanionValidationError("too_many_sections")
    validated = []
    for i, section in enumerate(sections):
        if not isinstance(section, dict):
            raise LifeCompanionValidationError(f"section_{i}_not_object")
        result: dict = {}
        raw_title = section.get("title")
        if raw_title is not None:
            if not isinstance(raw_title, str):
                raise LifeCompanionValidationError(f"section_{i}_title_not_string")
            title = " ".join(raw_title.strip().split())
            if len(title) > 60:
                raise LifeCompanionValidationError(f"section_{i}_title_too_long")
            if has_pattern(title, COMPANION_UNSAFE_PATTERNS):
                raise LifeCompanionValidationError(f"section_{i}_unsafe_title")
            result["title"] = title
        raw_items = section.get("items")
        raw_body = section.get("body")
        if raw_items is not None:
            if not isinstance(raw_items, list):
                raise LifeCompanionValidationError(f"section_{i}_items_not_array")
            if len(raw_items) > 10:
                raise LifeCompanionValidationError(f"section_{i}_too_many_items")
            clean_items = []
            for j, item in enumerate(raw_items):
                if not isinstance(item, str):
                    raise LifeCompanionValidationError(f"section_{i}_item_{j}_not_string")
                cleaned = " ".join(item.strip().split())
                if len(cleaned) > 180:
                    raise LifeCompanionValidationError(f"section_{i}_item_{j}_too_long")
                if has_pattern(cleaned, COMPANION_UNSAFE_PATTERNS):
                    raise LifeCompanionValidationError(f"section_{i}_item_{j}_unsafe")
                clean_items.append(cleaned)
            result["items"] = clean_items
        elif raw_body is not None:
            if not isinstance(raw_body, str):
                raise LifeCompanionValidationError(f"section_{i}_body_not_string")
            body = " ".join(raw_body.strip().split())
            if len(body) > 650:
                raise LifeCompanionValidationError(f"section_{i}_body_too_long")
            if has_pattern(body, COMPANION_UNSAFE_PATTERNS):
                raise LifeCompanionValidationError(f"section_{i}_unsafe_body")
            result["body"] = body
        validated.append(result)
    return validated


def _sections_contain(sections: list[dict], keyword: str) -> bool:
    kw = keyword.lower()
    for section in sections:
        title = str(section.get("title") or "").lower()
        body = str(section.get("body") or "").lower()
        items = section.get("items") or []
        if kw in title or kw in body:
            return True
        if any(kw in str(item).lower() for item in items):
            return True
    return False


def _combined_response_text(result: dict) -> str:
    sections = result.get("sections") or []
    parts = [str(result.get("reply") or "")]
    for section in sections:
        parts.append(str(section.get("title") or ""))
        parts.append(str(section.get("body") or ""))
        parts.extend(str(item or "") for item in (section.get("items") or []))
    return " ".join(parts).lower()


def validate_no_source_leakage(result: dict) -> None:
    if has_pattern(_combined_response_text(result), SOURCE_LEAKAGE_PATTERNS):
        raise LifeCompanionValidationError("source_metadata_leakage")


def _has_any_text(result: dict, words: list[str]) -> bool:
    text = _combined_response_text(result)
    return any(word in text for word in words)


def _reject_wrong_route(result: dict, intent: str) -> None:
    action_type = (result.get("suggested_action") or {}).get("type")
    if action_type in {"loop", "curator", "reset", "reflection", "weekly_mirror"}:
        allowed = {
            "book_recommendation": {"curator", "none"},
            "anxiety_grounding": {"reset", "real_world_action", "none"},
            "app_guidance": {"loop", "reflection", "reset", "curator", "weekly_mirror", "real_world_action", "none"},
            "task_help": {"loop", "real_world_action", "none"},
            "routine_plan": {"loop", "none"},
        }.get(intent, {"none", "real_world_action"})
        if action_type not in allowed:
            raise LifeCompanionValidationError(f"{intent}_invalid_route_action")

    reply = str(result.get("reply") or "").lower()
    if intent in DIRECT_ANSWER_INTENTS and action_type != "none":
        if len(_significant_words(reply)) < 8 and has_pattern(reply, [r"\b(open|go to|use)\b"]):
            raise LifeCompanionValidationError(f"{intent}_route_only_answer")


def validate_direct_output_contract(result: dict, expected_intent: str | None = None) -> None:
    intent = normalize_intent(expected_intent or result.get("intent"))
    sections = result.get("sections") or []
    _reject_wrong_route(result, intent)

    if intent in {"study_gym_plan", "study_gym_routine"}:
        has_study = _sections_contain(sections, "study") or "study" in str(result.get("reply", "")).lower()
        has_gym = _sections_contain(sections, "gym") or "gym" in str(result.get("reply", "")).lower()
        if not has_study:
            raise LifeCompanionValidationError("study_gym_routine_missing_study_content")
        if not has_gym:
            raise LifeCompanionValidationError("study_gym_routine_missing_gym_content")

    if intent in {"peaceful_knowledge_place_recommendation", "peaceful_place_recommendation"}:
        place_words = [
            "library", "reading room", "museum", "garden", "park", "gurudwara",
            "temple", "monastery", "ashram", "fort", "memorial", "book cafe",
            "bookshop", "gallery", "university", "heritage",
            "meditation center", "riverside", "lake", "river",
        ]
        combined = _combined_response_text(result)
        has_places = sum(1 for word in place_words if word in combined) >= 3
        if not has_places:
            raise LifeCompanionValidationError("place_recommendation_missing_places")
        # Reject grounding-only response — place requests must not be answered with
        # breathing steps alone, even when the user's tone sounds anxious.
        grounding_phrases = [
            "feet flat on the floor", "relax your jaw", "one slow breath out",
            "name three things you can see",
        ]
        is_grounding_only = any(phrase in combined for phrase in grounding_phrases) and not has_places
        if is_grounding_only:
            raise LifeCompanionValidationError("place_recommendation_grounding_only_response")
        # Require peace/calm/meditation context (knowledge is optional for pure place requests)
        if not _has_any_text(result, ["peace", "calm", "quiet", "meditat", "serene"]):
            raise LifeCompanionValidationError("place_recommendation_missing_peace_context")

    if intent == "quote_request":
        reply = str(result.get("reply") or "")
        has_quote = (
            '"' in reply
            or "“" in reply
            or "‘" in reply
            or _sections_contain(sections, "“")
            or any('"' in str(s.get("body") or "") for s in sections)
        )
        if not has_quote:
            raise LifeCompanionValidationError("quote_request_missing_quote")

    if intent == "physical_action":
        reply = str(result.get("reply") or "").lower()
        action_words = ["stand", "walk", "drink", "breathe", "stretch", "put", "move", "sit", "close", "open", "write"]
        has_action = any(word in reply for word in action_words) or any(
            any(word in str(item).lower() for word in action_words)
            for section in sections
            for item in (section.get("items") or [])
        )
        if not has_action:
            raise LifeCompanionValidationError("physical_action_missing_action")

    if intent in {"empathy_eq", "relationship_understanding"}:
        reply = str(result.get("reply") or "").lower()
        empathy_words = ["empathy", "listen", "feeling", "emotion", "understanding", "understand", "empathize", "empathise"]
        has_empathy = (
            any(word in reply for word in empathy_words)
            or _sections_contain(sections, "listen")
            or _sections_contain(sections, "empathy")
            or _sections_contain(sections, "feeling")
            or _sections_contain(sections, "understand")
        )
        if not has_empathy:
            raise LifeCompanionValidationError(f"{intent}_missing_empathy_content")

    if intent in {"fitness_guidance", "body_growth", "gym_routine"}:
        has_training = _has_any_text(result, ["gym", "train", "training", "exercise", "workout", "muscle", "strength", "set", "rep"])
        has_recovery_or_food = _has_any_text(result, ["protein", "food", "eat", "meal", "recovery", "sleep"])
        if not has_training:
            raise LifeCompanionValidationError(f"{intent}_missing_training_content")
        if not has_recovery_or_food:
            raise LifeCompanionValidationError(f"{intent}_missing_food_recovery_content")

    if intent == "routine_plan":
        if not _has_any_text(result, ["morning", "evening", "routine", "block", "smaller"]):
            raise LifeCompanionValidationError("routine_plan_missing_structure")

    if intent == "anxiety_grounding":
        if not _has_any_text(result, ["breath", "feet", "floor", "ground", "body", "jaw", "shoulder"]):
            raise LifeCompanionValidationError("anxiety_grounding_missing_grounding")

    if intent == "correction_request":
        if _has_any_text(result, ["what is happening for you right now", "what has been occupying your thoughts"]):
            raise LifeCompanionValidationError("correction_request_generic_reflection")


def validate_book_recommendation_contract(result: dict, expected_intent: str | None = None) -> None:
    suggested_action = result.get("suggested_action") or {}
    action_type = suggested_action.get("type")
    if action_type == "loop":
        raise LifeCompanionValidationError("book_intent_loop_action")
    if action_type not in {"curator", "none"}:
        raise LifeCompanionValidationError("book_intent_invalid_action")

    if result.get("reply_format") != "book_recommendation":
        raise LifeCompanionValidationError("book_recommendation_invalid_format")

    sections = result.get("sections") or []
    if not sections:
        raise LifeCompanionValidationError("book_recommendation_missing_sections")

    section_titles = {
        str(section.get("title") or "").strip().lower()
        for section in sections
        if section.get("title")
    }
    required_titles = {"start here", "if you want deeper", "best first pick"}
    missing_titles = required_titles - section_titles
    if missing_titles:
        raise LifeCompanionValidationError("book_recommendation_missing_required_sections")

    item_count = 0
    item_section_count = 0
    for section in sections:
        items = section.get("items")
        if isinstance(items, list) and items:
            item_section_count += 1
            item_count += len(items)

    if item_section_count == 0:
        raise LifeCompanionValidationError("book_recommendation_missing_items")
    if item_count > 10:
        raise LifeCompanionValidationError("book_recommendation_too_many_items")

    text = _combined_response_text(result)
    known_books = [
        "siddhartha",
        "the alchemist",
        "the little prince",
        "sophie's world",
        "the stranger",
        "atomic habits",
        "deep work",
        "man's search for meaning",
        "the courage to be disliked",
        "think like a monk",
        "the midnight library",
        "norwegian wood",
    ]
    if not any(book in text for book in known_books):
        raise LifeCompanionValidationError("book_recommendation_missing_book_names")

    response_intent = result.get("intent")
    if expected_intent and response_intent and normalize_intent(response_intent) != normalize_intent(expected_intent):
        raise LifeCompanionValidationError("book_recommendation_intent_mismatch")


def _validate_request_satisfaction(result: dict, understanding: dict) -> None:
    route = str(understanding.get("route") or "")
    subject = str(understanding.get("subject") or "unknown")
    if route != "direct_answer":
        return
    action_type = (result.get("suggested_action") or {}).get("type", "none")
    reply = str(result.get("reply") or "")
    if action_type in {"loop", "reset"} and len(_significant_words(reply)) < 8:
        raise LifeCompanionValidationError(f"direct_answer_routing_only_{subject}")


def validate_life_companion_response(
    raw_text: str,
    expected_intent: str | None = None,
    user_message: str | None = None,
    understanding: dict | None = None,
) -> dict:
    payload = parse_life_companion_json(raw_text)
    if isinstance(payload.get("companion_response"), dict):
        payload = payload["companion_response"]

    reply = validate_life_companion_text(
        payload.get("reply"),
        field="reply",
        max_chars=1800,
    )
    if sentence_count(reply) > 14:
        raise LifeCompanionValidationError("too_many_sentences_reply")

    suggested_action = validate_life_companion_action(payload.get("suggested_action"))
    if suggested_action.get("type") == "reflection" and user_rejects_reflection(user_message):
        raise LifeCompanionValidationError("reflection_rejected_by_user")
    tone = str(payload.get("tone") or "").strip().lower()
    if tone not in COMPANION_TONES:
        raise LifeCompanionValidationError("invalid_tone")

    safety = payload.get("safety")
    if not isinstance(safety, dict):
        raise LifeCompanionValidationError("missing_safety")

    risk_level = str(safety.get("risk_level") or "").strip().lower()
    if risk_level not in COMPANION_RISK_LEVELS:
        raise LifeCompanionValidationError("invalid_risk_level")

    safety_message = safety.get("message")
    if safety_message is not None:
        safety_message = validate_life_companion_text(
            safety_message,
            field="safety_message",
            max_chars=260,
        )

    result = {
        "reply": ensure_terminal_punctuation(reply),
        "suggested_action": suggested_action,
        "tone": tone,
        "safety": {
            "risk_level": risk_level,
            "message": safety_message,
        },
    }

    raw_reply_format = payload.get("reply_format")
    if raw_reply_format is not None:
        fmt = str(raw_reply_format or "").strip().lower()
        if fmt in COMPANION_REPLY_FORMATS:
            result["reply_format"] = fmt
        else:
            raise LifeCompanionValidationError("invalid_reply_format")

    raw_sections = payload.get("sections")
    if raw_sections is not None:
        result["sections"] = validate_companion_sections(raw_sections)

    raw_intent = payload.get("intent")
    if raw_intent is not None:
        result["intent"] = normalize_intent(raw_intent)
    elif expected_intent:
        result["intent"] = normalize_intent(expected_intent)

    normalized_expected_intent = normalize_intent(expected_intent) if expected_intent else ""
    if normalized_expected_intent in BOOK_RECOMMENDATION_INTENTS or result.get("reply_format") == "book_recommendation":
        validate_book_recommendation_contract(result, normalized_expected_intent or None)

    _direct_output_intents = {
        "peaceful_knowledge_place_recommendation",
        "peaceful_place_recommendation",
        "study_gym_plan",
        "study_gym_routine",
        "quote_request",
        "physical_action",
        "empathy_eq",
        "relationship_understanding",
        "fitness_guidance",
        "body_growth",
        "gym_routine",
        "routine_plan",
        "anxiety_grounding",
        "correction_request",
        "task_help",
        "career_skill_guidance",
        "life_clarity",
        "spiritual_reflection",
        "general_question",
    }
    if normalized_expected_intent in _direct_output_intents:
        validate_direct_output_contract(result, normalized_expected_intent)

    if understanding:
        _validate_request_satisfaction(result, understanding)

    validate_no_source_leakage(result)

    return result


def validate_companion_response(
    response: dict,
    latest_message: str,
    emotional_state: str,
    refused_features: list,
    conversation_turn: int,
    intent: str,
) -> dict:
    """
    Validates the companion response before it reaches the frontend.

    Returns:
        {
            "valid": bool,
            "issues": list[str],
            "fallback": str | None
        }

    Callers must use fallback reply if valid is False and fallback is set.
    """
    issues = []
    message_lower = latest_message.lower().strip()
    reply = response.get("reply", "").strip()
    reply_lower = reply.lower()
    action_type = response.get("suggested_action", {}).get("type", "none")

    # ── CHECK 1: suggested_action suppression ─────────────────────
    if emotional_state in ("active_pain", "crisis") and action_type != "none":
        issues.append(
            f"BLOCK: suggested_action '{action_type}' fired during "
            f"{emotional_state}. Must be none."
        )

    if action_type in refused_features:
        issues.append(
            f"BLOCK: suggested_action '{action_type}' was refused by user. "
            "Must be none."
        )

    if conversation_turn <= 2 and action_type != "none":
        issues.append(
            "BLOCK: suggested_action set in first 2 turns. Must be none."
        )

    # ── CHECK 2: Reply quality ────────────────────────────────────
    BANNED_OPENERS = [
        "i understand how you feel",
        "that's totally valid",
        "tell me the exact question",
        "i'm here to help you",
        "as your ai companion",
        "here are some tips",
        "it's okay to feel",
        "great question",
    ]
    for phrase in BANNED_OPENERS:
        if reply_lower.startswith(phrase):
            issues.append(
                f"BLOCK: Reply opens with banned phrase: '{phrase}'"
            )

    if len(reply) < 30:
        issues.append("BLOCK: Reply is too short to be meaningful.")

    # ── CHECK 3: Breakup/rejection must address relational pain ───
    BREAKUP_TRIGGERS = [
        "breakup", "broke up", "rejected me", "rejection",
        "left me", "she left", "he left", "girlfriend rejected",
        "boyfriend rejected", "relationship ended", "heart is shaking",
        "can't hold the truth",
    ]
    is_breakup = any(t in message_lower for t in BREAKUP_TRIGGERS)

    if is_breakup and emotional_state == "active_pain":
        BREAKUP_MARKERS = [
            "rejection", "rejected", "left", "loss", "break", "heart",
            "relationship", "hurt", "pain", "heavy", "alone", "numb",
            "griev", "hold", "truth", "miss", "feel", "tonight",
        ]
        if not any(m in reply_lower for m in BREAKUP_MARKERS):
            issues.append(
                "BLOCK: Breakup/rejection message but reply does not address "
                "relational pain. Must regenerate."
            )

    # ── CHECK 4: Place recommendation must return places ─────────
    PLACE_TRIGGERS = [
        "peaceful places", "places in india", "where to go",
        "where can i visit", "places to visit", "good for peace",
        "calm place", "spiritual place",
    ]
    is_places = any(t in message_lower for t in PLACE_TRIGGERS)

    if is_places:
        PLACE_MARKERS = [
            "rishikesh", "dharamshala", "bodh gaya", "auroville",
            "coorg", "hampi", "kerala", "amritsar", "golden temple",
            "haridwar", "mcleod", "pondicherry", "backwaters",
        ]
        if not any(m in reply_lower for m in PLACE_MARKERS):
            issues.append(
                "BLOCK: User asked for peaceful places but reply contains "
                "no place names. Must regenerate."
            )

    # ── CHECK 5: No metadata leaks ────────────────────────────────
    LEAK_STRINGS = [
        ".pdf", ".md", "chunk", "source:", "document:",
        "retrieved from", "playbook", "knowledge base",
        "according to my database", "from the rag",
    ]
    for leak in LEAK_STRINGS:
        if leak in reply_lower:
            issues.append(f"BLOCK: Metadata leak detected: '{leak}'")

    # ── CHECK 6: Crisis must include helpline ─────────────────────
    CRISIS_TRIGGERS = [
        "want to die", "end my life", "kill myself",
        "self harm", "hurt myself", "don't want to exist",
    ]
    is_crisis_msg = any(t in message_lower for t in CRISIS_TRIGGERS)

    if is_crisis_msg:
        HELPLINE_MARKERS = [
            "9152987821", "1860", "112", "helpline",
            "icall", "vandrevala", "aasra",
        ]
        if not any(m in reply_lower for m in HELPLINE_MARKERS):
            issues.append(
                "BLOCK: Crisis message but reply contains no helpline resources."
            )

    # ── DETERMINE VALIDITY AND FALLBACK ──────────────────────────
    is_valid = not any(i.startswith("BLOCK") for i in issues)
    fallback = None

    if not is_valid:
        if is_crisis_msg or emotional_state == "crisis":
            fallback = (
                "What you've shared is serious and I'm fully here right now. "
                "Are you safe where you are?\n\n"
                "If you need to talk to someone immediately:\n"
                "iCall: 9152987821\n"
                "Vandrevala Foundation: 1860-2662-345 (24/7, free)\n"
                "Emergency: 112\n\n"
                "I'm not going anywhere. Talk to me."
            )
        elif is_breakup and emotional_state == "active_pain":
            fallback = (
                "What you're carrying right now is real and it's heavy. "
                "Rejection from someone you care about hits differently — "
                "it's not just losing a person, it's losing what you imagined together. "
                "You don't have to make sense of it tonight.\n\n"
                "Don't reach out to them right now. Don't open their profile. "
                "Just be somewhere quiet if you can.\n\n"
                "What would feel like the smallest relief right now, "
                "even just physically?"
            )
        elif is_places:
            fallback = (
                "Some genuinely peaceful places in India worth considering:\n\n"
                "• Rishikesh / Haridwar — river sound, forest trails, yoga energy\n"
                "• Dharamshala / McLeod Ganj — Tibetan stillness, mountain air\n"
                "• Bodh Gaya — deep meditative quiet, ancient ground\n"
                "• Golden Temple, Amritsar — sarovar at 4am, unconditional peace\n"
                "• Auroville / Pondicherry — intentional quiet, Matrimandir silence\n"
                "• Coorg, Karnataka — coffee mist, waterfalls, slow mornings\n"
                "• Hampi — ancient boulders, Tungabhadra river, perspective at scale\n"
                "• Kerala backwaters — slow water, coconut light, complete stillness\n\n"
                "Are you looking for somewhere nearby or open to traveling?"
            )
        else:
            fallback = (
                "I hear you. Take your time — "
                "I'm here and I'm not going anywhere."
            )

    return {
        "valid": is_valid,
        "issues": issues,
        "fallback": fallback,
    }


def normalize_title(value: str) -> str:
    return " ".join(str(value or "").lower().split())


def sanitize_detail_description(detail_description: str, fallback_action: str = "") -> str:
    normalized = str(detail_description or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    normalized = normalized.strip("\"").strip("'")

    action_match = re.match(r"^(.*?)(?:\n\s*\n)?Action:\s*(.+)$", normalized, re.S | re.I)
    if action_match:
        benefit_text = action_match.group(1)
        action_text = action_match.group(2)
    else:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", normalized) if part.strip()]
        benefit_text = paragraphs[0] if paragraphs else normalized
        action_text = paragraphs[1] if len(paragraphs) > 1 else ""

    benefit_text = limit_words(" ".join(benefit_text.split()), 15)
    action_text = limit_words(" ".join((action_text or fallback_action).split()), 12)

    if action_text.lower().startswith("action:"):
        action_text = action_text[7:].strip()

    if not benefit_text or not action_text:
        raise TaskValidationError("missing_detail_action")
    if len(action_text.split()) < 3:
        raise TaskValidationError("missing_detail_action")
    if has_pattern(action_text, VAGUE_ACTION_PATTERNS):
        raise TaskValidationError("vague_detail_action")

    benefit_text = ensure_terminal_punctuation(benefit_text)
    action_text = ensure_terminal_punctuation(action_text)
    return f"{benefit_text}\n\nAction: {action_text}"


def parse_duration(task: dict, context: dict | None = None) -> int:
    raw_duration = task.get("duration_minutes") or task.get("estimated_duration_mins") or 15
    try:
        duration = int(raw_duration)
    except (TypeError, ValueError) as exc:
        raise TaskValidationError("invalid_duration") from exc

    if duration > 60:
        raise TaskValidationError("overwhelming_duration")

    intensity = str((context or {}).get("suggested_intensity") or "").lower()
    if intensity in INTENSITY_DURATION_RANGES:
        min_duration, max_duration = INTENSITY_DURATION_RANGES[intensity]
        if duration < min_duration or duration > max_duration:
            raise TaskValidationError(f"duration_outside_{intensity}_range")

    return duration


def normalize_kotler_tag(value: object) -> str:
    raw = str(value or "").strip()
    normalized = KOTLER_TAG_LOOKUP.get(raw.lower())
    if not normalized:
        raise TaskValidationError("invalid_kotler_tag")
    return normalized


def sanitize_waar_action(value: object) -> str:
    action = " ".join(str(value or "").replace("\n", " ").split()).strip()
    if not action:
        raise TaskValidationError("missing_waar_action")
    if len(action.split()) < 4:
        raise TaskValidationError("missing_waar_action")
    if sentence_count(action) > 2:
        raise TaskValidationError("too_many_sentences_waar_action")
    if has_pattern(action, VAGUE_ACTION_PATTERNS):
        raise TaskValidationError("vague_waar_action")
    return limit_words(action, 36)


def sanitize_ikigai_purpose(value: object) -> str:
    purpose = " ".join(str(value or "").replace("\n", " ").split()).strip()
    if not purpose:
        raise TaskValidationError("missing_ikigai_purpose")
    if len(purpose.split()) < 6:
        raise TaskValidationError("missing_ikigai_purpose")
    if sentence_count(purpose) > 2:
        raise TaskValidationError("too_many_sentences_ikigai_purpose")
    return ensure_terminal_punctuation(limit_words(purpose, 44))


def validate_ai_tasks(raw_text: str, context: dict | None = None) -> list[dict]:
    payload = parse_model_json(raw_text)
    if not isinstance(payload, list):
        raise TaskValidationError("payload_not_list")

    recent_titles_to_avoid = {
        normalize_title(title)
        for title in (context or {}).get("recent_titles_to_avoid", [])
        if normalize_title(title)
    }

    recent_fingerprints = list((context or {}).get("recent_task_fingerprints") or [])
    recent_title_strings = [
        str(fp.get("title") or "") for fp in recent_fingerprints if fp.get("title")
    ]

    selected: dict[str, dict] = {}
    for item in payload:
        if not isinstance(item, dict):
            raise TaskValidationError("task_not_object")

        category = normalize_category(item.get("category"))
        if category not in CORE_CATEGORY_ORDER:
            raise TaskValidationError("invalid_category")
        if category in selected:
            continue

        combined_text = " ".join(str(value) for value in item.values() if value is not None)
        if has_pattern(combined_text, UNSAFE_PATTERNS):
            raise TaskValidationError("unsafe_content")
        if has_pattern(combined_text, OVERWHELMING_PATTERNS):
            raise TaskValidationError("overwhelming_content")
        if has_pattern(combined_text, GENERIC_SPAM_PATTERNS):
            raise TaskValidationError("generic_productivity_spam")

        title = str(item.get("title") or "").strip()
        if len(title) < 3:
            raise TaskValidationError("missing_title")
        if normalize_title(title) in recent_titles_to_avoid:
            raise TaskValidationError("repeated_recent_title")
        _OVERLAP_THRESHOLD = 0.70
        for _recent_t in recent_title_strings:
            if _word_overlap_ratio(title, _recent_t) >= _OVERLAP_THRESHOLD:
                raise TaskValidationError("similar_recent_title")

        action_source = item.get("waar_action") or item.get("action_step") or item.get("easier_version") or ""
        if isinstance(item.get("action_steps"), list):
            action_source = next(
                (str(step).strip() for step in item["action_steps"] if str(step).strip()),
                action_source,
            )

        detail_source = (
            item.get("detail_description")
            or item.get("ikigai_purpose")
            or item.get("why_this_helps")
            or item.get("why_chosen")
            or item.get("supportive_line")
            or ""
        )
        detail_description = sanitize_detail_description(
            str(detail_source or ""),
            str(action_source or ""),
        )

        duration_minutes = parse_duration(item, context)
        kotler_tag = normalize_kotler_tag(item.get("kotler_tag"))
        waar_action = sanitize_waar_action(item.get("waar_action"))
        ikigai_purpose = sanitize_ikigai_purpose(item.get("ikigai_purpose"))
        if not str(item.get("personalization_reason") or "").strip():
            print(
                f"AI_TASK_GENERATION missing_personalization_reason=true category={category}"
            )
        selected[category] = {
            **item,
            "category": category,
            "title": limit_words(title, 8),
            "kotler_tag": kotler_tag,
            "waar_action": waar_action,
            "ikigai_purpose": ikigai_purpose,
            "detail_description": detail_description,
            "duration_minutes": duration_minutes,
        }

    missing = [category for category in CORE_CATEGORY_ORDER if category not in selected]
    if missing:
        raise TaskValidationError(f"missing_categories:{','.join(missing)}")

    return [selected[category] for category in CORE_CATEGORY_ORDER]


def validate_weekly_mirror_synthesis(raw_text: str) -> dict:
    payload = parse_json_object(raw_text)
    if isinstance(payload.get("synthesis"), dict):
        payload = payload["synthesis"]
    elif isinstance(payload.get("mirror_insight"), dict):
        payload = payload["mirror_insight"]

    validated: dict[str, str] = {}
    for field in WEEKLY_MIRROR_FIELDS:
        value = payload.get(field)
        if not isinstance(value, str):
            raise WeeklyMirrorValidationError(f"missing_{field}")

        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise WeeklyMirrorValidationError(f"empty_{field}")
        if len(cleaned) > 280:
            raise WeeklyMirrorValidationError(f"too_long_{field}")
        if sentence_count(cleaned) > 2:
            raise WeeklyMirrorValidationError(f"too_many_sentences_{field}")
        if has_pattern(cleaned, WEEKLY_MIRROR_UNSAFE_PATTERNS):
            raise WeeklyMirrorValidationError(f"unsafe_{field}")

        validated[field] = ensure_terminal_punctuation(cleaned)

    validated["recommended_next_step"] = validate_recommended_next_step(
        payload.get("recommended_next_step"),
    )
    return validated


def clean_weekly_mirror_text(value: object, *, field: str, max_chars: int) -> str:
    if not isinstance(value, str):
        raise WeeklyMirrorValidationError(f"missing_{field}")

    cleaned = " ".join(value.strip().split())
    if not cleaned:
        raise WeeklyMirrorValidationError(f"empty_{field}")
    if len(cleaned) > max_chars:
        raise WeeklyMirrorValidationError(f"too_long_{field}")
    if sentence_count(cleaned) > 2:
        raise WeeklyMirrorValidationError(f"too_many_sentences_{field}")
    if has_pattern(cleaned, WEEKLY_MIRROR_UNSAFE_PATTERNS):
        raise WeeklyMirrorValidationError(f"unsafe_{field}")
    return cleaned


def validate_recommended_next_step(recommendation: object) -> dict:
    if not isinstance(recommendation, dict):
        raise WeeklyMirrorValidationError("missing_recommended_next_step")

    missing_fields = [
        field for field in RECOMMENDATION_FIELDS
        if field not in recommendation
    ]
    if missing_fields:
        raise WeeklyMirrorValidationError(
            f"missing_recommended_next_step_{','.join(missing_fields)}"
        )

    recommendation_type = str(recommendation.get("type") or "").strip().lower()
    if recommendation_type not in RECOMMENDATION_TYPES:
        raise WeeklyMirrorValidationError("invalid_recommended_next_step_type")

    title = clean_weekly_mirror_text(
        recommendation.get("title"),
        field="recommended_next_step_title",
        max_chars=80,
    )
    reason = clean_weekly_mirror_text(
        recommendation.get("reason"),
        field="recommended_next_step_reason",
        max_chars=260,
    )
    action_label = clean_weekly_mirror_text(
        recommendation.get("action_label"),
        field="recommended_next_step_action_label",
        max_chars=40,
    )

    if len(title.split()) > 10:
        raise WeeklyMirrorValidationError("too_many_words_recommended_next_step_title")
    if len(action_label.split()) > 6:
        raise WeeklyMirrorValidationError("too_many_words_recommended_next_step_action_label")
    if not has_pattern(reason, RECOMMENDATION_GROUNDING_PATTERNS):
        raise WeeklyMirrorValidationError("ungrounded_recommended_next_step_reason")

    return {
        "type": recommendation_type,
        "title": title,
        "reason": ensure_terminal_punctuation(reason),
        "action_label": action_label,
    }


def normalize_task_for_insert(
    task: dict,
    user_id: str,
    local_date: str,
    index: int,
    ai_generated: bool,
    generation_provider: str | None = None,
    generation_model: str | None = None,
    generation_prompt_version: str | None = None,
    generation_failure_reason: str | None = None,
) -> dict:
    category = normalize_category(task.get("category"))
    title = str(task.get("title") or f"Meaningful Task {index + 1}").strip()
    subtitle = str(task.get("subtitle") or f"{category.title()} Practice").strip()
    why_this_helps = str(
        task.get("why_this_helps")
        or task.get("ikigai_purpose")
        or task.get("why_chosen")
        or task.get("why")
        or ""
    ).strip()
    preferred_time = limit_words(
        str(task.get("preferred_time_of_day") or task.get("preferred_time") or "today").strip(),
        4,
    )
    supportive_line = limit_words(
        str(task.get("supportive_line") or task.get("inline_quote") or "").strip(),
        18,
    )
    difficulty_level = str(task.get("difficulty_level") or "").strip().lower()
    if difficulty_level not in {"gentle", "normal", "deeper"}:
        difficulty_level = None
    smaller_version = str(
        task.get("smaller_version")
        or task.get("easier_version")
        or ""
    ).strip()
    success_condition = limit_words(
        str(task.get("success_condition") or "").strip(),
        20,
    )
    post_completion_question = limit_words(
        str(
            task.get("post_completion_question")
            or "Was this too easy, right-sized, or too heavy?"
        ).strip(),
        14,
    )

    _valid_frameworks = {"ikigai", "morita", "logotherapy", "flow", "symbol"}
    _raw_framework = str(task.get("framework_key") or "").strip().lower()
    framework_key = _raw_framework if _raw_framework in _valid_frameworks else None
    _raw_kotler_tag = str(task.get("kotler_tag") or "").strip()
    kotler_tag = KOTLER_TAG_LOOKUP.get(_raw_kotler_tag.lower())

    return {
        "user_id": user_id,
        "for_date": local_date,
        "category": category,
        "title": title,
        "subtitle": subtitle,
        "why": why_this_helps,
        "detail_title": title,
        "detail_description": str(
            task.get("detail_description")
            or (
                f"{task.get('ikigai_purpose')}\n\nAction: {task.get('waar_action')}"
                if task.get("ikigai_purpose") and task.get("waar_action")
                else ""
            )
        ).strip(),
        "duration_minutes": int(task.get("duration_minutes") or 15),
        "preferred_time": preferred_time or "today",
        "inline_quote": supportive_line or None,
        "sort_order": index + 1,
        "ai_generated": ai_generated,
        "generation_provider": generation_provider,
        "generation_model": generation_model,
        "generation_prompt_version": generation_prompt_version,
        "generation_failure_reason": generation_failure_reason,
        "is_optional": False,
        "done": False,
        "completion_state": "pending",
        "difficulty_level": difficulty_level,
        "success_condition": success_condition or None,
        "smaller_version": smaller_version or None,
        "post_completion_question": post_completion_question or None,
        "framework_key": framework_key,
        "kotler_tag": kotler_tag,
    }
