import os
from typing import Any

try:
    from openai import (
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AsyncOpenAI,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    )
except ImportError:  # pragma: no cover - exercised only when dependency is absent.
    AsyncOpenAI = None
    AuthenticationError = PermissionDeniedError = NotFoundError = BadRequestError = None
    RateLimitError = APITimeoutError = APIConnectionError = APIStatusError = None


GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_COMPANION_MODEL = "llama-3.3-70b-versatile"
DEFAULT_MAX_TOKENS = 500
DEFAULT_TEMPERATURE = 0.7
DEFAULT_TIMEOUT_SECONDS = 20


class AIServiceError(Exception):
    """Base error for companion provider failures."""


class AIConfigurationError(AIServiceError):
    """Raised when local configuration prevents any provider call."""


class AIProviderError(AIServiceError):
    """Raised when the provider is configured but cannot return a reply."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip('"').strip("'") or None


def get_int_env(name: str, default: int) -> int:
    raw = get_env_value(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return max(1, parsed)


def get_float_env(name: str, default: float) -> float:
    raw = get_env_value(name)
    if raw is None:
        return default
    try:
        parsed = float(raw)
    except ValueError:
        return default
    return min(2.0, max(0.0, parsed))


def get_companion_model() -> str:
    return (
        get_env_value("GROQ_COMPANION_PRIMARY_MODEL")
        or get_env_value("GROQ_COMPANION_MODEL")
        or DEFAULT_COMPANION_MODEL
    )


def get_client() -> Any:
    if AsyncOpenAI is None:
        raise AIConfigurationError("OpenAI-compatible SDK is not installed.")

    api_key = get_env_value("GROQ_API_KEY")
    if not api_key:
        raise AIConfigurationError("GROQ_API_KEY is not configured.")

    base_url = get_env_value("GROQ_OPENAI_BASE_URL") or GROQ_OPENAI_BASE_URL
    timeout = get_int_env("GROQ_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)
    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout,
        max_retries=0,
    )


def normalize_history(history: list[dict]) -> list[dict]:
    messages: list[dict] = []
    for item in history:
        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        messages.append({"role": role, "content": content[:2000]})
    return messages


def extract_reply(response: Any) -> str:
    choices = getattr(response, "choices", None) or []
    for choice in choices:
        message = getattr(choice, "message", None)
        content = getattr(message, "content", None)
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def classify_provider_error(error: Exception) -> str:
    if AuthenticationError is not None and isinstance(error, AuthenticationError):
        return "authentication_failed"
    if PermissionDeniedError is not None and isinstance(error, PermissionDeniedError):
        return "permission_denied"
    if NotFoundError is not None and isinstance(error, NotFoundError):
        return "model_unavailable"
    if BadRequestError is not None and isinstance(error, BadRequestError):
        return "bad_provider_request"
    if RateLimitError is not None and isinstance(error, RateLimitError):
        return "rate_limited"
    if APITimeoutError is not None and isinstance(error, APITimeoutError):
        return "timeout"
    if APIConnectionError is not None and isinstance(error, APIConnectionError):
        return "connection_failed"
    if APIStatusError is not None and isinstance(error, APIStatusError):
        return f"provider_status_{getattr(error, 'status_code', 'unknown')}"
    return "provider_exception"


async def chat(*, system_prompt: str, history: list[dict]) -> str:
    messages = [
        {"role": "system", "content": system_prompt},
        *normalize_history(history),
    ]
    if len(messages) == 1:
        raise AIProviderError("empty_conversation_history")

    client = get_client()
    try:
        response = await client.chat.completions.create(
            model=get_companion_model(),
            messages=messages,
            temperature=get_float_env("GROQ_COMPANION_TEMPERATURE", DEFAULT_TEMPERATURE),
            max_tokens=get_int_env("GROQ_COMPANION_MAX_TOKENS", DEFAULT_MAX_TOKENS),
        )
    except Exception as error:
        raise AIProviderError(classify_provider_error(error)) from error

    reply = extract_reply(response)
    if not reply:
        raise AIProviderError("empty_provider_response")
    return reply

