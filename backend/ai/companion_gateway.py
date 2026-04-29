from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
import os
from time import perf_counter

try:
    from openai import (
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        OpenAI,
        PermissionDeniedError,
    )
except ImportError:  # pragma: no cover - exercised when dependency is not installed.
    OpenAI = None
    AuthenticationError = PermissionDeniedError = NotFoundError = BadRequestError = None
    APITimeoutError = APIConnectionError = APIStatusError = None


class CompanionProviderError(Exception):
    def __init__(self, reason: str, message: str = "Life Companion provider failed.", latency_ms: int | None = None):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms


@dataclass
class CompanionProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip("\"").strip("'") or None


def get_openai_companion_config() -> tuple[str, str]:
    api_key = get_env_value("OPENAI_API_KEY")
    model = get_env_value("OPENAI_COMPANION_MODEL") or "gpt-5.5-mini"
    if not api_key:
        raise CompanionProviderError("provider_unavailable", "OpenAI API key is not configured.")
    if OpenAI is None:
        raise CompanionProviderError("provider_dependency_missing", "OpenAI SDK is not installed.")
    return api_key, model


def extract_output_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output_items = getattr(response, "output", None) or []
    text_parts: list[str] = []
    for item in output_items:
        content_items = getattr(item, "content", None) or []
        for content_item in content_items:
            text = getattr(content_item, "text", None)
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())

    return "\n".join(text_parts).strip()


def _call_openai(prompt: str) -> str:
    api_key, model = get_openai_companion_config()
    client = OpenAI(api_key=api_key)
    try:
        response = client.responses.create(
            model=model,
            input=prompt,
            text={"format": {"type": "json_object"}},
        )
    except TypeError:
        response = client.responses.create(
            model=model,
            input=prompt,
        )
    text = extract_output_text(response)
    if not text:
        raise CompanionProviderError("empty_provider_response", "OpenAI returned an empty response.")
    return text


def classify_openai_error(error: Exception) -> str:
    if AuthenticationError is not None and isinstance(error, AuthenticationError):
        return "authentication_failed"
    if PermissionDeniedError is not None and isinstance(error, PermissionDeniedError):
        return "authentication_failed"
    if NotFoundError is not None and isinstance(error, NotFoundError):
        return "model_unavailable"
    if BadRequestError is not None and isinstance(error, BadRequestError):
        return "model_unavailable"
    if APITimeoutError is not None and isinstance(error, APITimeoutError):
        return "provider_timeout"
    if APIConnectionError is not None and isinstance(error, APIConnectionError):
        return "provider_exception"
    if APIStatusError is not None and isinstance(error, APIStatusError):
        status_code = getattr(error, "status_code", None)
        if status_code in {401, 403}:
            return "authentication_failed"
        if status_code in {400, 404}:
            return "model_unavailable"
    return "provider_exception"


def generate_life_companion_with_openai(
    prompt: str,
    prompt_version: str,
    timeout_seconds: int = 12,
) -> CompanionProviderResponse:
    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_call_openai, prompt)

    try:
        text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise CompanionProviderError("provider_timeout", latency_ms=latency_ms) from exc
    except CompanionProviderError:
        executor.shutdown(wait=False, cancel_futures=True)
        raise
    except Exception as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise CompanionProviderError(classify_openai_error(exc), latency_ms=latency_ms) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)
    return CompanionProviderResponse(
        text=text,
        provider="openai",
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )
