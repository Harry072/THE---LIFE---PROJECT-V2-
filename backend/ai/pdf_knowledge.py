"""
Stage 2 (context gathering) — selective PDF / playbook knowledge routing.

Maps the companion intent (from companion_classifier.UserIntent) to the
knowledge tag categories that are relevant, then filters the retrieved chunks
so only the most relevant wisdom is injected into the prompt.

This prevents dumping all knowledge into every prompt regardless of what the
user actually needs.
"""

from __future__ import annotations


# Map each companion intent to the knowledge tags that are relevant for it.
# An empty list means: skip knowledge injection entirely.
INTENT_TO_KNOWLEDGE_TAGS: dict[str, list[str]] = {
    "emotional_support": [
        "emotional_support", "validation", "empathy",
        "breakup", "grief", "loneliness", "numbness", "heartbreak",
    ],
    "venting": [
        "emotional_support", "validation", "empathy",
        "anxiety", "grounding",
    ],
    "life_planning": [
        "habits", "routine", "motivation", "practical",
        "study", "productivity",
    ],
    "philosophical": [
        "philosophy", "meaning", "purpose", "books",
        "stoicism", "mindfulness",
    ],
    "crisis": [
        "crisis", "safety", "emergency", "mental_health",
    ],
    "practical": [
        "practical", "habits", "fitness", "study",
        "routine", "productivity", "sleep",
    ],
    "daily_checkin": [
        "motivation", "habits", "routine", "mindfulness",
    ],
    "celebration": [
        "motivation", "habits",
    ],
    "casual_chat": [],  # No knowledge injection — keep it conversational
}


def get_relevant_knowledge(
    user_intent: str,
    knowledge_chunks: list[dict],
    max_chunks: int = 3,
) -> str:
    """
    Filter knowledge chunks by the tags relevant to this companion intent.

    Returns a formatted string for prompt injection, or an empty string when
    no chunks match or the intent does not need knowledge injection.

    Each chunk is expected to be a dict from retrieve_companion_knowledge() or
    retrieve_playbook_chunks(), carrying at minimum a 'tags' list and either
    a 'guidance' or 'content' key.
    """
    relevant_tags = INTENT_TO_KNOWLEDGE_TAGS.get(user_intent, [])

    if not relevant_tags:
        return ""

    relevant: list[dict] = []
    seen_ids: set[str] = set()

    for chunk in (knowledge_chunks or []):
        if not isinstance(chunk, dict):
            continue

        chunk_id = str(chunk.get("id") or chunk.get("section_title") or id(chunk))
        if chunk_id in seen_ids:
            continue

        chunk_tags = [str(t).lower() for t in (chunk.get("tags") or []) if t]
        if any(tag in chunk_tags for tag in relevant_tags):
            relevant.append(chunk)
            seen_ids.add(chunk_id)

        if len(relevant) >= max_chunks:
            break

    if not relevant:
        return ""

    lines: list[str] = []
    for chunk in relevant:
        text = (
            str(chunk.get("guidance") or "").strip()
            or str(chunk.get("content") or "").strip()
        )
        if text:
            lines.append(text)

    if not lines:
        return ""

    body = "\n\n".join(lines)
    return (
        "[Relevant Wisdom — draw from this naturally; never cite sources or file names]\n"
        + body
    )
