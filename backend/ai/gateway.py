from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from typing import Literal
from time import perf_counter

from google.genai import types
from pydantic import BaseModel, Field


class AIGenerationError(Exception):
    def __init__(
        self,
        reason: str,
        message: str,
        latency_ms: int | None = None,
        diagnosis: dict | None = None,
    ):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms
        self.diagnosis = diagnosis or {}


@dataclass
class ProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


class LoopTaskPayload(BaseModel):
    category: Literal["awareness", "action", "meaning"]
    title: str = Field(min_length=3, max_length=80)
    subtitle: str = Field(min_length=3, max_length=80)
    kotler_tag: Literal["Curiosity", "Purpose", "Passion", "Autonomy", "Mastery"]
    waar_action: str = Field(min_length=10, max_length=260)
    ikigai_purpose: str = Field(min_length=10, max_length=360)
    why_this_helps: str = Field(min_length=10, max_length=260)
    detail_description: str = Field(min_length=10, max_length=420)
    duration_minutes: int = Field(ge=2, le=30)
    preferred_time_of_day: str = Field(min_length=3, max_length=24)
    supportive_line: str = Field(min_length=3, max_length=140)
    personalization_reason: str = Field(min_length=8, max_length=260)
    difficulty_level: Literal["gentle", "normal", "deeper"]
    success_condition: str = Field(min_length=5, max_length=140)
    smaller_version: str = Field(min_length=5, max_length=180)
    post_completion_question: str = Field(min_length=5, max_length=120)
    framework_key: Literal["ikigai", "morita", "logotherapy", "flow", "symbol"]
    # ── Intelligence fields with defaults for post-parse validation ───────────
    inner_work_layer: Literal[
        "attachment", "anger", "distraction", "ego", "greed", "acceptance", "none"
    ] = "none"
    approach_angle: Literal["direct", "oblique", "embodied", "reflective"] = "reflective"
    journey_phase: Literal["foundation", "recognition", "integration"] = "foundation"
    ikigai_quadrant: Literal["passion", "mission", "vocation", "profession", "none"] = "none"


class LoopTasksPayload(BaseModel):
    tasks: list[LoopTaskPayload] = Field(min_length=3, max_length=3)


# Gemini rejects default values in responseSchema. This mirror model has the
# same shape as LoopTaskPayload but with the 4 intelligence fields as required
# (no defaults), so the schema sent to Gemini has no 'default' keys.
class _LoopTaskGeminiSchema(BaseModel):
    category: Literal["awareness", "action", "meaning"]
    title: str = Field(min_length=3, max_length=80)
    subtitle: str = Field(min_length=3, max_length=80)
    kotler_tag: Literal["Curiosity", "Purpose", "Passion", "Autonomy", "Mastery"]
    waar_action: str = Field(min_length=10, max_length=260)
    ikigai_purpose: str = Field(min_length=10, max_length=360)
    why_this_helps: str = Field(min_length=10, max_length=260)
    detail_description: str = Field(min_length=10, max_length=420)
    duration_minutes: int = Field(ge=2, le=30)
    preferred_time_of_day: str = Field(min_length=3, max_length=24)
    supportive_line: str = Field(min_length=3, max_length=140)
    personalization_reason: str = Field(min_length=8, max_length=260)
    difficulty_level: Literal["gentle", "normal", "deeper"]
    success_condition: str = Field(min_length=5, max_length=140)
    smaller_version: str = Field(min_length=5, max_length=180)
    post_completion_question: str = Field(min_length=5, max_length=120)
    framework_key: Literal["ikigai", "morita", "logotherapy", "flow", "symbol"]
    inner_work_layer: Literal[
        "attachment", "anger", "distraction", "ego", "greed", "acceptance", "none"
    ]
    approach_angle: Literal["direct", "oblique", "embodied", "reflective"]
    journey_phase: Literal["foundation", "recognition", "integration"]
    ikigai_quadrant: Literal["passion", "mission", "vocation", "profession", "none"]


class _LoopTasksGeminiSchema(BaseModel):
    tasks: list[_LoopTaskGeminiSchema] = Field(min_length=3, max_length=3)


def _strip_schema_defaults(value):
    if isinstance(value, dict):
        return {
            key: _strip_schema_defaults(item)
            for key, item in value.items()
            if key != "default"
        }
    if isinstance(value, list):
        return [_strip_schema_defaults(item) for item in value]
    return value


def loop_tasks_response_schema() -> dict:
    return _strip_schema_defaults(LoopTasksPayload.model_json_schema())


