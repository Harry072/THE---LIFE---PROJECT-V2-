import json
import re

from .context import CORE_CATEGORY_ORDER, normalize_category


class TaskValidationError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


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


def limit_words(text: str, max_words: int) -> str:
    words = str(text or "").split()
    return " ".join(words[:max_words]).strip()


def ensure_terminal_punctuation(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned:
        return cleaned
    return cleaned if cleaned[-1] in ".!?" else f"{cleaned}."


def has_pattern(text: str, patterns: list[str]) -> bool:
    lowered = str(text or "").lower()
    return any(re.search(pattern, lowered, re.I) for pattern in patterns)


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
