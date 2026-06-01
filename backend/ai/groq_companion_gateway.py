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
GROQ_FAST_COMPANION_MODEL = "llama-3.1-8b-instant"
GROQ_QUALITY_COMPANION_MODEL = "llama-3.3-70b-versatile"

REASON_AUTH_FAILED = "authentication_failed"
REASON_DEPENDENCY_MISSING = "provider_dependency_missing"
REASON_MODEL_UNAVAILABLE = "model_unavailable"
REASON_TIMEOUT = "provider_timeout"
REASON_UNAVAILABLE = "provider_unavailable"
REASON_RATE_LIMITED = "provider_rate_limited"
REASON_QUOTA = "provider_quota_exceeded"
REASON_EMPTY_OUTPUT = "empty_provider_response"
REASON_PROVIDER_EXCEPTION = "provider_exception"

GROQ_MODEL_FALLBACK_REASONS = {
    REASON_MODEL_UNAVAILABLE,
    REASON_TIMEOUT,
    REASON_UNAVAILABLE,
    REASON_RATE_LIMITED,
    REASON_QUOTA,
    REASON_EMPTY_OUTPUT,
    REASON_PROVIDER_EXCEPTION,
}


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


def is_8b_model(model: str) -> bool:
    cleaned = str(model or "").lower()
    return "8b" in cleaned


def unique_model_order(models: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for model in models:
        cleaned = str(model or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        ordered.append(cleaned)
    return ordered


def get_groq_companion_model_order(*, prefer_quality: bool = False) -> list[str]:
    explicit_order = get_env_value("GROQ_COMPANION_MODEL_ORDER")
    if explicit_order:
        return unique_model_order([part.strip() for part in explicit_order.split(",")])

    configured_model = get_env_value("GROQ_COMPANION_MODEL") or GROQ_FAST_COMPANION_MODEL
    if not prefer_quality:
        return [configured_model]

    fallback_model = get_env_value("GROQ_COMPANION_FALLBACK_MODEL") or configured_model
    if not is_8b_model(configured_model):
        primary_model = get_env_value("GROQ_COMPANION_PRIMARY_MODEL") or configured_model
    else:
        primary_model = get_env_value("GROQ_COMPANION_PRIMARY_MODEL") or GROQ_QUALITY_COMPANION_MODEL

    return unique_model_order([primary_model, fallback_model])


def get_groq_companion_config(*, prefer_quality: bool = False) -> tuple[str, list[str]]:
    api_key = get_env_value("GROQ_API_KEY")
    models = get_groq_companion_model_order(prefer_quality=prefer_quality)
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
    return api_key, models


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


def create_groq_chat_completion(client, *, model: str, messages: list[dict], json_mode: bool):
    kwargs = {
        "model": model,
        "messages": messages,
        "max_tokens": 500,
        "temperature": 0.7,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    return client.chat.completions.create(**kwargs)


def create_completion_for_model(client, *, model: str, messages: list[dict]):
    try:
        return create_groq_chat_completion(
            client,
            model=model,
            messages=messages,
            json_mode=True,
        )
    except TypeError:
        return create_groq_chat_completion(
            client,
            model=model,
            messages=messages,
            json_mode=False,
        )
    except Exception as error:
        if BadRequestError is not None and isinstance(error, BadRequestError):
            return create_groq_chat_completion(
                client,
                model=model,
                messages=messages,
                json_mode=False,
            )
        raise


def _call_groq_messages(
    messages: list[dict],
    timeout_seconds: int,
    *,
    prefer_quality: bool = False,
    fallback_timeout_seconds: int = 7,
) -> str:
    api_key, model_order = get_groq_companion_config(prefer_quality=prefer_quality)

    last_error: Exception | None = None
    for index, model in enumerate(model_order):
        # Use shorter timeout for fallback (8B) models to stay under Render's 30s limit
        is_fallback_model = index > 0 or is_8b_model(model)
        effective_timeout = fallback_timeout_seconds if is_fallback_model else timeout_seconds
        client = OpenAI(
            api_key=api_key,
            base_url=GROQ_OPENAI_BASE_URL,
            timeout=effective_timeout,
            max_retries=0,
        )
        call_started = perf_counter()
        try:
            response = create_completion_for_model(
                client,
                model=model,
                messages=messages,
            )
            text = extract_groq_output_text(response)
            if not text:
                raise GroqCompanionProviderError(
                    REASON_EMPTY_OUTPUT,
                    "Groq returned an empty response.",
                )
            latency_ms = int((perf_counter() - call_started) * 1000)
            print(f"COMPANION_RESPONSE model={model} latency_ms={latency_ms}")
            return text
        except GroqCompanionProviderError as error:
            last_error = error
            should_fallback = (
                index < len(model_order) - 1
                and error.reason in GROQ_MODEL_FALLBACK_REASONS
            )
            if should_fallback:
                print(f"COMPANION_70B_FAILED reason={error.reason} falling_back_to_8b")
                continue
            raise
        except Exception as error:
            last_error = error
            reason = classify_groq_error(error)
            should_fallback = (
                index < len(model_order) - 1
                and reason in GROQ_MODEL_FALLBACK_REASONS
            )
            if should_fallback:
                print(f"COMPANION_70B_FAILED reason={reason} falling_back_to_8b")
                continue
            raise

    if last_error:
        raise last_error
    raise GroqCompanionProviderError(REASON_UNAVAILABLE)


def _call_groq(prompt: str, timeout_seconds: int) -> str:
    return _call_groq_messages(
        [{"role": "user", "content": prompt}],
        timeout_seconds,
        prefer_quality=False,
    )


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


def generate_life_companion_with_groq_messages(
    messages: list[dict],
    prompt_version: str,
    timeout_seconds: int = 15,
) -> GroqCompanionProviderResponse:
    return call_groq_with_timeout(
        lambda: _call_groq_messages(
            messages,
            timeout_seconds,
            prefer_quality=True,
        ),
        prompt_version=prompt_version,
        timeout_seconds=(timeout_seconds * 2) + 2,
    )


def summarize_companion_session(conversation_history: list[dict]) -> dict:
    """
    Summarizes a completed companion session using Groq at low temperature.
    Returns structured dict: primary_emotion, main_topic, key_insight,
    pattern_signal, notable_context.
    """
    import json as _json
    from ai.prompts import SESSION_SUMMARY_PROMPT

    if not conversation_history:
        return {
            "primary_emotion": "unknown",
            "main_topic": "no conversation",
            "key_insight": "session was empty",
            "pattern_signal": "none",
            "notable_context": "",
        }

    # Build a compact conversation text for summarization
    conv_text = _json.dumps([
        {"role": t.get("role", "user"), "content": str(t.get("content", ""))[:300]}
        for t in conversation_history
        if isinstance(t, dict)
    ])

    try:
        api_key, _ = get_groq_companion_config(prefer_quality=True)
        client = OpenAI(
            api_key=api_key,
            base_url=GROQ_OPENAI_BASE_URL,
            timeout=12,
            max_retries=0,
        )
        response = client.chat.completions.create(
            model=GROQ_QUALITY_COMPANION_MODEL,
            messages=[
                {"role": "system", "content": SESSION_SUMMARY_PROMPT},
                {"role": "user", "content": conv_text},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        raw = extract_groq_output_text(response).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return _json.loads(raw)
    except Exception as exc:
        print(f"SESSION_SUMMARIZER error={exc!r}")
        return {
            "primary_emotion": "unknown",
            "main_topic": "summary failed",
            "key_insight": "could not extract",
            "pattern_signal": "none",
            "notable_context": "",
        }
