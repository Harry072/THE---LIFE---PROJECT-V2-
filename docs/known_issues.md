# Known issues

Logged only — not fixed. Each entry has live-test evidence behind it.

## 1. `MEMORY_CLAIM_PATTERNS` matches "you've been" but not "you've had"

`backend/ai/companion_guardrails.py` — `MEMORY_CLAIM_PATTERNS` includes
`r"\byou'?ve been\b"` / `r"\byou have been\b"` but has no pattern for
`"you've had"`. GUARDRAIL 1 (`check_fabricated_memory`) only strips
sentences matching an enumerated phrase list, so this construction ships
unfiltered even with zero tool grounding.

**Live evidence** (2026-08-04, live test against `/api/life-companion/chat`,
test account, n=10 per message, temperature 0.7): message 10
("everything feels heavy lately") trials 6 and 10 both shipped ungrounded
claims about the user's history with `tools_called=[]` (confirmed via
`COMPANION_TRACE`):

- Trial 6: *"...it's been a while since you've had a clear moment, that
  weight is really settling in."*
- Trial 10: *"...it's been a while since you've had a clear sense of
  direction with your tasks."*

Neither sentence was touched by `check_fabricated_memory` — `"you've had"`
is not in the pattern list.

## 2. QUESTION mode non-compliance

`MODE_DIRECTIVES["QUESTION"]` states: *"Ask exactly one sharp clarifying
question. Nothing else."* No code enforces this — it is a prompt-only
instruction.

**Live evidence**: same live test, message 10 (QUESTION mode, 10/10
trials). 2 of 10 replies (trials 6 and 10 — the same two flagged in issue
#1 above) contained no question mark at all, ending on a declarative
statement instead.

## 3. Model fallback: prompt tuning assumes 70b, real quality floor is 8b

`backend/ai/groq_companion_gateway.py` falls back from
`llama-3.3-70b-versatile` to `llama-3.1-8b-instant` on provider failure.
All prompt/guardrail tuning in this codebase (companion_agent.py,
prompts.py) is designed and evaluated against 70b output.

**Live evidence**: same live test, 30 total generations. 3 of 30 (10%)
used `llama-3.1-8b-instant` instead of the intended model:
`COMPANION_70B_FAILED reason=provider_unavailable falling_back_to_8b`
(×2) and `reason=provider_quota_exceeded falling_back_to_8b` (×1). One
of these three (message 8, trial 6) produced a reply short and malformed
enough that `_BANNED_OPENERS` deleted it entirely, triggering
`SAFE_FALLBACK_LINE`. The real production quality floor includes 8b
output at a measured ~10% rate, not just 70b.
