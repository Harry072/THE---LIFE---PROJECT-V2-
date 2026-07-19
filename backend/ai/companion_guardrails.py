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
no "It sounds like"/"I understand" openers, echo-repetition, question
budget) — enforced last.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .validator import _word_overlap_ratio


SAFE_FALLBACK_LINE = "I'm here. Stay with what you just said for a moment."

# Same technique, same threshold as validator.py's already-tuned
# similar-recent-title check (word-set Jaccard overlap, >= 0.70 = same
# content restated). Imported, not reimplemented — one algorithm, one
# number, proven in production for task titles already.
ECHO_OVERLAP_THRESHOLD = 0.70

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
    # "You're feeling"/"You're recognising"/etc. were the named examples, but
    # a live trace caught the model opening with "You're not sure who you
    # are..." — not on that list, same violation. An enumerated list loses
    # to an LLM's paraphrasing; ban the category (any sentence that opens by
    # telling the user what they are/feel) instead of a fixed phrase set.
    re.compile(r"^\s*you'?re\s+\w+\s+", re.IGNORECASE),
    re.compile(r"^\s*you are\s+\w+\s+", re.IGNORECASE),
    re.compile(r"^\s*you seem to be\s+", re.IGNORECASE),
    # Audit finding #3 (2026-07-17): the copula patterns above ("you're X" /
    # "you are X") only cover "to be" constructions. A live trace caught
    # "You want to give me a name that feels personal to you..." opening a
    # reply unstripped — same diagnostic-declaration violation, different
    # verb family entirely (declarative present-tense state/desire verbs,
    # not a copula). No length gate here (unlike the copula patterns, which
    # require a second word + trailing space to spare "You're welcome.") —
    # there is no equivalent idiom in this verb family to protect, and a
    # short "You need rest." is exactly as diagnostic as a long one.
    re.compile(r"^\s*you\s+(want|feel|think|need|know|wish)\b", re.IGNORECASE),
]
_I_UNDERSTAND = re.compile(r"^\s*i understand\b[,.]?\s*", re.IGNORECASE)

MAX_PARAGRAPHS = 3
MAX_SENTENCES_PER_PARAGRAPH = 2
# INSIGHT exception (Part 5): a grounded pattern reveal — real frequency,
# real dates/themes from actual retrieved content — may need more room than
# a REFLECT/DIRECT/QUESTION reply ever should. REFLECT/DIRECT/QUESTION stay
# on the tight default; this pair is INSIGHT-only.
INSIGHT_MAX_PARAGRAPHS = 4
INSIGHT_MAX_SENTENCES_PER_PARAGRAPH = 3


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(str(text or "").strip()) if s.strip()]


def _paragraphs(text: str) -> list[str]:
    """Split preserving \\n\\n breaks — mirrors enforce_response_format's own
    paragraph detection. G1/G2 below process sentences within each paragraph
    independently and rejoin with \\n\\n, not a blind whole-text rejoin, so
    paragraph structure survives to reach enforce_response_format's own
    (mode-aware, Part 5) paragraph budget intact."""
    cleaned = str(text or "").strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]
    return paragraphs if paragraphs else ([cleaned] if cleaned else [])


def _capitalize(sentence: str) -> str:
    return sentence[:1].upper() + sentence[1:] if sentence else sentence


# ── the individual guardrail checks ──────────────────────────────────────────

def check_fabricated_memory(reply: str, tools_called: list[str], tool_results: dict) -> tuple[str, bool]:
    """GUARDRAIL 1. Without retrieval grounding this session, any sentence
    making a memory claim is removed. The claim is never softened — it is
    deleted, because a softened fabrication is still a fabrication.

    Same detection pattern list and same per-sentence removal as before —
    only the reassembly is now paragraph-aware (see _paragraphs)."""
    if has_memory_grounding(tools_called, tool_results):
        return reply, False
    fired = False
    rewritten_paragraphs: list[str] = []
    for paragraph in _paragraphs(reply):
        original_sentences = _sentences(paragraph)
        kept = [
            sentence for sentence in original_sentences
            if not any(pattern.search(sentence) for pattern in MEMORY_CLAIM_PATTERNS)
        ]
        if len(kept) < len(original_sentences):
            fired = True
        if kept:
            rewritten_paragraphs.append(" ".join(kept))
    return "\n\n".join(rewritten_paragraphs), fired


