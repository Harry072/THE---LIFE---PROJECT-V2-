from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from time import perf_counter


class AIGenerationError(Exception):
    def __init__(self, reason: str, message: str, latency_ms: int | None = None):
        super().__init__(message)
        self.reason = reason
        self.latency_ms = latency_ms


@dataclass
class ProviderResponse:
    text: str
    provider: str
    prompt_version: str
    latency_ms: int


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
        raise AIGenerationError("provider_error", str(exc), latency_ms) from exc

    executor.shutdown(wait=False, cancel_futures=True)
    latency_ms = int((perf_counter() - started) * 1000)
    return ProviderResponse(
        text=text,
        provider=provider,
        prompt_version=prompt_version,
        latency_ms=latency_ms,
    )

