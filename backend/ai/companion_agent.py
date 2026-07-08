"""
The Companion Expert Agent's ReAct loop.

Every user message runs through this loop. Reasoning is code-planned
(deterministic, fully traceable, one provider call per message):

  STEP 1  SECURITY  distress scan on raw input -> escalation short-circuit;
                    injection scan -> sanitize and continue
  STEP 2  PERCEIVE  classify the message
  STEP 3  REASON    choose tools + response mode; produce the trace
  STEP 4  ACT       call only the tools chosen in REASON
  STEP 5  OBSERVE   let tool results revise the plan (downgrades only)
  STEP 6  RESPOND   emit the directive block the provider call will use
                    (guardrail post-checks live in companion_guardrails)

The trace is a plain dict, logged as COMPANION_TRACE, and contains signals
and counts only — never journal text, never message content.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .companion_security import (
    RateLimitStatus,
    sanitize_untrusted_text,
    wrap_retrieved,
)
from .companion_tools import (
    EMOTION_LEXICON,
    escalation_trigger,
    journal_search,
    pattern_check,
    task_history,
)


# ── STEP 1: distress signals (Guardrail 3 — absolute, no context judgment) ───
# Tiered by severity. Checked hardest-first; ANY hit routes to escalation
# before the loop runs. Extends the existing crisis vocabulary — never reduces.

DISTRESS_SIGNALS: dict[str, list[str]] = {
    "crisis": [
        r"\bwant to die\b", r"\bkill myself\b", r"\bsuicid(e|al)\b",
        r"\bend my life\b", r"\bself[-\s]?harm\b", r"\bhurt myself\b",
        r"\bdon'?t want to exist\b", r"\bend it\b", r"\bno point living\b",
        r"\bno reason to live\b", r"\bwant it to stop permanently\b",
    ],
    "self_harm_adjacent": [
        r"\bwant to disappear\b", r"\bdon'?t want to be here\b",
        r"\bbetter off without me\b",
    ],
    "persistent_distress": [
        r"\bgive up\b", r"\bcan'?t go on\b", r"\bnothing matters\b",
        r"\bhopeless\b", r"\bno point\b", r"\bcan'?t do this anymore\b",
        r"\bwhat'?s the point of anything\b",
    ],
}

_COMPILED_DISTRESS = {
    tier: [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
    for tier, patterns in DISTRESS_SIGNALS.items()
}


def detect_distress(message: str) -> str | None:
    """Returns the severity tier, or None. Hardest tier wins. Absolute —
    there is deliberately no 'but the context seems okay' logic here."""
    text = str(message or "")
    for tier in ("crisis", "self_harm_adjacent", "persistent_distress"):
        if any(pattern.search(text) for pattern in _COMPILED_DISTRESS[tier]):
            return tier
    return None


# ── STEP 2: perceive ─────────────────────────────────────────────────────────

CLASSIFICATIONS = (
    "distress", "pattern_question", "progress_question",
    "journal_reference", "practical_question", "normal_chat",
)

_PERCEIVE_RULES: list[tuple[str, list[str]]] = [
    ("pattern_question", [
        r"\bpattern\b", r"\bwhat do you see in me\b", r"\bkeep feeling\b",
        r"\balways feel\b", r"\bwhy do i keep\b", r"\bagain and again\b",
        r"\bevery time i\b", r"\bkeep (ending up|coming back|going back)\b",
    ]),
    ("progress_question", [
        r"\bprogress\b", r"\bhow am i doing\b", r"\bstruggling with lately\b",
        r"\bwhat have i been\b", r"\bmy (tasks|streak)\b", r"\bcompleted\b",
        r"\bimproving\b", r"\bam i getting (better|worse|anywhere)\b",
    ]),
    ("journal_reference", [
        r"\bjournal\b", r"\bi wrote\b", r"\bmy (entries|reflections?)\b",
        r"\bwrote about\b", r"\bbeen writing\b",
    ]),
    ("practical_question", [
        r"\bhow (do|can|should) i\b", r"\bhow to\b", r"\bplan\b",
        r"\broutine\b", r"\bschedule\b", r"\bsteps\b", r"\bwhat should i do\b",
    ]),
]

_COMPILED_PERCEIVE = [
    (classification, [re.compile(pattern, re.IGNORECASE) for pattern in patterns])
    for classification, patterns in _PERCEIVE_RULES
]


def perceive(message: str) -> str:
    text = str(message or "")
    for classification, patterns in _COMPILED_PERCEIVE:
        if any(pattern.search(text) for pattern in patterns):
            return classification
    return "normal_chat"


def detect_message_emotion(message: str) -> str | None:
    lowered = str(message or "").lower()
    counts = {
        emotion: sum(1 for keyword in keywords if keyword in lowered)
        for emotion, keywords in EMOTION_LEXICON.items()
    }
    best = max(counts, key=lambda emotion: counts[emotion])
    return best if counts[best] > 0 else None


def count_questions_asked(conversation_history: list[dict]) -> int:
    """Session question budget: how many prior assistant turns asked a question."""
    return sum(
        1
        for turn in (conversation_history or [])
        if turn.get("role") == "assistant" and "?" in str(turn.get("content") or "")
    )


# ── STEP 6 support: mode directives ─────────────────────────────────────────

MODE_DIRECTIVES = {
    "REFLECT": (
        "Respond in REFLECT mode. Name what the user is carrying, in their own "
        "emotional vocabulary. No advice, no pattern claims, no references to "
        "past writing unless journal signals appear below."
    ),
    "INSIGHT": (
        "Respond in INSIGHT mode. A real, data-backed pattern appears below — "
        "name it specifically: how many times, how recently. Use the user's own "
        "words for the feeling. End with one honest question, not advice."
    ),
    "QUESTION": (
        "Respond in QUESTION mode. Ask exactly one sharp clarifying question. "
        "Nothing else."
    ),
    "DIRECT": (
        "Respond in DIRECT mode. One concrete next step, warm but unambiguous. "
        "Ground it in the behavioral signals below if present."
    ),
}

SOFT_CLOSE_NOTE = (
    "[SESSION NOTE] This session is nearing its natural end. Close warmly this "
    "turn — no new threads, no questions."
)

MAX_QUESTIONS_PER_SESSION = 2


@dataclass
class AgentTurn:
    classification: str
    sanitized_message: str
    response_mode: str | None = None
    escalation: dict | None = None
    tools_called: list[str] = field(default_factory=list)
    tool_results: dict = field(default_factory=dict)
    directive_block: str = ""
    trace: dict = field(default_factory=dict)


def _render_tool_signals(tool_results: dict) -> str:
    lines: list[str] = []
    journal = tool_results.get("journal_search") or []
    if journal:
        lines.append("Journal signals (similar past entries):")
        for item in journal:
            lines.append(
                f"- {item.get('date')}: felt '{item.get('emotion_signal')}' "
                f"(theme: {item.get('key_theme')}, similarity {item.get('similarity_score')})"
            )
    tasks = tool_results.get("task_history")
    if tasks:
        lines.append(
            "Behavioral signals: "
            f"completion rate {tasks.get('completion_rate')}, streak {tasks.get('streak')}, "
            f"most skipped: {tasks.get('most_skipped_category') or 'none'}, "
            f"signal: {tasks.get('pattern_signal')}"
        )
    pattern = tool_results.get("pattern_check")
    if pattern and pattern.get("frequency", 0) >= 2:
        lines.append(f"Confirmed pattern: {pattern.get('pattern_description')}")
    return "\n".join(lines)


def run_react_loop(
    *,
    user_id: str,
    message: str,
    conversation_history: list[dict] | None,
    supabase,
    rate_status: RateLimitStatus | None = None,
) -> AgentTurn:
    """The full loop, STEP 1 through the directive handed to STEP 6.
    If .escalation is set, the caller serves it and stops — nothing else runs.
    """
    trace: dict = {"user_id": user_id, "steps": []}

    # ── STEP 1: SECURITY ────────────────────────────────────────────────────
    distress_tier = detect_distress(message)
    if distress_tier:
        trace["steps"].append({"step": "security", "distress": distress_tier, "action": "escalate_and_stop"})
        escalation = escalation_trigger(user_id, distress_tier, message, supabase=supabase)
        turn = AgentTurn(classification="distress", sanitized_message=str(message or ""), escalation=escalation, trace=trace)
        print("COMPANION_TRACE " + json.dumps(trace))
        return turn

    sanitized = sanitize_untrusted_text(message, source="user_message", user_id=user_id)
    trace["steps"].append({
        "step": "security", "distress": None,
        "injection_flagged": sanitized.flagged, "sentences_dropped": sanitized.dropped_sentences,
    })

    # ── STEP 2: PERCEIVE ────────────────────────────────────────────────────
    classification = perceive(sanitized.text)
    trace["steps"].append({"step": "perceive", "classification": classification})

    # ── STEP 3: REASON ──────────────────────────────────────────────────────
    questions_asked = count_questions_asked(conversation_history)
    question_budget_left = questions_asked < MAX_QUESTIONS_PER_SESSION
    message_emotion = detect_message_emotion(sanitized.text)

    tools_planned: list[str] = []
    reasons: list[str] = []
    if classification == "pattern_question":
        tools_planned = ["journal_search"]  # pattern_check only if journal_search finds 2+
        reasons.append("pattern question needs historical grounding before any pattern claim")
        mode = "REFLECT"  # upgraded to INSIGHT only by confirmed data in OBSERVE
    elif classification == "progress_question":
        tools_planned = ["task_history"]
        reasons.append("progress question needs behavioral data, not impressions")
        mode = "DIRECT"
    elif classification == "journal_reference":
        tools_planned = ["journal_search"]
        reasons.append("user referenced past writing; claims about it must be retrieved, not remembered")
        mode = "REFLECT"
    elif classification == "practical_question":
        reasons.append("practical ask: no tools needed, answer directly")
        mode = "DIRECT"
    else:
        reasons.append("default: no tools; receive before analyzing")
        thin_message = len(sanitized.text.split()) < 6
        mode = "QUESTION" if (thin_message and question_budget_left) else "REFLECT"

    trace["steps"].append({
        "step": "reason", "tools_planned": tools_planned, "mode_initial": mode,
        "why": reasons, "message_emotion": message_emotion,
        "questions_asked_this_session": questions_asked,
    })

    # ── STEP 4: ACT ─────────────────────────────────────────────────────────
    tool_results: dict = {}
    tools_called: list[str] = []
    if "journal_search" in tools_planned:
        results = journal_search(sanitized.text, user_id, top_k=3, supabase=supabase)
        tool_results["journal_search"] = results
        tools_called.append("journal_search")
        if classification == "pattern_question" and len(results) >= 2:
            emotion = message_emotion or str(results[0].get("emotion_signal") or "")
            if emotion and emotion != "unspecified":
                tool_results["pattern_check"] = pattern_check(user_id, emotion, supabase=supabase)
                tools_called.append("pattern_check")
    if "task_history" in tools_planned:
        tool_results["task_history"] = task_history(user_id, supabase=supabase)
        tools_called.append("task_history")

    trace["steps"].append({
        "step": "act", "tools_called": tools_called,
        "result_summary": {
            "journal_matches": len(tool_results.get("journal_search") or []),
            "pattern_frequency": (tool_results.get("pattern_check") or {}).get("frequency"),
            "has_task_signals": "task_history" in tool_results,
        },
    })

    # ── STEP 5: OBSERVE (downgrades only — data can never upgrade past truth) ─
    observations: list[str] = []
    pattern = tool_results.get("pattern_check")
    if classification == "pattern_question":
        if pattern and pattern.get("frequency", 0) >= 2:
            mode = "INSIGHT"
            observations.append(f"pattern confirmed (frequency={pattern['frequency']}) -> INSIGHT earned")
        else:
            mode = "REFLECT"
            observations.append("insufficient pattern data -> staying in REFLECT, no pattern claim")
    if not (tool_results.get("journal_search") or []) and "journal_search" in tools_called:
        observations.append("journal_search empty -> must not reference past writing")

    trace["steps"].append({"step": "observe", "observations": observations, "mode_final": mode})

    # ── STEP 6: RESPOND (directive for the single provider call) ────────────
    directive_lines = ["[AGENT DIRECTIVE — internal, never mention to the user]", MODE_DIRECTIVES[mode]]
    if not question_budget_left:
        directive_lines.append("Question budget spent this session: do not ask any question.")
    if rate_status and rate_status.soft_close:
        directive_lines.append(SOFT_CLOSE_NOTE)
    signals = _render_tool_signals(tool_results)
    if signals:
        directive_lines.append(wrap_retrieved(signals))

    turn = AgentTurn(
        classification=classification,
        sanitized_message=sanitized.text,
        response_mode=mode,
        tools_called=tools_called,
        tool_results=tool_results,
        directive_block="\n".join(directive_lines),
        trace=trace,
    )
    print("COMPANION_TRACE " + json.dumps(trace))
    return turn
