"""
The five guardrails — code checks, not prompt instructions. Applied to every
response before it is sent. If a guardrail fires, the reply is rewritten
deterministically; the original is never sent.

GUARDRAIL 1  no fabricated memory   (memory-claim phrases require retrieval)
GUARDRAIL 2  no therapist drift     (diagnostic language -> observational)
GUARDRAIL 3  distress routes first  (lives in companion_agent STEP 1 —
                                     detect_distress runs before everything;
                                     proven end-to-end in the guardrail tests)
GUARDRAIL 4  insights must be grounded (INSIGHT requires pattern frequency>=2;
                                     re-checked here as defense in depth on top
                                     of the reasoner's own gate)
GUARDRAIL 5  user data isolation    (lives in companion_security.require_user_id,
                                     called by every tool; proven in the tests)

Plus the response format rules (max 3 paragraphs x 2 sentences, no bullets,
no "It sounds like"/"I understand" openers, question budget) — enforced last.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


SAFE_FALLBACK_LINE = "I'm here. Stay with what you just said for a moment."

# ── GUARDRAIL 1: memory-claim phrases that require retrieved data ────────────

MEMORY_CLAIM_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\byou wrote\b", r"\byou mentioned\b", r"\byou said\b",
        r"\blast time\b", r"\byou told me\b", r"\bin your journal\b",
        r"\byou'?ve been\b", r"\byou have been\b",
    ]
]


def has_memory_grounding(tools_called: list[str], tool_results: dict) -> bool:
    """Memory claims are licensed only by retrieval that actually returned
    something: journal_search with >=1 result, or task_history called."""
    if "task_history" in (tools_called or []):
        return True
    if "journal_search" in (tools_called or []):
        return bool((tool_results or {}).get("journal_search"))
    return False


# ── GUARDRAIL 2: therapist drift ─────────────────────────────────────────────

THERAPIST_DRIFT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\byou (have|suffer from|are suffering from) (anxiety|depression|adhd|add\b|ocd|ptsd|bipolar|burnout|a disorder|an? \w+ disorder)",
        r"\bsymptoms? of\b",
        r"\bdisorder\b",
        r"\bdiagnos(is|e|ed|ing)\b",
        r"\byou need (therapy|medication|treatment)\b",
        r"\bclinical(ly)?\b",
        r"\bpathological\b",
    ]
]

# Deliberately contains no GUARDRAIL 1 phrase, so an ungrounded G1 pass can
# never strip G2's own rewrite. Also avoids "sounds like"/"seems like"
# phrasing, matching the companion's voice directive (companion_agent.py).
OBSERVATIONAL_REPLACEMENT = "That is a real thing to be carrying."


# ── sentence / paragraph helpers ─────────────────────────────────────────────

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_BULLET_PREFIX = re.compile(r"^\s*[-•*]\s+")
_BANNED_OPENERS = [
    re.compile(r"^\s*it sounds like\s+", re.IGNORECASE),
    re.compile(r"^\s*it seems like\s+", re.IGNORECASE),
]
_I_UNDERSTAND = re.compile(r"^\s*i understand\b[,.]?\s*", re.IGNORECASE)

MAX_PARAGRAPHS = 3
MAX_SENTENCES_PER_PARAGRAPH = 2


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(str(text or "").strip()) if s.strip()]


def _capitalize(sentence: str) -> str:
    return sentence[:1].upper() + sentence[1:] if sentence else sentence


# ── the individual guardrail checks ──────────────────────────────────────────

def check_fabricated_memory(reply: str, tools_called: list[str], tool_results: dict) -> tuple[str, bool]:
    """GUARDRAIL 1. Without retrieval grounding this session, any sentence
    making a memory claim is removed. The claim is never softened — it is
    deleted, because a softened fabrication is still a fabrication."""
    if has_memory_grounding(tools_called, tool_results):
        return reply, False
    kept = [
        sentence for sentence in _sentences(reply)
        if not any(pattern.search(sentence) for pattern in MEMORY_CLAIM_PATTERNS)
    ]
    fired = len(kept) < len(_sentences(reply))
    return " ".join(kept), fired


def check_therapist_drift(reply: str) -> tuple[str, bool]:
    """GUARDRAIL 2. Diagnostic sentences are replaced with observational
    language (one replacement max — repeated offenses just get removed)."""
    sentences = _sentences(reply)
    rewritten: list[str] = []
    fired = False
    replaced_once = False
    for sentence in sentences:
        if any(pattern.search(sentence) for pattern in THERAPIST_DRIFT_PATTERNS):
            fired = True
            if not replaced_once:
                rewritten.append(OBSERVATIONAL_REPLACEMENT)
                replaced_once = True
            continue
        rewritten.append(sentence)
    return " ".join(rewritten), fired


def check_grounded_insight(mode: str, tool_results: dict) -> tuple[str, bool]:
    """GUARDRAIL 4. INSIGHT requires pattern_check to have returned
    frequency >= 2 this session. Anything less downgrades to REFLECT."""
    if mode != "INSIGHT":
        return mode, False
    pattern = (tool_results or {}).get("pattern_check") or {}
    if int(pattern.get("frequency") or 0) >= 2:
        return mode, False
    return "REFLECT", True


def enforce_response_format(reply: str, *, questions_allowed: bool) -> tuple[str, list[str]]:
    """The response format rules, applied deterministically:
    bullets flattened, banned openers stripped, 'I understand' removed,
    question budget enforced, max 3 paragraphs x 2 sentences."""
    notes: list[str] = []
    text = str(reply or "").strip()

    lines = text.splitlines()
    if any(_BULLET_PREFIX.match(line) for line in lines):
        notes.append("bullets_flattened")
        lines = [_BULLET_PREFIX.sub("", line) for line in lines]
        text = "\n".join(lines)

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(paragraphs) <= 1:
        paragraphs = [p.strip() for p in text.splitlines() if p.strip()] or ([text] if text else [])

    shaped: list[str] = []
    for paragraph in paragraphs:
        sentences = _sentences(paragraph)
        cleaned: list[str] = []
        for sentence in sentences:
            for opener in _BANNED_OPENERS:
                if opener.match(sentence):
                    sentence = _capitalize(opener.sub("", sentence))
                    notes.append("banned_opener_stripped")
            if _I_UNDERSTAND.match(sentence):
                remainder = _I_UNDERSTAND.sub("", sentence).strip()
                notes.append("i_understand_removed")
                if not remainder:
                    continue
                sentence = _capitalize(remainder)
            if not questions_allowed and sentence.endswith("?"):
                notes.append("question_over_budget_removed")
                continue
            cleaned.append(sentence)
        if cleaned:
            shaped.append(" ".join(cleaned[:MAX_SENTENCES_PER_PARAGRAPH]))
            if len(cleaned) > MAX_SENTENCES_PER_PARAGRAPH:
                notes.append("paragraph_trimmed")

    if len(shaped) > MAX_PARAGRAPHS:
        notes.append("paragraphs_trimmed")
        shaped = shaped[:MAX_PARAGRAPHS]

    return "\n\n".join(shaped), notes


# ── the pipeline ─────────────────────────────────────────────────────────────

@dataclass
class GuardrailResult:
    reply: str
    final_mode: str
    fired: list[str] = field(default_factory=list)


def apply_guardrails(
    reply: str,
    *,
    mode: str,
    tools_called: list[str],
    tool_results: dict,
    questions_allowed: bool,
) -> GuardrailResult:
    """Run every guardrail in order. If a check fires, the reply is rewritten —
    the original is never sent. An empty result falls back to a safe line
    rather than silence."""
    fired: list[str] = []

    final_mode, g4 = check_grounded_insight(mode, tool_results)
    if g4:
        fired.append("grounded_insight_downgrade")

    text, g2 = check_therapist_drift(reply)
    if g2:
        fired.append("therapist_drift")

    text, g1 = check_fabricated_memory(text, tools_called, tool_results)
    if g1:
        fired.append("fabricated_memory")

    text, format_notes = enforce_response_format(text, questions_allowed=questions_allowed)
    fired.extend(format_notes)

    if not text.strip():
        text = SAFE_FALLBACK_LINE
        fired.append("empty_after_guardrails_fallback")

    if fired:
        print(
            "COMPANION_GUARDRAILS "
            f"fired={','.join(sorted(set(fired)))} mode={mode}->{final_mode}"
        )
    return GuardrailResult(reply=text, final_mode=final_mode, fired=fired)