def classify_gemini_error(error: Exception) -> str:
    raw = " ".join(
        str(part or "")
        for part in (
            type(error).__name__,
            getattr(error, "code", None),
            getattr(error, "status_code", None),
            getattr(error, "message", None),
            str(error),
        )
    ).lower()

    if (
        "permissiondenied" in raw
        or "permission denied" in raw
        or "forbidden" in raw
        or "httpstatus.forbidden" in raw
        or " 403" in raw
    ):
        return "gemini_permission_denied"
    if "api key not valid" in raw or "invalid api key" in raw or "api_key_invalid" in raw:
        return "gemini_invalid_api_key"
    if "resource_exhausted" in raw or "quota" in raw or "rate limit" in raw:
        return "gemini_quota_exceeded"
    if "deadline" in raw or "timeout" in raw:
        return "provider_timeout"
    if "safety" in raw or "blocked" in raw:
        return "gemini_safety_blocked"
    return f"provider_error_{type(error).__name__}"


def build_gemini_diagnosis(
    reason: str,
    *,
    key_source: str = "unknown",
    gemini_api_key_present: bool = False,
    google_api_key_present: bool = False,
    model_name: str = "unknown",
) -> dict:
    diagnosis = {
        "reason": reason,
        "model": model_name,
        "effective_key_source": key_source,
        "gemini_api_key_present": bool(gemini_api_key_present),
        "google_api_key_present": bool(google_api_key_present),
        "google_api_key_precedence": (
            "GOOGLE_API_KEY overrides GEMINI_API_KEY when both are set."
            if gemini_api_key_present and google_api_key_present
            else ""
        ),
    }
    if reason == "gemini_permission_denied":
        diagnosis["checklist"] = [
            "Confirm the effective key belongs to the intended Google Cloud or AI Studio project.",
            "Confirm the Generative Language API/Gemini API is enabled for that project.",
            "Check API key restrictions such as allowed APIs, HTTP referrers, server IPs, and Android/iOS app restrictions.",
            "Check billing, quota, and project access for the effective key.",
        ]
    elif reason == "gemini_invalid_api_key":
        diagnosis["checklist"] = [
            "Confirm the effective API key is copied correctly.",
            "Confirm GOOGLE_API_KEY is not unintentionally overriding GEMINI_API_KEY.",
        ]
    elif reason == "provider_unavailable":
        diagnosis["checklist"] = [
            "Set GEMINI_API_KEY or GOOGLE_API_KEY on the backend server.",
            "Restart the backend after changing environment variables.",
        ]
    return diagnosis


def _call_gemini_model(model, prompt: str) -> str:
    response = model.generate_content(prompt)
    text = getattr(response, "text", "") or ""
    if not text.strip():
        raise AIGenerationError("empty_provider_response", "Gemini returned an empty response.")
    return text


def generate_with_gemini(
    model,
    prompt: str,
    prompt_version: str,
    timeout_seconds: int = 12,
) -> ProviderResponse:
    provider = "gemini"
    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_call_gemini_model, model, prompt)

    try:
        text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise AIGenerationError("provider_timeout", "Gemini timed out.", latency_ms) from exc
    except AIGenerationError:
        executor.shutdown(wait=False, cancel_futures=True)
        raise
    except Exception as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        exc_type = type(exc).__name__
        exc_code = str(getattr(exc, "code", None) or getattr(exc, "status_code", None) or "")[:16] or "n/a"
        raise AIGenerationError(f"provider_error_{exc_type}_{exc_code}", str(exc), latency_ms) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)
    return ProviderResponse(
        text=text,
        provider=provider,
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )


def _call_google_genai_loop_tasks(client, model_name: str, prompt: str) -> str:
    # The google-genai SDK uses camelCase kwarg names in GenerateContentConfig
    # (responseMimeType, responseSchema) — not the snake_case names that were
    # previously passed (response_mime_type, response_json_schema), which caused
    # a silent validation error and blocked every first-attempt generation.
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            responseMimeType="application/json",
            responseSchema=loop_tasks_response_schema(),
            temperature=0.9,
        ),
    )
    # Extract text defensively — response shape varies by SDK version
    text = (
        getattr(response, "text", None)
        or (
            response.candidates[0].content.parts[0].text
            if getattr(response, "candidates", None)
            else ""
        )
        or ""
    )
    if not text.strip():
        raise AIGenerationError("empty_provider_response", "Gemini returned an empty response.")
    return text


def generate_loop_tasks_with_gemini(
    client,
    model_name: str,
    prompt: str,
    prompt_version: str,
    *,
    timeout_seconds: int = 25,
    diagnosis_context: dict | None = None,
) -> ProviderResponse:
    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_call_google_genai_loop_tasks, client, model_name, prompt)

    try:
        text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        diagnosis = build_gemini_diagnosis(
            "provider_timeout",
            **(diagnosis_context or {}),
        )
        raise AIGenerationError("provider_timeout", "Gemini timed out.", latency_ms, diagnosis) from exc
    except AIGenerationError:
        executor.shutdown(wait=False, cancel_futures=True)
        raise
    except Exception as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        reason = classify_gemini_error(exc)
        diagnosis = build_gemini_diagnosis(
            reason,
            **(diagnosis_context or {}),
        )
        raise AIGenerationError(reason, str(exc), latency_ms, diagnosis) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)
    return ProviderResponse(
        text=text,
        provider="gemini",
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )
