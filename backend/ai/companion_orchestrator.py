"""
STEP 7 of the ReAct loop — the orchestrator feed.

After every companion turn, a signal row is upserted into companion_context
(one row per user per day) so the task agent and orchestrator know what the
user is carrying today. The write is fire-and-forget: it runs as a FastAPI
background task AFTER the response is sent, never blocks the user, and on
failure retries exactly once after 30 seconds. A second failure is logged
and dropped — the orchestrator degrades, the companion never does.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

ORCHESTRATOR_RETRY_DELAY_SECONDS = 30

_LOW_ENERGY_WORDS = [
    "tired", "exhausted", "drained", "heavy", "numb", "empty",
    "can't", "cant", "burnt out", "burned out", "no energy",
]
_HIGH_ENERGY_WORDS = [
    "excited", "energized", "motivated", "great", "amazing",
    "pumped", "ready", "hopeful",
]


def _energy_level(message: str, escalation_triggered: bool) -> str:
    if escalation_triggered:
        return "low"
    lowered = str(message or "").lower()
    if any(word in lowered for word in _LOW_ENERGY_WORDS):
        return "low"
    if any(word in lowered for word in _HIGH_ENERGY_WORDS):
        return "high"
    return "medium"


def build_orchestrator_payload(
    *,
    user_id: str,
    agent_turn=None,
    message: str = "",
    escalation_triggered: bool = False,
) -> dict:
    """Deterministic mapping from a companion turn to the orchestrator signal.
    Signals only — no message text, no journal content."""
    tool_results = getattr(agent_turn, "tool_results", None) or {}
    tools_called = getattr(agent_turn, "tools_called", None) or []
    pattern = tool_results.get("pattern_check") or {}
    tasks = tool_results.get("task_history") or {}

    primary_emotion = "distress" if escalation_triggered else None
    if primary_emotion is None and agent_turn is not None:
        for step in (getattr(agent_turn, "trace", {}) or {}).get("steps", []):
            if step.get("step") == "reason" and step.get("message_emotion"):
                primary_emotion = step["message_emotion"]
                break
    if primary_emotion is None:
        journal = tool_results.get("journal_search") or []
        primary_emotion = str(journal[0].get("emotion_signal")) if journal else "unspecified"

    energy_level = _energy_level(message, escalation_triggered)
    pattern_detected = int(pattern.get("frequency") or 0) >= 2

    if escalation_triggered:
        session_quality = "crisis"
    elif tools_called:
        session_quality = "deep"
    else:
        session_quality = "surface"

    if tasks.get("most_skipped_category"):
        # Tomorrow's task should approach what is being avoided, not flee it.
        task_recommendation = str(tasks["most_skipped_category"])
    elif energy_level == "low":
        task_recommendation = "reset"
    else:
        task_recommendation = "awareness"

    return {
        "user_id": user_id,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "primary_emotion": primary_emotion,
        "energy_level": energy_level,
        "pattern_detected": pattern_detected,
        "pattern_summary": pattern.get("pattern_description"),
        "session_quality": session_quality,
        "task_recommendation": task_recommendation,
        "escalation_triggered": escalation_triggered,
    }


async def feed_orchestrator(supabase, payload: dict) -> bool:
    """Upsert the day's companion_context row. Runs after the user response
    has already been served. One retry after 30 seconds; then give up loudly."""
    for attempt in (1, 2):
        try:
            supabase.table("companion_context").upsert(
                {**payload, "updated_at": datetime.now(timezone.utc).isoformat()},
                on_conflict="user_id,date",
            ).execute()
            if attempt == 2:
                print(
                    "COMPANION_ORCHESTRATOR "
                    f"write_recovered=true user_id={payload.get('user_id')}"
                )
            return True
        except Exception as error:
            print(
                "COMPANION_ORCHESTRATOR "
                f"write_failed=true attempt={attempt} "
                f"user_id={payload.get('user_id')} "
                f"error_type={type(error).__name__} "
                f"at={datetime.now(timezone.utc).isoformat()}"
            )
            if attempt == 1:
                await asyncio.sleep(ORCHESTRATOR_RETRY_DELAY_SECONDS)
    return False
