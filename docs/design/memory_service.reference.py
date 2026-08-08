# NOT LIVE CODE.
# Reference schema for future cross-session companion memory.
# Do not import. Kept for its detected_patterns / past_sessions
# shape, which the live single-turn memory path does not have.

from copy import deepcopy


async def load(user_id: str) -> dict:
    """
    Phase 1 memory loader.

    Long-term memory is intentionally empty for now. In phase 2 this function
    becomes the boundary where Supabase/PostgreSQL session summaries are loaded.
    """
    return {
        "user_id": user_id,
        "total_sessions": 0,
        "detected_patterns": [],
        "known_context": {},
        "past_sessions": [],
    }


def build_context(user_memory: dict) -> str:
    safe_memory = deepcopy(user_memory or {})
    past_sessions = safe_memory.get("past_sessions") or []
    if not past_sessions:
        return "This is the user's first session. No past history yet."

    patterns = safe_memory.get("detected_patterns") or []
    known = safe_memory.get("known_context") or {}
    sessions = past_sessions[-5:]

    known_lines = (
        "\n".join(f"- {key}: {value}" for key, value in known.items())
        if known
        else "- Still learning"
    )
    pattern_lines = (
        "\n".join(f"- {pattern}" for pattern in patterns)
        if patterns
        else "- Still detecting; not enough sessions yet"
    )
    session_lines = "\n".join(
        (
            f"Session {index + 1} | {session.get('date', 'unknown date')}\n"
            f"Emotion: {session.get('primary_emotion', 'unknown')} | "
            f"Topic: {session.get('main_topic', 'unknown')}\n"
            f"Key insight: {session.get('key_insight', 'none')}\n"
            f"Pattern signal: {session.get('pattern_signal', 'none')}"
        )
        for index, session in enumerate(sessions)
    )

    return f"""
USER MEMORY PROFILE
-------------------
Total sessions with this user: {safe_memory.get("total_sessions", len(past_sessions))}

What you know about them:
{known_lines}

Detected patterns across sessions:
{pattern_lines}

RECENT SESSION HISTORY (last {len(sessions)} sessions):
{session_lines}

IMPORTANT: Reference this history naturally when relevant.
Do not dump it on the user. Use it to deepen your understanding.
If you see the same pattern appearing again, name it directly.
""".strip()
