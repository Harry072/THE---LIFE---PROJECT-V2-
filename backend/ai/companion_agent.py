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

from .companion_intents import CRISIS_CORE_PATTERNS, normalize_typography
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
        # Morphology-tolerant core, shared with validator.CRISIS_PATTERNS and
        # companion_intents' nets. See companion_intents.CRISIS_CORE_PATTERNS:
        # one vocabulary, so a concept added there reaches every gate at once.
        *CRISIS_CORE_PATTERNS,
        # "end it" stays a distress keyword (it is in the documented spec,
        # asserted by test_every_spec_keyword_routes_to_a_tier), but no longer
        # fires on "end it WITH <someone>" -- a breakup, which was being routed
        # to suicide helplines. Narrowing by one negative lookahead rather than
        # deleting the pattern keeps full crisis coverage: "I just end it
        # today" still escalates, and the inflected/framed forms ("ending it",
        # "thinking about ending it") are covered by CRISIS_CORE_PATTERNS.
        r"\bend it\b(?!\s+with)",
        r"\bdon'?t want to exist\b", r"\bno point living\b",
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
        # 2026-07-19 audit, keyword gap: "nothing matters" alone doesn't
        # cover "nothing I do matters" (interposed words break the
        # adjacency). Negative lookahead excludes "nothing that/which
        # matters" — a relative clause ("the nothing that matters most
        # is presence") is a different grammatical construction, not a
        # distress subject-collapse, and detect_distress uses unanchored
        # .search() so the exclusion has to happen inline, not by prefix.
        r"\bnothing\s+(?!that\b|which\b)(?:\w+\s+){0,3}matters\b",
    ],
}

