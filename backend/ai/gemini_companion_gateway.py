"""
Gemini Flash companion provider.

Uses google.generativeai (legacy SDK) — the same library already wired
for task generation in gateway.py — so no new dependency is needed.
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from time import perf_counter

try:
    import google.generativeai as genai

    _GENAI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore[assignment]
    _GENAI_AVAILABLE = False


GEMINI_COMPANION_MODEL = (
    os.environ.get("GEMINI_COMPANION_MODEL")
    or os.environ.get("GEMINI_MODEL")
    or "gemini-2.5-flash-lite"
)

REASON_TIMEOUT = "provider_timeout"
REASON_UNAVAILABLE = "provider_unavailable"
REASON_AUTH_FAILED = "authentication_failed"
REASON_EMPTY_OUTPUT = "empty_provider_response"
REASON_QUOTA = "provider_quota_exceeded"
REASON_PROVIDER_EXCEPTION = "provider_exception"

GEMINI_FALLBACK_REASONS = {
    REASON_TIMEOUT,
    REASON_UNAVAILABLE,
    REASON_QUOTA,
    REASON_EMPTY_OUTPUT,
    REASON_PROVIDER_EXCEPTION,
}


class GeminiCompanionProviderError(Exception):
    def __init__(
        self,
        reason: str,
        message: str = "Gemini companion provider failed.",
        latency_ms: int | None = None,
    ):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms


@dataclass
class GeminiCompanionProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


def get_gemini_companion_api_key() -> str | None:
    for var in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(var, "").strip().strip("\"'")
        if val:
            return val
    return None


def _build_content_from_parts(prompt_parts: dict) -> str:
    """Flatten prompt_parts context + history + user_message into one content string."""
    parts: list[str] = []
    ctx = prompt_parts.get("context", "")
    if ctx:
        parts.append(ctx)
    for turn in (prompt_parts.get("history") or [])[-10:]:
        if not isinstance(turn, dict):
            continue
        role = str(turn.get("role") or "").strip().lower()
        content = str(turn.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            label = "USER" if role == "user" else "ASSISTANT"
            parts.append(f"[{label}]: {content}")
    user_msg = prompt_parts.get("user_message", "")
    if user_msg:
        parts.append(f"[USER]: {user_msg}")
    return "\n\n".join(p for p in parts if p)


def _parse_gemini_response(raw: str, classified_intent: str | None = None) -> dict:
    """Parse JSON from Gemini response with robust fallback."""
    text = raw.strip()
    # Strip markdown fences
    if text.startswith("```"):
        lines = text.split("\n", 1)
        if len(lines) > 1:
            text = lines[1].rsplit("```", 1)[0].strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and parsed.get("reply"):
            return parsed
    except (json.JSONDecodeError, Exception):
        pass
    # Fallback: treat entire response as the reply
    return {
        "reply": raw.strip(),
        "intent": classified_intent or "advice",
        "tone": "grounded",
        "action_type": "none",
        "reply_format": "conversation",
    }


def _classify_gemini_error(exc: Exception) -> str:
    msg = str(exc).lower()
    if "quota" in msg or "429" in msg or "resource_exhausted" in msg:
        return REASON_QUOTA
    if "api_key" in msg or "auth" in msg or "401" in msg or "403" in msg:
        return REASON_AUTH_FAILED
    if "timeout" in msg or "deadline" in msg:
        return REASON_TIMEOUT
    return REASON_PROVIDER_EXCEPTION


def _call_gemini_companion(
    api_key: str,
    system_prompt: str,
    content: str,
    model_name: str,
) -> str:
    genai.configure(api_key=api_key)  # type: ignore[union-attr]
    model = genai.GenerativeModel(  # type: ignore[union-attr]
        model_name=model_name,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(  # type: ignore[union-attr]
            temperature=0.8,
            max_output_tokens=900,
        ),
    )
    response = model.generate_content(content)
    text = getattr(response, "text", "") or ""
    if not text.strip():
        raise GeminiCompanionProviderError(
            REASON_EMPTY_OUTPUT, "Gemini returned an empty response."
        )
    return text.strip()


def generate_life_companion_with_gemini(
    prompt_parts: dict,
    prompt_version: str,
    *,
    classified_intent: str | None = None,
    timeout_seconds: int = 20,
) -> GeminiCompanionProviderResponse:
    """Call Gemini Flash for companion response. Primary provider."""
    if not _GENAI_AVAILABLE:
        raise GeminiCompanionProviderError(
            REASON_UNAVAILABLE, "google.generativeai SDK is not installed."
        )
    api_key = get_gemini_companion_api_key()
    if not api_key:
        raise GeminiCompanionProviderError(
            REASON_UNAVAILABLE, "GEMINI_API_KEY is not configured."
        )

    system_prompt = prompt_parts.get("system", "")
    content = _build_content_from_parts(prompt_parts)
    model_name = GEMINI_COMPANION_MODEL

    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_call_gemini_companion, api_key, system_prompt, content, model_name)

    try:
        raw_text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise GeminiCompanionProviderError(
            REASON_TIMEOUT, f"Gemini timed out after {timeout_seconds}s.", latency_ms
        ) from exc
    except GeminiCompanionProviderError:
        executor.shutdown(wait=False, cancel_futures=True)
        raise
    except Exception as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        reason = _classify_gemini_error(exc)
        raise GeminiCompanionProviderError(reason, str(exc), latency_ms) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)

    # Parse and re-serialise as JSON string for the downstream bypass/validator
    parsed = _parse_gemini_response(raw_text, classified_intent)
    response_text = json.dumps(parsed)

    print(f"COMPANION_RESPONSE provider=gemini model={model_name} latency_ms={latency_ms}")
    return GeminiCompanionProviderResponse(
        text=response_text,
        provider="gemini",
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )
