from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field
import os
from time import perf_counter

from ai.fallbacks import generate_life_companion_fallback
from ai.groq_companion_gateway import (
    GroqCompanionProviderError,
    generate_life_companion_with_groq,
)
from ai.validator import LifeCompanionValidationError, validate_life_companion_response

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


PROVIDER_OPENAI = "openai"
PROVIDER_GROQ = "groq"
PROVIDER_FALLBACK = "fallback"

REASON_AUTH_FAILED = "authentication_failed"
REASON_DEPENDENCY_MISSING = "provider_dependency_missing"
REASON_MODEL_UNAVAILABLE = "model_unavailable"
REASON_TIMEOUT = "provider_timeout"
REASON_UNAVAILABLE = "provider_unavailable"
REASON_RATE_LIMITED = "provider_rate_limited"
REASON_QUOTA = "provider_quota_exceeded"
REASON_EMPTY_OUTPUT = "empty_provider_response"
REASON_PROVIDER_EXCEPTION = "provider_exception"
REASON_INVALID_JSON = "invalid_json"
REASON_VALIDATOR_FAILED = "validator_failed"
REASON_UNSAFE_OUTPUT = "unsafe_output"
REASON_INVALID_ACTION_TYPE = "invalid_action_type"
REASON_INVALID_ACTION_ROUTE = "invalid_action_route"

OPENAI_TO_GROQ_FAILURE_REASONS = {
    REASON_QUOTA,
    REASON_RATE_LIMITED,
    REASON_TIMEOUT,
    REASON_UNAVAILABLE,
    REASON_MODEL_UNAVAILABLE,
    REASON_PROVIDER_EXCEPTION,
}

OPENAI_TO_GROQ_VALIDATION_REASONS = {
    REASON_INVALID_JSON,
    REASON_VALIDATOR_FAILED,
    REASON_UNSAFE_OUTPUT,
    REASON_INVALID_ACTION_TYPE,
    REASON_INVALID_ACTION_ROUTE,
}


class CompanionProviderError(Exception):
    def __init__(
        self,
        reason: str,
        message: str = "Life Companion provider failed.",
        latency_ms: int | None = None,
    ):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms


@dataclass
class CompanionProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


@dataclass
class CompanionProviderAttempt:
    provider: str
    failure_class: str | None = None
    validation_failure_reason: str | None = None
    output_present: bool = False
    validation_pass: bool = False
    latency_ms: int | None = None
    validation_ms: int | None = None


@dataclass
class CompanionGatewayResult:
    status: str
    companion_response: dict
    provider: str
    final_response_mode: str
    latency_ms: int | None = None
    provider_ms: int | None = None
    validation_ms: int | None = None
    fallback_reason: str | None = None
    error_reason: str | None = None
    validation_failure_reason: str | None = None
    attempts: list[CompanionProviderAttempt] = field(default_factory=list)


def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip("\"").strip("'") or None


def get_companion_provider_order() -> list[str]:
    return [PROVIDER_OPENAI, PROVIDER_GROQ]


def get_env_bool(name: str, default: bool = False) -> bool:
    value = get_env_value(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def allow_groq_fallback_for_openai_auth_failure() -> bool:
    return get_env_bool("LIFE_COMPANION_ALLOW_AUTH_FALLBACK_TO_GROQ", False)


def get_openai_companion_config() -> tuple[str, str]:
    api_key = get_env_value("OPENAI_API_KEY")
    model = get_env_value("OPENAI_COMPANION_MODEL") or "gpt-5.5-mini"
    if not api_key:
        raise CompanionProviderError(REASON_UNAVAILABLE, "OpenAI API key is not configured.")
    if OpenAI is None:
        raise CompanionProviderError(REASON_UNAVAILABLE, "OpenAI SDK is not installed.")
    return api_key, model


def get_value(item, name: str):
    if isinstance(item, dict):
        return item.get(name)
    return getattr(item, name, None)


def extract_openai_output_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output_items = getattr(response, "output", None) or []
    text_parts: list[str] = []
    for item in output_items:
        content_items = get_value(item, "content") or []
        for content_item in content_items:
            text = get_value(content_item, "text")
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())

    return "\n".join(text_parts).strip()


def classify_openai_error(error: Exception) -> str:
    if AuthenticationError is not None and isinstance(error, AuthenticationError):
        return REASON_AUTH_FAILED
    if PermissionDeniedError is not None and isinstance(error, PermissionDeniedError):
        return REASON_AUTH_FAILED
    if NotFoundError is not None and isinstance(error, NotFoundError):
        return REASON_MODEL_UNAVAILABLE
    if BadRequestError is not None and isinstance(error, BadRequestError):
        return REASON_MODEL_UNAVAILABLE
    if RateLimitError is not None and isinstance(error, RateLimitError):
        message = str(error).lower()
        if "insufficient_quota" in message or "quota" in message or "billing" in message:
            return REASON_QUOTA
        return REASON_RATE_LIMITED
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
        if status_code == 429:
            return REASON_QUOTA if "quota" in str(error).lower() else REASON_RATE_LIMITED
        if status_code in {500, 502, 503, 504}:
            return REASON_UNAVAILABLE
    return REASON_PROVIDER_EXCEPTION


def _call_openai(prompt: str, timeout_seconds: int) -> str:
    api_key, model = get_openai_companion_config()
    client = OpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=0)
    try:
        response = client.responses.create(
            model=model,
            input=prompt,
            text={"format": {"type": "json_object"}},
            max_output_tokens=450,
            store=False,
        )
    except (TypeError, BadRequestError):
        response = client.responses.create(
            model=model,
            input=prompt,
            max_output_tokens=450,
            store=False,
        )
    text = extract_openai_output_text(response)
    if not text:
        raise CompanionProviderError(REASON_EMPTY_OUTPUT, "OpenAI returned an empty response.")
    return text


def generate_life_companion_with_openai(
    prompt: str,
    prompt_version: str,
    timeout_seconds: int = 10,
) -> CompanionProviderResponse:
    return call_provider_with_timeout(
        PROVIDER_OPENAI,
        lambda: _call_openai(prompt, timeout_seconds),
        prompt_version=prompt_version,
        timeout_seconds=timeout_seconds,
    )


def normalize_life_companion_validation_failure(reason: str) -> str:
    cleaned = str(reason or "").strip().lower()
    if cleaned.startswith(REASON_INVALID_JSON):
        return REASON_INVALID_JSON
    if cleaned == REASON_INVALID_ACTION_TYPE:
        return REASON_INVALID_ACTION_TYPE
    if cleaned == REASON_INVALID_ACTION_ROUTE:
        return REASON_INVALID_ACTION_ROUTE
    if cleaned.startswith("unsafe_"):
        return REASON_UNSAFE_OUTPUT
    return REASON_VALIDATOR_FAILED


def log_companion_provider_call(*, provider: str, timeout_seconds: int) -> None:
    print(
        "LIFE_COMPANION_PROVIDER_CALL "
        "provider_called=true "
        f"provider={provider} "
        f"timeout_seconds={timeout_seconds}"
    )


def call_provider_with_timeout(
    provider: str,
    call,
    *,
    prompt_version: str,
    timeout_seconds: int,
) -> CompanionProviderResponse:
    started = perf_counter()
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(call)

    try:
        text = future.result(timeout=timeout_seconds)
    except TimeoutError as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        executor.shutdown(wait=False, cancel_futures=True)
        raise CompanionProviderError(REASON_TIMEOUT, latency_ms=latency_ms) from exc
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
        provider=provider,
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )


def attempt_provider(
    provider: str,
    *,
    prompt: str,
    prompt_version: str,
) -> tuple[dict | None, CompanionProviderAttempt]:
    attempt = CompanionProviderAttempt(provider=provider)
    try:
        if provider == PROVIDER_OPENAI:
            log_companion_provider_call(provider=provider, timeout_seconds=10)
            provider_response = generate_life_companion_with_openai(
                prompt,
                prompt_version=prompt_version,
            )
        elif provider == PROVIDER_GROQ:
            log_companion_provider_call(provider=provider, timeout_seconds=10)
            try:
                provider_response = generate_life_companion_with_groq(
                    prompt,
                    prompt_version=prompt_version,
                )
            except GroqCompanionProviderError as error:
                raise CompanionProviderError(
                    error.reason,
                    latency_ms=error.latency_ms,
                ) from error
        else:
            raise CompanionProviderError(REASON_UNAVAILABLE)

        attempt.latency_ms = provider_response.latency_ms
        attempt.output_present = bool(provider_response.text.strip())
        validation_started = perf_counter()
        try:
            companion_response = validate_life_companion_response(provider_response.text)
        finally:
            attempt.validation_ms = int((perf_counter() - validation_started) * 1000)
        attempt.validation_pass = True
        return companion_response, attempt
    except LifeCompanionValidationError as error:
        attempt.validation_failure_reason = normalize_life_companion_validation_failure(error.reason)
        attempt.failure_class = attempt.validation_failure_reason
        attempt.validation_pass = False
        attempt.output_present = True
        return None, attempt
    except CompanionProviderError as error:
        attempt.failure_class = error.reason
        attempt.latency_ms = error.latency_ms
        return None, attempt


