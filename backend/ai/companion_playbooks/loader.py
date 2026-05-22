from __future__ import annotations
import pathlib
import re

_PLAYBOOK_DIR = pathlib.Path(__file__).parent

# Filename → tags. Tags must match RAG_GATE_RULES and INTENT_RAG_TAGS keys in companion_knowledge.py.
PLAYBOOK_TAG_MAP: dict[str, list[str]] = {
    "anxiety_grounding.md": ["anxiety", "grounding", "breathing", "panic"],
    "breakup_heartbreak.md": [
        "breakup", "heartbreak", "emotional_support", "grief",
        "rejection", "loneliness", "numbness",
    ],
    "career_clarity.md": ["career_skill_guidance", "practical", "study", "motivation"],
    "crisis_support.md": ["crisis", "safety", "emergency", "mental_health"],
    "daily_routine.md": ["habits", "routine", "study", "fitness", "motivation", "practical"],
    "emotional_support.md": [
        "emotional_support", "validation", "empathy", "grief", "loneliness", "numbness",
    ],
    "fitness_wellbeing.md": ["fitness", "habits", "routine", "motivation"],
    "india_places.md": ["places", "india", "travel", "peaceful", "meditation"],
    "life_clarity.md": ["motivation", "philosophy", "small_step", "practical"],
    "philosophy_books.md": ["books", "philosophy", "self_growth"],
    "sleep_recovery.md": ["sleep", "stress", "habits", "routine"],
    "spiritual_grounding.md": ["spiritual_reflection", "grounding", "meditation", "anxiety"],
}

_CHUNK_INDEX: list[dict] = []
_INDEX_BUILT = False


def _split_into_chunks(text: str, size: int = 400, overlap: int = 60) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(start + size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start = end - overlap
    return chunks


def build_chunk_index() -> None:
    global _CHUNK_INDEX, _INDEX_BUILT
    _CHUNK_INDEX = []
    chunk_id = 0
    files_loaded = 0
    for filename, tags in PLAYBOOK_TAG_MAP.items():
        filepath = _PLAYBOOK_DIR / filename
        if not filepath.exists():
            print(f"PLAYBOOK_LOADER file_missing={filename}")
            continue
        try:
            text = filepath.read_text(encoding="utf-8")
        except Exception as exc:
            print(f"PLAYBOOK_LOADER file_read_error={filename} error={type(exc).__name__}")
            continue
        for chunk_text in _split_into_chunks(text):
            _CHUNK_INDEX.append({
                "chunk_id": chunk_id,
                "tags": tags,
                "content": chunk_text,
            })
            chunk_id += 1
        files_loaded += 1
    _INDEX_BUILT = True
    print(
        f"PLAYBOOK_LOADER index_built=true "
        f"total_chunks={len(_CHUNK_INDEX)} "
        f"files_loaded={files_loaded}"
    )


def retrieve_playbook_chunks(
    query: str,
    filter_tags: list[str] | None = None,
    top_k: int = 4,
) -> str:
    if not _CHUNK_INDEX:
        return ""
    query_words = set(re.findall(r"\w+", query.lower()))

    def score(chunk: dict) -> float:
        chunk_words = set(
            re.sub(r"[^\w\s]", "", chunk["content"].lower()).split()
        )
        word_score = len(query_words & chunk_words)
        tag_boost = 0
        if filter_tags:
            tag_boost = len(set(chunk["tags"]) & set(filter_tags)) * 8
        return word_score + tag_boost

    scored: list[tuple[float, dict]] = []
    for chunk in _CHUNK_INDEX:
        if filter_tags and not any(tag in chunk["tags"] for tag in filter_tags):
            continue
        chunk_score = score(chunk)
        if chunk_score > 0:
            scored.append((chunk_score, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]
    if not top:
        return ""
    return "\n\n".join(item["content"] for _, item in top)


def get_index_stats() -> dict:
    return {
        "index_built": _INDEX_BUILT,
        "total_chunks": len(_CHUNK_INDEX),
        "files_loaded": sum(
            1 for f in PLAYBOOK_TAG_MAP if (_PLAYBOOK_DIR / f).exists()
        ),
    }
