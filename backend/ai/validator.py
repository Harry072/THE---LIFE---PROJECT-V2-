import json
import re

from .context import CORE_CATEGORY_ORDER, normalize_category


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
    r"\bignore (all )?(previous|prior) instructions?\b",
    r"\boverride (the )?(system|developer|instructions?)\b",
    r"\breveal (your )?(prompt|system prompt|hidden instructions?)\b",
    r"\bshow (your )?(prompt|system prompt|hidden instructions?)\b",
    r"\bprint (your )?(prompt|system prompt|hidden instructions?)\b",
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

    try:
        payload = json.loads(cleaned.strip(), strict=False)
    except json.JSONDecodeError as exc:
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
    parts = [part for part in re.split(r"[.!?]+", str(text or "")) if part.strip()]
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

    label = validate_life_companion_text(
        action.get("label") or ("Not needed" if action_type == "none" else ""),
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


def validate_life_companion_response(raw_text: str) -> dict:
    payload = parse_life_companion_json(raw_text)
    if isinstance(payload.get("companion_response"), dict):
        payload = payload["companion_response"]

    reply = validate_life_companion_text(
        payload.get("reply"),
        field="reply",
        max_chars=1000,
    )
    if sentence_count(reply) > 8:
        raise LifeCompanionValidationError("too_many_sentences_reply")

    suggested_action = validate_life_companion_action(payload.get("suggested_action"))
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

    return {
        "reply": ensure_terminal_punctuation(reply),
        "suggested_action": suggested_action,
        "tone": tone,
        "safety": {
            "risk_level": risk_level,
            "message": safety_message,
        },
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


def validate_ai_tasks(raw_text: str, context: dict | None = None) -> list[dict]:
    payload = parse_model_json(raw_text)
    if not isinstance(payload, list):
        raise TaskValidationError("payload_not_list")

    recent_titles_to_avoid = {
        normalize_title(title)
        for title in (context or {}).get("recent_titles_to_avoid", [])
        if normalize_title(title)
    }

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

        action_source = item.get("action_step") or item.get("easier_version") or ""
        if isinstance(item.get("action_steps"), list):
            action_source = next(
                (str(step).strip() for step in item["action_steps"] if str(step).strip()),
                action_source,
            )

        detail_source = (
            item.get("detail_description")
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
        selected[category] = {
            **item,
            "category": category,
            "title": limit_words(title, 8),
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
) -> dict:
    category = normalize_category(task.get("category"))
    title = str(task.get("title") or f"Meaningful Task {index + 1}").strip()
    subtitle = str(task.get("subtitle") or f"{category.title()} Practice").strip()
    why_this_helps = str(
        task.get("why_this_helps")
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

    return {
        "user_id": user_id,
        "for_date": local_date,
        "category": category,
        "title": title,
        "subtitle": subtitle,
        "why": why_this_helps,
        "detail_title": title,
        "detail_description": str(task.get("detail_description") or "").strip(),
        "duration_minutes": int(task.get("duration_minutes") or 15),
        "preferred_time": preferred_time or "today",
        "inline_quote": supportive_line or None,
        "sort_order": index + 1,
        "ai_generated": ai_generated,
        "is_optional": False,
        "done": False,
    }
