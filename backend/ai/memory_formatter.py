"""
Stage 2 (context gathering) — memory injection protocol.

Transforms the safe_memory_summary dict (produced by
build_companion_safe_memory_summary in ai/context.py) into a structured,
readable block that the model can use naturally.

The existing gateway was calling _safe_memory.get("summary") which always
returned an empty string because the key does not exist.  This module fixes
that by reading the real keys of the dict.
"""

from __future__ import annotations


def _bullet(label: str, value: object) -> str | None:
    """Return a formatted bullet line, or None when value is empty."""
    if not value:
        return None
    if isinstance(value, list):
        joined = ", ".join(str(v) for v in value if v)
        if not joined:
            return None
        return f"- {label}: {joined}"
    text = str(value).strip()
    if not text or text in {"not provided", "not enough weekly signal", "none"}:
        return None
    return f"- {label}: {text}"


def format_memory_for_prompt(
    safe_memory_summary: dict | str,
    user_intent: str = "",
) -> str:
    """
    Convert safe_memory_summary into a structured memory block for the prompt.

    Accepts either the raw dict from build_companion_safe_memory_summary() or
    a plain string (legacy path).  Returns a formatted string with instructions
    on how the model should use the context.
    """
    # ── Legacy string path ────────────────────────────────────────────────────
    if isinstance(safe_memory_summary, str):
        text = safe_memory_summary.strip()
        if not text:
            return _no_history_block()
        return _wrap_memory_block(text)

    # ── Dict path (normal case) ───────────────────────────────────────────────
    mem = safe_memory_summary or {}

    lines: list[str] = []

    lines.append(_bullet(
        "Current topic",
        mem.get("current_topic"),
    ))
    lines.append(_bullet(
        "Recent intents",
        mem.get("last_user_intents"),
    ))
    lines.append(_bullet(
        "What they said last",
        mem.get("previous_user_summary"),
    ))
    lines.append(_bullet(
        "Previous request",
        mem.get("previous_user_request"),
    ))
    lines.append(_bullet(
        "Core struggles",
        mem.get("onboarding_need"),
    ))
    lines.append(_bullet(
        "Task pattern",
        mem.get("task_pattern"),
    ))
    lines.append(_bullet(
        "Mood pattern",
        mem.get("mood_pattern"),
    ))
    lines.append(_bullet(
        "Weekly focus",
        mem.get("weekly_focus"),
    ))
    lines.append(_bullet(
        "Streak",
        mem.get("streak_band"),
    ))
    lines.append(_bullet(
        "Support style that works",
        mem.get("support_style"),
    ))

    curator = mem.get("curator_interest") or {}
    if curator.get("recent_path_slugs") or curator.get("recent_book_ids"):
        paths = curator.get("recent_path_slugs") or []
        books = curator.get("recent_book_ids") or []
        parts: list[str] = []
        if paths:
            parts.append(f"paths: {', '.join(str(p) for p in paths[:3])}")
        if books:
            parts.append(f"books: {', '.join(str(b) for b in books[:3])}")
        lines.append(f"- Explored content: {'; '.join(parts)}")

    avoid = mem.get("avoid") or []
    if avoid:
        lines.append(_bullet("Avoid in this reply", avoid))

    content_lines = [l for l in lines if l]

    if not content_lines:
        return _no_history_block()

    body = "\n".join(content_lines)
    return _wrap_memory_block(body)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _no_history_block() -> str:
    return (
        "[User Context]\n"
        "Limited history available for this user. Be warm and curious. "
        "Ask about their life naturally within your response. "
        "Do not mention that you have limited history."
    )


def _wrap_memory_block(body: str) -> str:
    return (
        "[User Context from Past Conversations]\n"
        "The following is what you know about this user. "
        "Use it the way a friend who remembers would — weave it in naturally, "
        "never announce you are referencing past data.\n\n"
        + body
        + "\n\n"
        "[How to use this context]\n"
        "- Reference specific details when relevant to what they are saying now\n"
        "- Notice patterns (stuck in a loop? making progress?) and name them gently\n"
        "- Connect today's conversation to their ongoing journey\n"
        "- NEVER say 'based on our previous conversations' or 'I remember you said'"
    )