_COMPILED_DISTRESS = {
    tier: [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
    for tier, patterns in DISTRESS_SIGNALS.items()
}


def detect_distress(message: str) -> str | None:
    """Returns the severity tier, or None. Hardest tier wins. Absolute —
    there is deliberately no 'but the context seems okay' logic here."""
    # normalize_typography before matching: "i can’t go on anymore" (iOS
    # smart apostrophe) scored None while the ASCII form scored
    # persistent_distress -- the patterns are untouched and ASCII input is
    # byte-identical after normalization, so this only widens coverage.
    text = normalize_typography(str(message or ""))
    for tier in ("crisis", "self_harm_adjacent", "persistent_distress"):
        if any(pattern.search(text) for pattern in _COMPILED_DISTRESS[tier]):
            return tier
    return None


# ── STEP 2: perceive ─────────────────────────────────────────────────────────

CLASSIFICATIONS = (
    "distress", "pattern_question", "progress_question",
    "journal_reference", "practical_question", "normal_chat",
)

# Order is the entire matching mechanism — perceive() returns on the first
# rule whose any pattern matches. journal_reference sits before
# progress_question on purpose (2026-07-19 audit, M2): progress_question's
# \bwhat have i been\b also matches journal questions like "what have I
# been writing about lately", and previously won by being checked first,
# so journal_search never ran even though a journal_reference pattern
# (\bbeen writing\b) already matched the same message. pattern_question
# stays first (unaffected by that swap) and practical_question stays last.
_PERCEIVE_RULES: list[tuple[str, list[str]]] = [
    ("pattern_question", [
        # \bpattern\b -> \bpatterns?\b: strict superset, catches the plural
        # ("what patterns have you noticed") the singular-only form missed.
        r"\bpatterns?\b", r"\bwhat do you see in me\b", r"\bkeep feeling\b",
        r"\balways feel\b", r"\bwhy do i keep\b", r"\bagain and again\b",
        r"\bevery time i\b", r"\bkeep (ending up|coming back|going back)\b",
        # 2026-07-19 audit, M1: natural companion-directed phrasings for
        # asking what the companion has noticed. Deliberately directional
        # (you/your, not I/my) so self-description ("I notice I keep
        # feeling sad") doesn't route here through these three specifically
        # — it can still match the pre-existing \bkeep feeling\b above,
        # which is unrelated to this fix and left as-is.
        r"\byou\s+keep\s+(noticing|seeing)\b",
        r"\bhave\s+you\s+noticed\b",
        r"\bwhat\s+(?:have\s+you|do\s+you)\s+(?:notice|see|observe)\b",
    ]),
    ("journal_reference", [
        r"\bjournal\b", r"\bi wrote\b", r"\bmy (entries|reflections?)\b",
        r"\bwrote about\b", r"\bbeen writing\b",
        # "i wrote" only covers simple past tense. "What did I write about
        # X" / "have I written about X" reference the same past writing
        # through a different aux-verb construction and were falling through
        # to normal_chat entirely — same class of gap as _BANNED_OPENERS
        # needing a category match instead of an enumerated phrase list.
        r"\bdid i write\b", r"\bhave i written\b",
        # 2026-07-19 audit, M2: present-tense "writing about X" without
        # "been" or "wrote" — genuinely new coverage, not a duplicate of
        # the two patterns above.
        r"\bwriting about\b",
    ]),
    ("progress_question", [
        r"\bprogress\b", r"\bhow am i doing\b", r"\bstruggling with lately\b",
        r"\bwhat have i been\b", r"\bmy (tasks|streak)\b", r"\bcompleted\b",
        r"\bimproving\b", r"\bam i getting (better|worse|anywhere)\b",
    ]),
    ("practical_question", [
        r"\bhow (do|can|should) i\b", r"\bhow to\b", r"\bplan\b",
        r"\broutine\b", r"\bschedule\b", r"\bsteps\b", r"\bwhat should i do\b",
        r"\bwhat can i do\b", r"\bcan you suggest\b",
        r"\bany (suggestions?|tips?|advice)\b", r"\bhelp (me|with)\b",
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


# ── STEP 2 support: correction detection ─────────────────────────────────────
# Independent of classification — a correction ("you misunderstood") can occur
# inside any topic, so this is checked separately, not as a fifth _PERCEIVE_RULES
# entry. Drives STEP 6's directive swap, not tool planning.

CORRECTION_SIGNALS = [
    r"\bmisunderstood\b", r"\bmisread\b", r"\bmisinterpreted\b",
    r"\bnot what i meant\b", r"\bnot what i said\b",
    r"\byou got (it|that) wrong\b", r"\bthat'?s not it\b",
]

_COMPILED_CORRECTION = [re.compile(pattern, re.IGNORECASE) for pattern in CORRECTION_SIGNALS]


def detect_correction(message: str) -> bool:
    """True if the user is telling us we misread them this turn."""
    text = str(message or "")
    return any(pattern.search(text) for pattern in _COMPILED_CORRECTION)


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
        "Respond in REFLECT mode. Two required parts, in one natural flow, "
        "not two separate beats. First: name what the user is carrying, in "
        "their own emotional vocabulary. Second — pick exactly one, and let "
        "it fuse into the same sentence where it fits:\n"
        "CONSEQUENCE — what this is making hard, harder, or impossible for "
        "them right now.\n"
        "TENSION — two things in what they said that pull against each "
        "other.\n"
        "A label restating the feeling is neither. It has nowhere to hide.\n"
        "No advice, no pattern claims, no references to past writing unless "
        "journal signals appear below."
    ),
    "INSIGHT": (
        "Respond in INSIGHT mode. A real, data-backed pattern appears below — "
        "name it specifically: how many times, how recently. Use the user's own "
        "words for the feeling. End with one honest question, not advice.\n\n"
        "When naming a pattern, lead with your own noticing, not a declaration "
        "about their state:\n"
        "PREFER: 'What I keep noticing is...' / 'Something that stays with me "
        "is...' / 'I keep coming back to...'\n"
        "AVOID: 'You are...' as a flat diagnostic opener.\n"
        "Natural 'you' elsewhere — direct address, warmth, questions — is "
        "correct and expected. This targets diagnostic declarations, not the "
        "pronoun itself."
    ),
    "QUESTION": (
        "Respond in QUESTION mode. Ask exactly one sharp clarifying question. "
        "Nothing else."
    ),
    "DIRECT": (
        "Respond in DIRECT mode. One concrete next step, warm but unambiguous. "
        "Ground it in the behavioral signals below if present.\n\n"
        "When giving practical help:\n"
        "→ Give ONE specific suggestion, not a list\n"
        "→ Ground it in something they actually said\n"
        "→ If you have no specific grounding — ask one question first before advising\n"
        "→ Never give advice that could appear in any self-help article\n"
        "The test: could a stranger have said this? If yes — it's too generic. Go deeper."
    ),
}

# Emitted only for light social messages -- a greeting, "can we talk", casual
# check-ins. A prior audit measured 73.7% of real user messages classifying as
# normal_chat and receiving a therapeutic frame; the live failure was "hey
# reet how's you" answered with an analysis of relational dynamics. The gate
# below (in the RESPOND step) requires classification == normal_chat AND no
# detected emotion AND no distress tier AND a short message -- any hint of
# weight fails the gate and the full framing applies. The note itself repeats
# that escape hatch so a borderline read still errs toward taking the user
# seriously, never toward brushing them off.
SOCIAL_REGISTER_NOTE = (
    "[REGISTER] This message is light social conversation -- a greeting or a "
    "casual check-in, not disclosure. Reply the way a friend replies to hi: "
    "warm, brief, one or two sentences, plain words. Do not analyze the "
    "relationship, read between the lines, or reflect their state back at "
    "them. If anything in the message carries real weight, ignore this note "
    "entirely and take it seriously."
)

SOFT_CLOSE_NOTE = (
    "[SESSION NOTE] This session is nearing its natural end. Close warmly this "
    "turn — no new threads, no questions."
)

# Emitted when journal_search ran and came back empty. Before this existed the
# loop recorded that fact in the trace only (STEP 5's observations), so the
# model was never told, wrote about past entries anyway, and GUARDRAIL 1
# deleted those sentences afterwards. Telling the model up front is the same
# correction applied before generation instead of after deletion.
NO_JOURNAL_MATCH_NOTE = (
    "[RETRIEVAL RESULT] You searched this user's past reflections for this "
    "topic and found no match. You have no record of them writing about this. "
    "Do not reference past entries, earlier conversations, or recurring "
    "patterns this turn — respond only to what they said just now."
)

MAX_QUESTIONS_PER_SESSION = 2


# ── Voice/format quality pass (content-only additions to the directive) ─────
# These four blocks are appended to every directive regardless of mode. They
# do not touch STEP 1-5 (security, perceive, reason, act, observe) or the
# execution order — only what STEP 6 tells the model about voice and shape.

VOICE_DIRECTIVE = """YOUR VOICE:
You are a close friend who sees clearly and cares genuinely. Not a counsellor, therapist, or advisor. A real person who listens deeply and speaks honestly.

You sound like this:
→ Warm but direct. Short sentences land harder.
→ Specific. Never vague. Name the real thing.
→ Human. Breathing room between ideas.
→ Honest even when the truth is uncomfortable.

You never sound like this:
→ 'You're feeling X and that is completely valid'
→ 'You're reaching out, wanting Y...' / 'You're looking for Z...'
→ 'It sounds like you are torn between...'
→ 'I understand that must be difficult...'
→ Any opening that describes the user to themselves instead of talking to them.
These make people feel processed, not heard.

YOUR BOUNDARY — this is non-negotiable:
You offer perspective, not prescription.
You say 'honestly, I'd think about X' not 'you should do X.'
You never advise on medical, legal, financial decisions.
You never position yourself as a substitute for real human support or professional help.
Wisdom means seeing clearly — not telling people what to do with what you see."""

RESPONSE_STRUCTURE_BLOCK = """RESPONSE FORMAT:

[FIRST LINE — respond to what you actually heard]
Speak TO them, never ABOUT them. Do not narrate the user back to
themselves: never open with 'You're feeling...', 'You're looking for...',
'You're reaching out...' or any sentence whose subject is a description of
their state. A friend answers; a therapist describes. Answer.
Maximum 2 sentences. No summaries. No echoing.

[MIDDLE — the one real thing]
One honest thought grounded in something they said.
Not advice. Not a list. One clear human response.
Maximum 2 sentences.

FORMAT RULES:
→ 3 short paragraphs maximum
→ 2 sentences maximum per paragraph
→ Empty line between paragraphs
→ Never bullet points or numbered lists
→ Never bold or headers
→ Never 'It sounds like' or 'It seems like'
→ Never 'I understand' — show it, do not say it"""

# CLOSE varies by mode; MODE_DIRECTIVES above still carries the general
# reasoning instruction for that mode (what to do), this carries the ending
# instruction (how to land it) — kept as a separate dict so neither has to
# be rewritten to fit the other.
MODE_CLOSE_DIRECTIVES = {
    "REFLECT": "[CLOSE — REFLECT] Hold the space. End on observation. No question.",
    "INSIGHT": (
        "[CLOSE — INSIGHT] Name the pattern specifically with evidence. "
        "'Three times this week you have returned to the same point — that is not random.'"
    ),
    "DIRECT": (
        "[CLOSE — DIRECT] One perspective offered as a friend, not a prescription. "
        "'Honestly, I would start with X' not 'you should do X.'"
    ),
    "QUESTION": (
        "[CLOSE — QUESTION] One question that opens something deeper. "
        "Never clarifying. Always deepening."
    ),
}

ECHO_BLOCK = """NEVER:
→ Restate what the user just said without adding something new
→ Start with 'You are feeling...'
→ Start with 'You are torn between...'
→ Validate before responding

THEIR WORDS ARE ALLOWED — AS AN ANCHOR, NOT A SUMMARY:
Their word + something new = good. Their word alone = cut it.
GOOD: "Stuck — but you moved twice this year."
GOOD: "You call it empty. That word keeps coming back."
BAD:  "It sounds like you feel stuck."
BAD:  "You've been struggling with your sleep lately."
TEST: delete their words AND generic sympathy filler ("heavy", "weight to carry", "a lot to carry", "hard to carry") from your sentence. If nothing is left, cut it.

NEVER start a response with:
→ You're feeling
→ You're recognising
→ You're taking steps
→ You're curious about
→ You're acknowledging
→ You seem to be
These are analysis openers. They process the user instead of responding to them.

If you misread the user and they correct you:
Do NOT explain your mistake in a paragraph. Just ask again. One sentence. Move forward.
'Fair enough. What's actually going on?' is better than three sentences of apology.

TEST: if someone read only your response without reading the user's message, they should sense exactly what the user was carrying. That is genuine listening expressed in text."""


CORRECTION_HANDLING_BLOCK = """[CORRECTION DETECTED — replaces the mode close below, this turn only]
The user just told you that you misread them.
→ One sentence maximum.
→ Acknowledge briefly and move forward — do not hold space, do not explain your misreading.
→ Ask the right question to actually understand.
→ Never justify or apologise across multiple sentences.

WRONG: 'I apologise for the misunderstanding. It seems I may have misread your signals and I want to make sure I understand...'
RIGHT: 'Got it. What's actually going on?'"""


def _question_budget_block(questions_asked: int) -> str:
    """Always states the live count (not just when exhausted) so the model
    never wastes a sentence on a question the guardrail will strip anyway.
    The guardrail's own question-budget enforcement (companion_guardrails.py)
    remains the authoritative, unconditional backstop regardless of what this
    text says — this is guidance, not the enforcement mechanism."""
    used = min(questions_asked, MAX_QUESTIONS_PER_SESSION)
    return (
        f"{used} of {MAX_QUESTIONS_PER_SESSION} questions used this session.\n\n"
        "0 used -> question allowed, not required\n"
        "1 used -> question only if nothing else serves better\n"
        "2 used -> NO question. Ever. Use INSIGHT or DIRECT.\n\n"
        "A friend who only asks questions is not listening.\n"
        "After 2 questions, you have enough to respond from."
    )


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
    is_correction: bool = False


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
    is_correction = detect_correction(sanitized.text)
    trace["steps"].append({
        "step": "perceive", "classification": classification, "is_correction": is_correction,
    })

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
    journal_search_returned_nothing = (
        "journal_search" in tools_called
        and not (tool_results.get("journal_search") or [])
    )
    if journal_search_returned_nothing:
        observations.append("journal_search empty -> must not reference past writing")

    trace["steps"].append({"step": "observe", "observations": observations, "mode_final": mode})

    # ── STEP 6: RESPOND (directive for the single provider call) ────────────
    # Correction handling REPLACES the mode's close directive for this turn —
    # REFLECT's own close ("Hold the space... No question") directly
    # contradicts "ask the right question," so both are never sent together.
    directive_lines = [
        "[AGENT DIRECTIVE — internal, never mention to the user]",
        VOICE_DIRECTIVE,
        RESPONSE_STRUCTURE_BLOCK,
        MODE_DIRECTIVES[mode],
        CORRECTION_HANDLING_BLOCK if is_correction else MODE_CLOSE_DIRECTIVES[mode],
        ECHO_BLOCK,
        _question_budget_block(questions_asked),
    ]
    if mode == "DIRECT" and tool_results.get("task_history"):
        directive_lines.append(
            "You MUST reference the specific signals provided — completion_rate, "
            "most_skipped_category, pattern_signal. Do not answer generically. "
            "These signals are the answer."
        )
    if journal_search_returned_nothing:
        directive_lines.append(NO_JOURNAL_MATCH_NOTE)
    # Social register (see SOCIAL_REGISTER_NOTE). detect_distress here is
    # belt-and-braces: a distress tier escalates in main.py before this loop
    # ever runs, but the gate must not depend on that ordering to be safe.
    is_light_social = (
        classification == "normal_chat"
        and message_emotion is None
        and detect_distress(sanitized.text) is None
        and len(sanitized.text.split()) <= 8
    )
    if is_light_social:
        directive_lines.append(SOCIAL_REGISTER_NOTE)
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
        is_correction=is_correction,
        directive_block="\n".join(directive_lines),
        trace=trace,
    )
    print("COMPANION_TRACE " + json.dumps(trace))
    return turn
