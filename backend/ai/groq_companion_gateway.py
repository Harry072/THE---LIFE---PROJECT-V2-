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
        RateLimitError,
    )
except ImportError:  # pragma: no cover - exercised when dependency is not installed.
    OpenAI = None
    AuthenticationError = PermissionDeniedError = NotFoundError = BadRequestError = RateLimitError = None
    APITimeoutError = APIConnectionError = APIStatusError = None


PROVIDER_GROQ = "groq"
GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1"

REASON_AUTH_FAILED = "authentication_failed"
REASON_DEPENDENCY_MISSING = "provider_dependency_missing"
REASON_MODEL_UNAVAILABLE = "model_unavailable"
REASON_TIMEOUT = "provider_timeout"
REASON_UNAVAILABLE = "provider_unavailable"
REASON_RATE_LIMITED = "provider_rate_limited"
REASON_QUOTA = "provider_quota_exceeded"
REASON_EMPTY_OUTPUT = "empty_provider_response"
REASON_PROVIDER_EXCEPTION = "provider_exception"


class GroqCompanionProviderError(Exception):
    def __init__(
        self,
        reason: str,
        message: str = "Groq companion provider failed.",
        latency_ms: int | None = None,
    ):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms


@dataclass
class GroqCompanionProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip("\"").strip("'") or None


def get_groq_companion_config() -> tuple[str, str]:
    api_key = get_env_value("GROQ_API_KEY")
    model = get_env_value("GROQ_COMPANION_MODEL") or "llama-3.1-8b-instant"
    if OpenAI is None:
        raise GroqCompanionProviderError(
            REASON_DEPENDENCY_MISSING,
            "OpenAI-compatible SDK is not installed.",
        )
    if not api_key:
        raise GroqCompanionProviderError(
            REASON_UNAVAILABLE,
            "Groq API key is not configured.",
        )
    return api_key, model


def get_value(item, name: str):
    if isinstance(item, dict):
        return item.get(name)
    return getattr(item, name, None)


def extract_groq_output_text(response) -> str:
    choices = get_value(response, "choices") or []
    text_parts: list[str] = []
    for choice in choices:
        message = get_value(choice, "message") or {}
        content = get_value(message, "content")
        if isinstance(content, str) and content.strip():
            text_parts.append(content.strip())
        elif isinstance(content, list):
            for content_item in content:
                text = get_value(content_item, "text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())

    return "\n".join(text_parts).strip()


def classify_rate_limit_error(error: Exception) -> str:
    message = str(error).lower()
    if "quota" in message or "insufficient" in message or "billing" in message:
        return REASON_QUOTA
    return REASON_RATE_LIMITED


def classify_groq_error(error: Exception) -> str:
    if AuthenticationError is not None and isinstance(error, AuthenticationError):
        return REASON_AUTH_FAILED
    if PermissionDeniedError is not None and isinstance(error, PermissionDeniedError):
        return REASON_AUTH_FAILED
    if NotFoundError is not None and isinstance(error, NotFoundError):
        return REASON_MODEL_UNAVAILABLE
    if BadRequestError is not None and isinstance(error, BadRequestError):
        return REASON_MODEL_UNAVAILABLE
    if RateLimitError is not None and isinstance(error, RateLimitError):
        return classify_rate_limit_error(error)
    if APITimeoutError is not None and isinstance(error, APITimeoutError):
        return REASON_TIMEOUT
    if APIConnectionError is not None and isinstance(error, APIConnectionError):
        return REASON_UNAVAILABLE
    if APIStatusError is not None and isinstance(error, APIStatusError):
        status_code = getattr(error, "status_code", None)
        if status_code in {401, 403}:
            return REASON_AUTH_FAILED
        if status_code in {400, 404}:
            return REASON_MODEL_UNAVAILABLE
        if status_code in {408, 504}:
            return REASON_TIMEOUT
        if status_code == 429:
            return classify_rate_limit_error(error)
        if status_code in {500, 502, 503}:
            return REASON_UNAVAILABLE
    return REASON_PROVIDER_EXCEPTION


def create_groq_chat_completion(client, *, model: str, prompt: str, json_mode: bool):
    kwargs = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 450,
        "temperature": 0.7,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    return client.chat.completions.create(**kwargs)


def _call_groq(prompt: str, timeout_seconds: int) -> str:
    api_key, model = get_groq_companion_config()
    client = OpenAI(
        api_key=api_key,
        base_url=GROQ_OPENAI_BASE_URL,
        timeout=timeout_seconds,
        max_retries=0,
    )
    try:
        response = create_groq_chat_completion(
            client,
            model=model,
            prompt=prompt,
            json_mode=True,
        )
    except TypeError:
        response = create_groq_chat_completion(
            client,
            model=model,
            prompt=prompt,
            json_mode=False,
        )
    except Exception as error:
        if BadRequestError is not None and isinstance(error, BadRequestError):
            response = create_groq_chat_completion(
                client,
                model=model,
                prompt=prompt,
                json_mode=False,
            )
        else:
            raise

    text = extract_groq_output_text(response)
    if not text:
        raise GroqCompanionProviderError(
            REASON_EMPTY_OUTPUT,
            "Groq returned an empty response.",
        )
    return text


def call_groq_with_timeout(
    call,
    *,
    prompt_version: str,
    timeout_seconds: int,
) -> GroqCompanionProviderResponse:
    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(call)

    try:
        text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise GroqCompanionProviderError(REASON_TIMEOUT, latency_ms=latency_ms) from exc
    except GroqCompanionProviderError:
        executor.shutdown(wait=False, cancel_futures=True)
        raise
    except Exception as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise GroqCompanionProviderError(
            classify_groq_error(exc),
            latency_ms=latency_ms,
        ) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)
    return GroqCompanionProviderResponse(
        text=text,
        provider=PROVIDER_GROQ,
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )


def generate_life_companion_with_groq(
    prompt: str,
    prompt_version: str,
    timeout_seconds: int = 10,
) -> GroqCompanionProviderResponse:
    return call_groq_with_timeout(
        lambda: _call_groq(prompt, timeout_seconds),
        prompt_version=prompt_version,
        timeout_seconds=timeout_seconds,
    )
