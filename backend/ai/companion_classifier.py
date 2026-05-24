"""
Stage 1 of the reasoning pipeline: intent classification.

Maps the result of the existing understanding pass (run_understanding_pass) to
the richer UserIntent model without making a second LLM call.  The model
captures everything the prompt-building stage needs: what kind of conversation
this is, what the user needs emotionally, how urgent it feels, and a one-line
approach note that gets injected into the reasoning guide.
"""

from typing import Literal

from pydantic import BaseModel


# ── UserIntent model ─────────────────────────────────────────────────────────

class UserIntent(BaseModel):
    intent: Literal[
        "emotional_support",
        "life_planning",
        "philosophical",
        "daily_checkin",
        "crisis",
        "practical",
        "casual_chat",
        "venting",
        "celebration",
    ]
    emotional_tone: Literal[
        "distressed",
        "anxious",
        "sad",
        "confused",
        "neutral",
        "curious",
        "motivated",
        "happy",
        "frustrated",
        "overwhelmed",
    ]
    urgency: Literal["low", "medium", "high", "crisis"]
    needs: Literal[
        "validation",
        "advice",
        "plan",
        "perspective",
        "information",
        "presence",
        "celebration",
    ]
    is_vague: bool
    suggested_approach: str


# ── Mapping tables ────────────────────────────────────────────────────────────

_EMOTIONAL_STATE_TO_TONE: dict[str, str] = {
    "crisis":      "distressed",
    "active_pain": "overwhelmed",
    "moderate":    "sad",
    "mild":        "anxious",
    "none":        "neutral",
}

_EMOTIONAL_STATE_TO_URGENCY: dict[str, str] = {
    "crisis":      "crisis",
    "active_pain": "high",
    "moderate":    "medium",
    "mild":        "low",
    "none":        "low",
}

# Maps the existing understanding-pass intent values to the 9 companion intents.
_RAW_INTENT_TO_COMPANION_INTENT: dict[str, str] = {
    "safety_path":         "crisis",
    "ground_first":        "emotional_support",
    "receive_and_reflect": "venting",
    "solve_directly":      "practical",
    "recommend_list":      "practical",
    "factual_question":    "practical",
    "conversational":      "casual_chat",
    "app_help":            "practical",
}

_COMPANION_INTENT_TO_NEEDS: dict[str, str] = {
    "crisis":           "presence",
    "venting":          "validation",
    "emotional_support":"validation",
    "practical":        "advice",
    "life_planning":    "plan",
    "philosophical":    "perspective",
    "daily_checkin":    "advice",
    "casual_chat":      "presence",
    "celebration":      "celebration",
}

_COMPANION_INTENT_TO_APPROACH: dict[str, str] = {
    "crisis":           "Stay present, provide safety resources, never route to any feature",
    "venting":          "Lead with empathy and full validation before any advice",
    "emotional_support":"Acknowledge first, then offer one small stabilising step",
    "practical":        "Be direct and structured; answer concretely without preamble",
    "life_planning":    "Break the goal into clear steps with concrete timeframes",
    "philosophical":    "Go deep, offer multiple perspectives, sit with complexity",
    "daily_checkin":    "Be warm and specific; notice patterns from memory context",
    "casual_chat":      "Match their energy; be natural and brief",
    "celebration":      "Be genuinely happy with them; celebrate the specific win",
}

# These subject values from the understanding pass hint at philosophical intent.
_PHILOSOPHICAL_SUBJECTS = {"purpose", "meaning", "spiritual", "general"}

# Short or near-empty messages are vague.
_VAGUE_TOKENS = {"...", "idk", "help", "hi", "hey", "hello", "ok", "okay", "hmm", "?"}


# ── Public API ────────────────────────────────────────────────────────────────

def map_from_classification(
    classification: dict,
    user_message: str = "",
) -> UserIntent:
    """
    Map the existing understanding-pass classification dict to a UserIntent.

    This reuses the result already produced by run_understanding_pass() so no
    extra LLM call is needed.  Emotional state always takes precedence over
    intent for safety routing.
    """
    emotional_state = str(classification.get("emotional_state") or "none").strip()
    raw_intent      = str(classification.get("intent") or "solve_directly").strip()
    subject         = str(classification.get("subject") or "unknown").strip()
    user_goal       = str(classification.get("user_goal") or "").strip().lower()

    # ── Determine companion intent ──
    companion_intent = _RAW_INTENT_TO_COMPANION_INTENT.get(raw_intent, "practical")

    # Emotional-state overrides
    if emotional_state == "crisis":
        companion_intent = "crisis"
    elif emotional_state == "active_pain" and companion_intent not in {
        "crisis", "venting", "emotional_support"
    }:
        companion_intent = "emotional_support"

    # Subject-based refinements (only when state is calm)
    if emotional_state in {"none", "mild"} and companion_intent == "practical":
        if subject in _PHILOSOPHICAL_SUBJECTS or "meaning" in user_goal or "purpose" in user_goal:
            companion_intent = "philosophical"
        elif "plan" in user_goal or "routine" in user_goal or "goal" in user_goal:
            companion_intent = "life_planning"
        elif "celebrate" in user_goal or "promoted" in user_goal or "achieved" in user_goal:
            companion_intent = "celebration"

    # ── Derive the other fields ──
    emotional_tone    = _EMOTIONAL_STATE_TO_TONE.get(emotional_state, "neutral")
    urgency           = _EMOTIONAL_STATE_TO_URGENCY.get(emotional_state, "low")
    needs             = _COMPANION_INTENT_TO_NEEDS.get(companion_intent, "advice")
    suggested_approach = _COMPANION_INTENT_TO_APPROACH.get(
        companion_intent, "Be helpful and direct"
    )

    # ── Vagueness check ──
    msg = str(user_message or "").strip()
    is_vague = (
        len(msg) < 20
        or msg.lower() in _VAGUE_TOKENS
        or msg in {"...", "???"}
    )

    return UserIntent(
        intent=companion_intent,
        emotional_tone=emotional_tone,
        urgency=urgency,
        needs=needs,
        is_vague=is_vague,
        suggested_approach=suggested_approach,
    )