def should_try_groq_after_openai_attempt(attempt: CompanionProviderAttempt) -> bool:
    if attempt.validation_failure_reason:
        return attempt.validation_failure_reason in OPENAI_TO_GROQ_VALIDATION_REASONS
    if attempt.failure_class == REASON_AUTH_FAILED:
        return allow_groq_fallback_for_openai_auth_failure()
    return attempt.failure_class in OPENAI_TO_GROQ_FAILURE_REASONS


def log_companion_provider_summary(
    *,
    provider_order: list[str],
    selected_provider: str,
    attempts: list[CompanionProviderAttempt],
    final_response_mode: str,
    latency_ms: int,
) -> None:
    failure_class = ";".join(
        f"{attempt.provider}:{attempt.failure_class or 'none'}"
        for attempt in attempts
        if attempt.failure_class
    ) or "none"
    output_present = any(attempt.output_present for attempt in attempts)
    validation_pass = any(attempt.validation_pass for attempt in attempts)
    provider_ms = sum(attempt.latency_ms or 0 for attempt in attempts)
    validation_ms = sum(attempt.validation_ms or 0 for attempt in attempts)
    validation_failure_reason = ";".join(
        f"{attempt.provider}:{attempt.validation_failure_reason}"
        for attempt in attempts
        if attempt.validation_failure_reason
    ) or "none"
    print(
        "LIFE_COMPANION_PROVIDER "
        f"provider_attempt_order={','.join(provider_order)} "
        f"provider_selected={selected_provider} "
        f"provider_failure_class={failure_class} "
        f"output_present={output_present} "
        f"output_text_present={output_present} "
        f"validation_pass={validation_pass} "
        f"validation_failure_reason={validation_failure_reason} "
        f"final_response_mode={final_response_mode} "
        f"provider_ms={provider_ms} "
        f"validation_ms={validation_ms} "
        f"latency_ms={latency_ms}"
    )


def generate_life_companion_response(
    *,
    prompt: str,
    prompt_version: str,
    mode: str,
    context: dict | None,
    user_message: str,
) -> CompanionGatewayResult:
    started = perf_counter()
    provider_order = get_companion_provider_order()
    attempts: list[CompanionProviderAttempt] = []

    for provider in provider_order:
        if provider == PROVIDER_GROQ and attempts:
            openai_attempt = attempts[-1]
            if (
                openai_attempt.provider == PROVIDER_OPENAI
                and not should_try_groq_after_openai_attempt(openai_attempt)
            ):
                break
        companion_response, attempt = attempt_provider(
            provider,
            prompt=prompt,
            prompt_version=prompt_version,
        )
        attempts.append(attempt)
        if companion_response:
            latency_ms = int((perf_counter() - started) * 1000)
            provider_ms = sum(item.latency_ms or 0 for item in attempts)
            validation_ms = sum(item.validation_ms or 0 for item in attempts)
            final_response_mode = f"live_{provider}"
            log_companion_provider_summary(
                provider_order=provider_order,
                selected_provider=provider,
                attempts=attempts,
                final_response_mode=final_response_mode,
                latency_ms=latency_ms,
            )
            return CompanionGatewayResult(
                status="success",
                companion_response=companion_response,
                provider=provider,
                final_response_mode=final_response_mode,
                latency_ms=latency_ms,
                provider_ms=provider_ms,
                validation_ms=validation_ms,
                attempts=attempts,
            )

    fallback_response = generate_life_companion_fallback(
        mode,
        context,
        user_message=user_message,
    )
    latency_ms = int((perf_counter() - started) * 1000)
    validation_failed = any(attempt.validation_failure_reason for attempt in attempts)
    first_failure = next((attempt.failure_class for attempt in attempts if attempt.failure_class), None)
    first_validation_failure = next(
        (attempt.validation_failure_reason for attempt in attempts if attempt.validation_failure_reason),
        None,
    )
    fallback_reason = first_validation_failure if validation_failed else first_failure
    provider_ms = sum(attempt.latency_ms or 0 for attempt in attempts)
    validation_ms = sum(attempt.validation_ms or 0 for attempt in attempts)
    log_companion_provider_summary(
        provider_order=provider_order,
        selected_provider=PROVIDER_FALLBACK,
        attempts=attempts,
        final_response_mode=PROVIDER_FALLBACK,
        latency_ms=latency_ms,
    )
    return CompanionGatewayResult(
        status="fallback",
        companion_response=fallback_response,
        provider=PROVIDER_FALLBACK,
        final_response_mode=PROVIDER_FALLBACK,
        latency_ms=latency_ms,
        provider_ms=provider_ms,
        validation_ms=validation_ms,
        fallback_reason=fallback_reason or REASON_UNAVAILABLE,
        error_reason=first_failure if not validation_failed else None,
        validation_failure_reason=first_validation_failure if validation_failed else None,
        attempts=attempts,
    )