def check_therapist_drift(reply: str) -> tuple[str, bool]:
    """GUARDRAIL 2. Diagnostic sentences are replaced with observational
    language (one replacement max per paragraph — repeated offenses within
    the same paragraph just get removed).

    Same detection patterns and same replacement text as before — only the
    reassembly is now paragraph-aware (see _paragraphs). Previously this
    always rejoined every sentence in the ENTIRE reply with a single space,
    silently destroying \\n\\n structure on every call regardless of whether
    anything fired — which made both the pre-existing 3-paragraph cap and
    Part 5's INSIGHT exception unreachable through the real pipeline for any
    multi-paragraph reply, since this guardrail runs before
    enforce_response_format ever sees the text."""
    fired = False
    rewritten_paragraphs: list[str] = []
    for paragraph in _paragraphs(reply):
        rewritten: list[str] = []
        replaced_once = False
        for sentence in _sentences(paragraph):
            if any(pattern.search(sentence) for pattern in THERAPIST_DRIFT_PATTERNS):
                fired = True
                if not replaced_once:
                    rewritten.append(OBSERVATIONAL_REPLACEMENT)
                    replaced_once = True
                continue
            rewritten.append(sentence)
        if rewritten:
            rewritten_paragraphs.append(" ".join(rewritten))
    return "\n\n".join(rewritten_paragraphs), fired


def check_grounded_insight(mode: str, tool_results: dict) -> tuple[str, bool]:
    """GUARDRAIL 4. INSIGHT requires pattern_check to have returned
    frequency >= 2 this session. Anything less downgrades to REFLECT."""
    if mode != "INSIGHT":
        return mode, False
    pattern = (tool_results or {}).get("pattern_check") or {}
    if int(pattern.get("frequency") or 0) >= 2:
        return mode, False
    return "REFLECT", True


def enforce_response_format(
    reply: str, *, questions_allowed: bool, user_message: str = "", mode: str = "",
) -> tuple[str, list[str]]:
    """The response format rules, applied deterministically:
    bullets flattened, sentences opening with a banned phrase dropped
    whole, sentences that echo the user's own message dropped whole,
    'I understand' removed, question budget enforced, max 3 paragraphs
    x 2 sentences — 4 x 3 for INSIGHT specifically.

    `mode` must be the POST-grounding-check mode (apply_guardrails' own
    final_mode from check_grounded_insight), never the raw incoming mode —
    that is what makes the exception "only triggered by grounded data": an
    ungrounded INSIGHT claim is already downgraded to REFLECT by guardrail 4
    before this function ever sees it, so it never reaches the wider cap."""
    notes: list[str] = []
    text = str(reply or "").strip()
    is_insight = mode == "INSIGHT"
    max_paragraphs = INSIGHT_MAX_PARAGRAPHS if is_insight else MAX_PARAGRAPHS
    max_sentences_per_paragraph = (
        INSIGHT_MAX_SENTENCES_PER_PARAGRAPH if is_insight else MAX_SENTENCES_PER_PARAGRAPH
    )

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
            if any(opener.match(sentence) for opener in _BANNED_OPENERS):
                # Whole sentence dropped, not just the opener prefix — a
                # prefix strip can leave a bare fragment ("About who you
                # are right now...") when the banned phrase isn't followed
                # by an already-complete clause. Applies to every pattern
                # in _BANNED_OPENERS, old and new alike.
                notes.append("banned_opener_sentence_dropped")
                continue
            # Audit finding (2026-07-17): ECHO_BLOCK's "don't repeat what
            # the user said" was the last prompt-only rule in this
            # companion — zero code enforcement. _word_overlap_ratio
            # (imported, not reimplemented) turns it into a deterministic
            # check, same 70% threshold already proven on task titles.
            # elif, not a second independent check: a sentence already
            # caught above is already gone, so each sentence attributes to
            # exactly one guardrail in the trace, never both.
            if _word_overlap_ratio(sentence, user_message) >= ECHO_OVERLAP_THRESHOLD:
                notes.append("echo_repetition_sentence_dropped")
                continue
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
            shaped.append(" ".join(cleaned[:max_sentences_per_paragraph]))
            if len(cleaned) > max_sentences_per_paragraph:
                notes.append("paragraph_trimmed")

    if len(shaped) > max_paragraphs:
        notes.append("paragraphs_trimmed")
        if not is_insight:
            # Explicit, mode-specific tag — a REFLECT/DIRECT/QUESTION reply
            # overflowing its tight 3-paragraph default is a real content-
            # shape bug worth seeing in trace logs on its own, not folded
            # anonymously into the generic trim note every mode shares.
            notes.append("length_violation_non_insight_mode")
        shaped = shaped[:max_paragraphs]

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
    user_message: str = "",
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

    text, format_notes = enforce_response_format(
        text, questions_allowed=questions_allowed, user_message=user_message,
        mode=final_mode,
    )
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
