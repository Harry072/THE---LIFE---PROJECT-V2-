from __future__ import annotations

import math
import re
from functools import lru_cache
from pathlib import Path


PDF_FILE_NAME = "The_Life_Companion_RAG_Knowledge_Base.pdf"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _pdf_path() -> Path:
    return _repo_root() / PDF_FILE_NAME


def _extract_pdf_text(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    try:
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""


def _clean_line(value: str) -> str:
    cleaned = str(value or "").replace("\u00a0", " ").replace("\u2022", " ").strip()
    return " ".join(cleaned.split())


def _section_number(value: str) -> str:
    compact = re.sub(r"\s+", "", str(value or "").upper())
    if re.fullmatch(r"(?:\d+|A)\.\d+", compact):
        return compact
    return ""


def _is_noise_line(value: str) -> bool:
    line = _clean_line(value)
    if not line:
        return True
    if _section_number(line):
        return False
    if re.fullmatch(r"[\-\u2013\u2014]*", line):
        return True
    if re.fullmatch(r"\d+\.", line):
        return True
    if line in {".", "*"}:
        return True
    if line.startswith("The Life Project ") and "Companion RAG Knowledge Base" in line:
        return True
    if re.fullmatch(r"(?:[A-Z]\s){3,}[A-Z]", line):
        return True
    return False


def _looks_like_title(value: str) -> bool:
    line = _clean_line(value)
    if not line or len(line) > 110:
        return False
    lower = line.lower()
    if lower.startswith(("user signal", "what the user", "response approach", "the ", "step ")):
        return False
    if line.startswith(('"', "'")):
        return False
    if re.search(r"[.!?]$", line):
        return False
    return bool(re.search(r"[A-Za-z]", line))


def _normalize_body(lines: list[str]) -> str:
    cleaned = [_clean_line(line) for line in lines if not _is_noise_line(line)]
    return " ".join(cleaned)


def _split_title_and_body(section_number: str, lines: list[str]) -> tuple[str, str]:
    useful = [_clean_line(line) for line in lines if not _is_noise_line(line)]
    title = ""
    title_index = -1
    for index, line in enumerate(useful[:12]):
        if _looks_like_title(line):
            title = line
            title_index = index
            break

    if not title:
        title = f"Section {section_number}"
        title_index = -1

    body_lines = useful[title_index + 1 :] if title_index >= 0 else useful
    body = _normalize_body(body_lines)
    return title[:120], body


def _tokens(value: str) -> list[str]:
    normalized = str(value or "").lower().replace("'", "")
    return re.findall(r"[a-z0-9]+", normalized)


def build_sparse_embedding(value: str) -> dict[str, float]:
    counts: dict[str, float] = {}
    for token in _tokens(value):
        if len(token) < 3:
            continue
        counts[token] = counts.get(token, 0.0) + 1.0
    norm = math.sqrt(sum(weight * weight for weight in counts.values())) or 1.0
    return {token: weight / norm for token, weight in counts.items()}


def sparse_cosine(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    smaller, larger = (left, right) if len(left) <= len(right) else (right, left)
    return sum(weight * larger.get(token, 0.0) for token, weight in smaller.items())


TAG_KEYWORDS = {
    "breakup": ["breakup", "heartbreak", "broke up", "girlfriend", "boyfriend", "ex", "miss them"],
    "relationship": ["relationship", "friendship", "family", "parents", "trust", "conflict"],
    "loneliness": ["lonely", "alone", "isolation", "invisible"],
    "anxiety": ["anxiety", "panic", "anxious", "overwhelm", "stress", "spiral"],
    "study": ["study", "exam", "academic", "boards", "jee", "neet", "focus"],
    "career": ["career", "wrong path", "job", "validation"],
    "routine": ["routine", "sleep", "digital habits", "phone", "procrastination"],
    "fitness": ["fitness", "physical health", "gym"],
    "meditation": ["meditation", "mindfulness", "peace", "calm"],
    "books": ["book", "resource", "recommendation", "reading"],
    "app_routing": ["routing", "suggested_action", "feature", "loop", "reflection", "reset", "curator"],
    "india": ["india", "indian", "parents", "jee", "neet", "marriage", "rishikesh", "dharamshala"],
    "places": ["places", "rishikesh", "dharamshala", "bodh gaya", "coorg", "hampi", "auroville"],
    "crisis": ["crisis", "self-harm", "suicidal", "helpline", "emergency", "safe"],
    "memory": ["multi-turn", "context", "previous", "conversation"],
    "core_rules": ["latest message", "answer first", "one follow-up", "behavioral laws"],
}


def _infer_tags(title: str, body: str, section_number: str) -> list[str]:
    haystack = f"{title} {body}".lower()
    tags = {
        tag
        for tag, keywords in TAG_KEYWORDS.items()
        if any(keyword in haystack for keyword in keywords)
    }
    if section_number.startswith("9."):
        tags.add("india")
    if section_number.startswith("10."):
        tags.add("crisis")
    if section_number.startswith("8."):
        tags.add("app_routing")
    if section_number.startswith("7."):
        tags.add("conversation")
    return sorted(tags)


def _playbook_type(section_number: str, title: str) -> str:
    lower_title = title.lower()
    if section_number.startswith("10."):
        return "safety_protocol"
    if section_number.startswith("9."):
        return "indian_context"
    if section_number.startswith("8."):
        return "app_routing"
    if section_number.startswith("7."):
        return "conversation_flow"
    if section_number.startswith("6."):
        return "practical_guidance"
    if section_number.startswith("5."):
        return "academic_career_pressure"
    if section_number.startswith("4."):
        return "emotional_support"
    if section_number.startswith(("1.", "2.", "3.")):
        return "core_behavior_rule"
    if "quality" in lower_title:
        return "quality_gate"
    return "general_guidance"


def _priority(section_number: str, title: str) -> int:
    lower_title = title.lower()
    if section_number.startswith("10."):
        return 10
    if any(word in lower_title for word in ["law", "routing", "suggested_action", "crisis"]):
        return 9
    if section_number.startswith(("4.", "5.", "9.")):
        return 8
    if section_number.startswith(("6.", "7.", "8.")):
        return 7
    return 6


def _safety_level(section_number: str, title: str, body: str) -> str:
    haystack = f"{title} {body}".lower()
    if section_number.startswith("10.") or any(word in haystack for word in ["self-harm", "suicidal", "emergency"]):
        return "crisis"
    if any(word in haystack for word in ["depression", "grief", "abuse", "violence"]):
        return "high"
    if any(word in haystack for word in ["anxiety", "panic", "breakup", "financial stress"]):
        return "medium"
    return "standard"


def _chunk_id(section_number: str, title: str) -> str:
    slug = "_".join(_tokens(title)[:8]) or "section"
    return f"pdf_life_companion_{section_number.replace('.', '_')}_{slug}"


def parse_pdf_sections(text: str) -> list[dict]:
    lines = [_clean_line(line) for line in str(text or "").splitlines()]
    sections: list[dict] = []
    current_number = ""
    current_lines: list[str] = []

    def flush() -> None:
        if not current_number:
            return
        title, body = _split_title_and_body(current_number, current_lines)
        if len(body) < 80:
            return
        tags = _infer_tags(title, body, current_number)
        content = body[:1600]
        sections.append(
            {
                "id": _chunk_id(current_number, title),
                "section_title": title,
                "title": title,
                "playbook_type": _playbook_type(current_number, title),
                "tags": tags,
                "priority": _priority(current_number, title),
                "safety_level": _safety_level(current_number, title, body),
                "guidance": content[:360],
                "when_to_use": "Use when the latest message matches this internal guidance section.",
                "safe_app_route": None,
                "content": content,
                "_embedding": build_sparse_embedding(f"{title} {' '.join(tags)} {body}"),
            }
        )

    for line in lines:
        section_number = _section_number(line)
        if section_number:
            flush()
            current_number = section_number
            current_lines = []
            continue
        if current_number:
            current_lines.append(line)
    flush()
    return sections


@lru_cache(maxsize=1)
def load_companion_pdf_chunks() -> tuple[dict, ...]:
    text = _extract_pdf_text(_pdf_path())
    if not text:
        return ()
    return tuple(parse_pdf_sections(text))
