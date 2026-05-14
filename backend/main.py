import json as _json
import re as _re
from pathlib import Path
from datetime import datetime
from time import perf_counter
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as legacy_genai
from google import genai as google_genai

from ai.context import (
    ALLOWED_LOOP_CATEGORIES,
    CORE_CATEGORY_ORDER,
    build_generation_context,
    build_life_companion_context,
    build_weekly_mirror_context,
    normalize_category,
)
from ai.companion_knowledge import (
    detect_companion_intent,
    extract_request_slots,
    retrieve_companion_knowledge,
)
from ai.fallbacks import (
    generate_fallback_tasks,
    generate_fallback_weekly_mirror,
    generate_insufficient_weekly_mirror,
    generate_life_companion_crisis_response,
    generate_life_companion_fallback,
    get_execution_engine_fallback,
)
from ai.companion_gateway import (
    generate_life_companion_response,
)
from ai.gateway import (
    AIGenerationError,
    build_gemini_diagnosis,
    generate_loop_tasks_with_gemini,
    generate_with_gemini,
)
from ai.prompts import (
    LOOP_TASKS_PROMPT_VERSION,
    LIFE_COMPANION_PROMPT_VERSION,
    WEEKLY_MIRROR_PROMPT_VERSION,
    EXECUTION_ENGINE_PROMPT_VERSION,
    build_life_companion_prompt,
    build_loop_tasks_prompt,
    build_weekly_mirror_prompt,
    build_execution_engine_prompt,
)
from ai.groq_companion_gateway import (
    GroqCompanionProviderError,
    generate_life_companion_with_groq,
)
from ai.validator import (
    LifeCompanionValidationError,
    TaskValidationError,
    WeeklyMirrorValidationError,
    detect_life_companion_safety,
    normalize_task_for_insert,
    validate_life_companion_message,
    validate_life_companion_mode,
    validate_ai_tasks,
    validate_weekly_mirror_synthesis,
)

# Initialize local .env before configuring middleware or clients.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


def get_cors_origins() -> list[str]:
    configured_origins = os.environ.get("CORS_ORIGINS")
    if not configured_origins:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    origins = [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip("\"").strip("'")


supabase_url = get_env_value("SUPABASE_URL")
supabase_key = (
    get_env_value("SUPABASE_SERVICE_ROLE_KEY")
    or get_env_value("SUPABASE_KEY")
)

if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

supabase: Client = create_client(supabase_url, supabase_key)

# Initialize Gemini
gemini_model_name = get_env_value("GEMINI_MODEL") or "gemini-2.5-flash"
gemini_api_key = get_env_value("GEMINI_API_KEY")
google_api_key = get_env_value("GOOGLE_API_KEY")
effective_gemini_api_key = google_api_key or gemini_api_key
effective_gemini_key_source = (
    "GOOGLE_API_KEY"
    if google_api_key
    else ("GEMINI_API_KEY" if gemini_api_key else "none")
)
gemini_model = None
loop_gemini_client = None

if gemini_api_key:
    legacy_genai.configure(api_key=gemini_api_key)
    gemini_model = legacy_genai.GenerativeModel(gemini_model_name)
else:
    print(
        "AI_TASK_GENERATION "
        "provider_unavailable=true provider=gemini "
        "reason=missing_gemini_api_key"
    )

if effective_gemini_api_key:
    loop_gemini_client = google_genai.Client(api_key=effective_gemini_api_key)
    if google_api_key and gemini_api_key:
        print(
            "AI_TASK_GENERATION "
            "key_precedence=GOOGLE_API_KEY "
            "gemini_api_key_present=true google_api_key_present=true"
        )
else:
    print(
        "AI_TASK_GENERATION "
        "provider_unavailable=true provider=google_genai "
        "reason=missing_gemini_or_google_api_key"
    )

# 2. SCHEMA FIX: Receive the exact identity and date from React
RECALIBRATE_TAG_OVERRIDES: dict[str, dict] = {
    "deep_work": {
        "context_note": (
            "User wants deep, focused cognitive work today. "
            "Prioritize the action category with a 25–45 min high-focus task requiring full presence. "
            "Avoid light or gentle tasks. All three tasks should demand intentional effort."
        ),
        "adaptation_mode": "stretch_slightly",
        "suggested_intensity": "deeper",
    },
    "mental_reset": {
        "context_note": (
            "User needs lighter, restorative tasks that lower mental volume without adding pressure. "
            "Prioritize gentle awareness. Avoid heavy reading, complex planning, or demanding effort. "
            "Tasks should feel like relief, not obligation."
        ),
        "adaptation_mode": "simplify",
        "suggested_intensity": "gentle",
    },
    "physical_action": {
        "context_note": (
            "User wants to move their body and take real-world physical action. "
            "Prioritize movement: walks, stretches, environment changes, hands-on work. "
            "Reduce screen-based suggestions. At least two tasks should involve the body or physical space."
        ),
        "adaptation_mode": "steady",
        "suggested_intensity": "normal",
    },
}


class TaskRequest(BaseModel):
    user_id: str
    local_date: str
    struggles: list[str] = Field(default_factory=list)
    current_streak: int = 0
    regenerate: bool = False
    recalibrate_tag: str | None = None
    allow_safe_fallback: bool = False


ALLOWED_PAIN_POINTS: set[str] = {
    "I can't stop scrolling",
    "I feel lost",
    "I overthink everything",
    "I have no motivation",
    "I can't sleep",
    "I feel empty inside",
    "I keep starting and quitting",
    "I don't know who I am",
    "I feel completely alone",
}

LOOP_TASK_OPTIONAL_INSERT_COLUMNS: set[str] = {
    "detail_title",
    "detail_description",
    "inline_quote",
    "generation_provider",
    "generation_model",
    "generation_prompt_version",
    "generation_failure_reason",
    "completion_state",
    "difficulty_level",
    "success_condition",
    "smaller_version",
    "post_completion_question",
    "framework_key",
}
_loop_task_missing_optional_insert_columns: set[str] | None = None


class ExecutionEngineRequest(BaseModel):
    user_id: str
    pain_point: str
    completed_tasks_count: int = Field(default=0, ge=0)
    recent_tasks: list[str] = Field(default_factory=list)


class WeeklySynthesisRequest(BaseModel):
    user_id: str
    week_start: str
    week_end: str


class LifeCompanionRequest(BaseModel):
    user_id: str | None = None
    mode: str
    message: str
    conversation_id: str | None = None


class CompanionConversationCreateRequest(BaseModel):
    title: str | None = None


class LoopTaskFeedbackRequest(BaseModel):
    user_id: str | None = None
    completion_state: str = "done"
    post_action_mood: str | None = None
    mood_before: str | None = None
    mood_after: str | None = None
    task_friction_level: str | None = None
    skip_reason_label: str | None = None


class ResetSessionMetadataRequest(BaseModel):
    user_id: str | None = None
    session_id: str | None = None
    session_title: str | None = None
    session_type: str | None = None
    session_category: str | None = None
    reset_need: str | None = None
    duration_seconds: int | None = None
    mood_after: str | None = None
    mood_after_reset: str | None = None
    reflection_tag: str | None = None
    reset_reflection_tag: str | None = None


class CuratorInteractionRequest(BaseModel):
    user_id: str | None = None
    book_id: str | None = None
    path_slug: str | None = None
    action_type: str
    duration_seconds: int | None = None


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Authorization bearer token required")

    return parts[1].strip()


def validate_supabase_access_token(authorization: str | None) -> str:
    token = extract_bearer_token(authorization)

    try:
        user_response = supabase.auth.get_user(token)
    except Exception as auth_error:
        print(
            "AUTH_VALIDATION_FAILED "
            f"reason=invalid_token error_type={type(auth_error).__name__}"
        )
        raise HTTPException(status_code=401, detail="Invalid or expired session") from auth_error

    auth_user = getattr(user_response, "user", None)
    user_id = getattr(auth_user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return str(user_id)


def sort_task_rows(rows: list[dict]) -> list[dict]:
    def sort_key(row: dict):
        sort_order = row.get("sort_order")
        try:
            sort_order_value = int(sort_order)
        except (TypeError, ValueError):
            sort_order_value = 999

        return (
            sort_order_value,
            str(row.get("created_at") or ""),
            str(row.get("id") or ""),
        )

    return sorted(rows, key=sort_key)


def is_completed_task(row: dict) -> bool:
    return bool(row.get("completed_at") or row.get("done"))


def is_core_task(row: dict) -> bool:
    category = normalize_category(row.get("category"))
    return (
        category in ALLOWED_LOOP_CATEGORIES
        and not bool(row.get("is_optional"))
    )


def fetch_today_core_tasks(user_id: str, local_date: str) -> list[dict]:
    response = (
        supabase.table("loop_tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("for_date", local_date)
        .execute()
    )
    return sort_task_rows([
        row for row in (response.data or [])
        if is_core_task(row)
    ])


def delete_uncompleted_generated_core_tasks(user_id: str, local_date: str) -> None:
    for category in CORE_CATEGORY_ORDER:
        (
            supabase.table("loop_tasks")
            .delete()
            .eq("user_id", user_id)
            .eq("for_date", local_date)
            .eq("category", category)
            .eq("is_optional", False)
            .eq("done", False)
            .filter("completed_at", "is", "null")
            .execute()
        )


def log_generation_event(
    *,
    status: str,
    provider: str = "gemini",
    prompt_version: str = LOOP_TASKS_PROMPT_VERSION,
    latency_ms: int | None = None,
    validation_failure_reason: str | None = None,
    error_reason: str | None = None,
    diagnosis: dict | None = None,
    context: dict | None = None,
) -> None:
    context_used = ",".join((context or {}).get("context_used") or []) or "none"
    streak_band = (context or {}).get("streak_band") or "n/a"
    completion_pattern = (context or {}).get("completion_pattern") or "n/a"
    suggested_intensity = (context or {}).get("suggested_intensity") or "n/a"
    latest_mood_present = bool((context or {}).get("latest_mood"))
    diagnosis_reason = (diagnosis or {}).get("reason") or "none"
    effective_key_source = (diagnosis or {}).get("effective_key_source") or effective_gemini_key_source
    gemini_key_present = (diagnosis or {}).get("gemini_api_key_present")
    google_key_present = (diagnosis or {}).get("google_api_key_present")
    print(
        "AI_TASK_GENERATION "
        f"status={status} "
        f"provider={provider} "
        f"prompt_version={prompt_version} "
        f"context_used={context_used} "
        f"streak_band={streak_band} "
        f"completion_pattern={completion_pattern} "
        f"suggested_intensity={suggested_intensity} "
        f"latest_mood_present={latest_mood_present} "
        f"latency_ms={latency_ms if latency_ms is not None else 'n/a'} "
        f"validation_failure_reason={validation_failure_reason or 'none'} "
        f"error_reason={error_reason or 'none'} "
        f"diagnosis_reason={diagnosis_reason} "
        f"effective_key_source={effective_key_source} "
        f"gemini_api_key_present={gemini_key_present if gemini_key_present is not None else bool(gemini_api_key)} "
        f"google_api_key_present={google_key_present if google_key_present is not None else bool(google_api_key)}"
    )


def build_response_meta(
    context: dict | None = None,
    *,
    cached: bool = False,
    extra: dict | None = None,
) -> dict:
    meta = {
        "prompt_version": LOOP_TASKS_PROMPT_VERSION,
        "personalization_level": "lite",
        "context_used": ["cache"] if cached else (context or {}).get("context_used", []),
    }
    if extra:
        meta.update(extra)
    return meta


def build_task_response(
    status: str,
    rows: list[dict],
    context: dict | None = None,
    *,
    cached: bool = False,
    meta_extra: dict | None = None,
) -> dict:
    return {
        "status": status,
        "data": rows,
        "meta": build_response_meta(context, cached=cached, extra=meta_extra),
    }


def build_retryable_task_failure_response(
    *,
    context: dict,
    reason: str,
    diagnosis: dict | None = None,
    latency_ms: int | None = None,
) -> dict:
    safe_diagnosis = dict(diagnosis or {})
    safe_diagnosis.setdefault("reason", reason)
    safe_diagnosis.setdefault("effective_key_source", effective_gemini_key_source)
    safe_diagnosis.setdefault("gemini_api_key_present", bool(gemini_api_key))
    safe_diagnosis.setdefault("google_api_key_present", bool(google_api_key))
    return build_task_response(
        "retryable_ai_failure",
        [],
        context,
        meta_extra={
            "retryable": True,
            "fallback_allowed_on_retry": True,
            "provider": "gemini",
            "model": gemini_model_name,
            "error_reason": reason,
            "diagnosis": safe_diagnosis,
            "latency_ms": latency_ms,
            "message": (
                "We could not prepare today's AI tasks yet. Try once more; "
                "if Gemini still cannot respond, we will create a small safe plan for today."
            ),
        },
    )


def parse_iso_date_strict(value: str, field_name: str):
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be YYYY-MM-DD",
        ) from exc


def validate_week_range(week_start: str, week_end: str) -> tuple[str, str]:
    start_date = parse_iso_date_strict(week_start, "week_start")
    end_date = parse_iso_date_strict(week_end, "week_end")
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="week_end must be after week_start")
    if (end_date - start_date).days > 6:
        raise HTTPException(status_code=400, detail="Weekly Mirror range cannot exceed 7 days")
    return start_date.isoformat(), end_date.isoformat()


SAFE_MOOD_LABELS = {
    "clear",
    "clearer",
    "focused",
    "proud",
    "soft",
    "softer",
    "quiet",
    "heavy",
    "still_heavy",
    "restless",
    "grateful",
    "hopeful",
    "numb",
    "low",
    "tired",
    "anxious",
    "overwhelmed",
    "drained",
    # Phase 6C reset ritual moods
    "calmer",
    "sleepy",
}
TASK_FRICTION_LEVELS = {"too_easy", "right_sized", "too_heavy"}
COMPLETION_STATES = {"pending", "done", "skipped", "partial"}
SKIP_REASON_LABELS = {
    "too_heavy",
    "no_time",
    "forgot",
    "not_relevant",
    "low_energy",
    "unclear",
}
RESET_REFLECTION_TAGS = {
    "less_pressure",
    "less_noise",
    "less_screen",
    "less_rushing",
    "less_self_criticism",
    "more_rest",
    "more_clarity",
    # Phase 6C ritual tags
    "noise",
    "pressure",
    "overthinking",
    "scrolling",
    "loneliness",
    "nothing_clear",
}
NEXT_STEP_TYPES = {"loop", "reset", "rest", "reflection", "none"}
CURATOR_ACTION_TYPES = {
    "path_opened",
    "book_opened",
    "book_saved",
    "book_removed",
    "find_book_opened",
}


def normalize_metadata_label(
    value: object,
    *,
    allowed: set[str],
    field_name: str,
    required: bool = False,
) -> str | None:
    if value is None or str(value).strip() == "":
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None

    cleaned = (
        str(value)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )
    cleaned = "".join(char for char in cleaned if char.isalnum() or char == "_")[:48]
    if not cleaned:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    if cleaned not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return cleaned


def clean_metadata_text(value: object, *, max_chars: int = 80) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    cleaned = " ".join(str(value).strip().split())
    cleaned = "".join(
        char
        for char in cleaned
        if char.isalnum() or char in {"-", "_", " ", "."}
    )
    return cleaned[:max_chars].strip() or None


def clamp_duration_seconds(value: int | None) -> int | None:
    if value is None:
        return None
    try:
        duration = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="duration_seconds must be a number") from exc
    if duration < 0:
        raise HTTPException(status_code=400, detail="duration_seconds cannot be negative")
    return min(duration, 24 * 60 * 60)


def validate_request_user(token_user_id: str, request_user_id: str | None) -> None:
    if request_user_id and str(request_user_id) != token_user_id:
        raise HTTPException(status_code=403, detail="Session user does not match request user")


def is_insufficient_weekly_data(context: dict) -> bool:
    data_points = context.get("data_points") or {}
    reflection_count = int(data_points.get("reflections") or 0)
    task_count = int(data_points.get("tasks") or 0)
    meaningful_count = int(context.get("meaningful_data_points") or 0)
    return (reflection_count == 0 and task_count == 0) or meaningful_count < 2


def build_weekly_response(
    status: str,
    synthesis: dict,
    context: dict,
    *,
    fallback_used: bool,
) -> dict:
    return {
        "status": status,
        "synthesis": synthesis,
        "mirror_insight": synthesis,
        "meta": {
            "prompt_version": WEEKLY_MIRROR_PROMPT_VERSION,
            "fallback_used": fallback_used,
            "data_points": context.get("data_points") or {"reflections": 0, "tasks": 0},
        },
    }


def build_life_companion_response(
    status: str,
    companion_response: dict,
    *,
    meta: dict | None = None,
    conversation_id: str | None = None,
    conversation: dict | None = None,
) -> dict:
    response = {
        "status": status,
        "reply": companion_response.get("reply") or "",
        "suggested_action": companion_response.get("suggested_action") or {
            "type": "none",
            "label": "",
            "route": None,
        },
        "tone": companion_response.get("tone") or "grounded",
        "safety": companion_response.get("safety") or {
            "risk_level": "none",
            "message": None,
        },
    }
    if companion_response.get("reply_format"):
        response["reply_format"] = companion_response["reply_format"]
    if companion_response.get("sections") is not None:
        response["sections"] = companion_response["sections"]
    if companion_response.get("intent"):
        response["intent"] = companion_response["intent"]
    if meta:
        response["meta"] = meta
    if conversation_id is not None:
        response["conversation_id"] = conversation_id
    if conversation is not None:
        response["conversation"] = conversation
    return response


def log_life_companion_event(
    *,
    status: str,
    mode: str,
    provider: str = "deterministic",
    latency_ms: int | None = None,
    total_request_ms: int | None = None,
    context_build_ms: int | None = None,
    prompt_build_ms: int | None = None,
    retrieval_ms: int | None = None,
    provider_ms: int | None = None,
    validation_ms: int | None = None,
    fallback_reason: str | None = None,
    provider_selected: str | None = None,
    final_response_mode: str | None = None,
    validation_failure_reason: str | None = None,
    error_reason: str | None = None,
    risk_level: str = "none",
    context: dict | None = None,
    knowledge_chunk_ids: list[str] | None = None,
) -> None:
    context_used = ",".join((context or {}).get("context_used") or []) or "none"
    knowledge_used = ",".join(knowledge_chunk_ids or []) or "none"
    print(
        "LIFE_COMPANION "
        f"status={status} "
        f"provider={provider} "
        f"prompt_version={LIFE_COMPANION_PROMPT_VERSION} "
        f"mode={mode} "
        f"context_used={context_used} "
        f"risk_level={risk_level} "
        f"total_request_ms={total_request_ms if total_request_ms is not None else 'n/a'} "
        f"context_build_ms={context_build_ms if context_build_ms is not None else 'n/a'} "
        f"prompt_build_ms={prompt_build_ms if prompt_build_ms is not None else 'n/a'} "
        f"retrieval_ms={retrieval_ms if retrieval_ms is not None else 'n/a'} "
        f"provider_ms={provider_ms if provider_ms is not None else 'n/a'} "
        f"validation_ms={validation_ms if validation_ms is not None else 'n/a'} "
        f"knowledge_used={knowledge_used} "
        f"fallback_reason={fallback_reason or 'none'} "
        f"provider_selected={provider_selected or provider} "
        f"final_response_mode={final_response_mode or status} "
        f"latency_ms={latency_ms if latency_ms is not None else 'n/a'} "
        f"validation_failure_reason={validation_failure_reason or 'none'} "
        f"error_reason={error_reason or 'none'}"
    )


def log_life_companion_route_hit(
    *,
    request: LifeCompanionRequest,
    authorization_present: bool,
) -> None:
    raw_message = str(getattr(request, "message", "") or "")
    print(
        "LIFE_COMPANION_ROUTE "
        "route_hit=true "
        f"mode={str(getattr(request, 'mode', '') or 'missing').strip().lower() or 'missing'} "
        f"user_id_present={bool(getattr(request, 'user_id', None))} "
        f"conversation_id_present={bool(getattr(request, 'conversation_id', None))} "
        f"authorization_present={authorization_present} "
        f"message_chars={len(raw_message)}"
    )


def build_life_companion_meta(
    *,
    provider_selected: str,
    final_response_mode: str,
    context: dict | None = None,
    fallback_reason: str | None = None,
    provider_ms: int | None = None,
    validation_ms: int | None = None,
    total_request_ms: int | None = None,
    context_build_ms: int | None = None,
    prompt_build_ms: int | None = None,
    retrieval_ms: int | None = None,
    knowledge_chunk_ids: list[str] | None = None,
) -> dict:
    return {
        "prompt_version": LIFE_COMPANION_PROMPT_VERSION,
        "provider_selected": provider_selected,
        "final_response_mode": final_response_mode,
        "fallback_reason": fallback_reason,
        "provider_ms": provider_ms,
        "validation_ms": validation_ms,
        "total_request_ms": total_request_ms,
        "context_build_ms": context_build_ms,
        "prompt_build_ms": prompt_build_ms,
        "retrieval_ms": retrieval_ms,
        "context_used": (context or {}).get("context_used") or [],
        "knowledge_chunk_ids": knowledge_chunk_ids or [],
    }


COMPANION_CONVERSATION_COLUMNS = (
    "id,user_id,title,last_message_preview,archived,created_at,updated_at"
)
COMPANION_MESSAGE_COLUMNS = (
    "id,conversation_id,user_id,role,content,mode,suggested_action_json,"
    "tone,risk_level,companion_intent,resolved_action_type,created_at"
)
DEFAULT_COMPANION_CONVERSATION_TITLE = "New conversation"


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def validate_companion_uuid(value: str | None, *, field: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    try:
        UUID(cleaned)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid {field}") from error
    return cleaned


def compact_companion_text(value: object, *, max_chars: int) -> str:
    compacted = " ".join(str(value or "").split())
    if len(compacted) <= max_chars:
        return compacted
    return compacted[: max_chars - 3].rstrip() + "..."


def derive_companion_conversation_title(message: str) -> str:
    return compact_companion_text(message, max_chars=56) or DEFAULT_COMPANION_CONVERSATION_TITLE


def normalize_companion_conversation_title(title: str | None) -> str:
    return (
        compact_companion_text(title, max_chars=80)
        or DEFAULT_COMPANION_CONVERSATION_TITLE
    )


def get_owned_companion_conversation(
    *,
    user_id: str,
    conversation_id: str,
    allow_archived: bool = False,
) -> dict:
    normalized_conversation_id = validate_companion_uuid(
        conversation_id,
        field="conversation_id",
    )
    query = (
        supabase.table("companion_conversations")
        .select(COMPANION_CONVERSATION_COLUMNS)
        .eq("id", normalized_conversation_id)
        .eq("user_id", user_id)
        .limit(1)
    )
    if not allow_archived:
        query = query.eq("archived", False)

    response = query.execute()
    row = (response.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row


def create_companion_conversation(
    *,
    user_id: str,
    title: str | None = None,
) -> dict:
    payload = {
        "user_id": user_id,
        "title": normalize_companion_conversation_title(title),
    }
    response = (
        supabase.table("companion_conversations")
        .insert(payload)
        .execute()
    )
    row = (response.data or [None])[0]
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    return row


def update_companion_conversation_after_reply(
    *,
    user_id: str,
    conversation: dict,
    user_message: str,
    assistant_reply: str,
) -> dict:
    existing_title = compact_companion_text(conversation.get("title"), max_chars=80)
    payload = {
        "last_message_preview": compact_companion_text(
            assistant_reply or user_message,
            max_chars=120,
        ),
        "updated_at": utc_now_iso(),
    }
    if not existing_title or existing_title == DEFAULT_COMPANION_CONVERSATION_TITLE:
        payload["title"] = derive_companion_conversation_title(user_message)

    response = (
        supabase.table("companion_conversations")
        .update(payload)
        .eq("id", conversation["id"])
        .eq("user_id", user_id)
        .execute()
    )
    row = (response.data or [None])[0]
    if row:
        return row
    return get_owned_companion_conversation(
        user_id=user_id,
        conversation_id=conversation["id"],
        allow_archived=True,
    )


def persist_companion_exchange(
    *,
    user_id: str,
    conversation: dict,
    mode: str,
    user_message: str,
    companion_response: dict,
    companion_intent: str | None = None,
) -> dict:
    safety = companion_response.get("safety") or {}
    assistant_reply = companion_response.get("reply") or ""
    suggested_action = companion_response.get("suggested_action") or {}
    resolved_action_type = clean_metadata_text(
        suggested_action.get("type"),
        max_chars=48,
    )
    safe_intent = clean_metadata_text(companion_intent, max_chars=48)
    message_rows = [
        {
            "conversation_id": conversation["id"],
            "user_id": user_id,
            "role": "user",
            "content": user_message,
            "mode": mode,
            "risk_level": "none",
            "companion_intent": safe_intent,
        },
        {
            "conversation_id": conversation["id"],
            "user_id": user_id,
            "role": "assistant",
            "content": assistant_reply,
            "mode": mode,
            "suggested_action_json": suggested_action,
            "tone": companion_response.get("tone"),
            "risk_level": safety.get("risk_level") or "none",
            "companion_intent": safe_intent,
            "resolved_action_type": resolved_action_type,
        },
    ]
    (
        supabase.table("companion_messages")
        .insert(message_rows)
        .execute()
    )
    return update_companion_conversation_after_reply(
        user_id=user_id,
        conversation=conversation,
        user_message=user_message,
        assistant_reply=assistant_reply,
    )


def log_weekly_mirror_event(
    *,
    status: str,
    provider: str = "gemini",
    latency_ms: int | None = None,
    validation_failure_reason: str | None = None,
    error_reason: str | None = None,
    context: dict | None = None,
) -> None:
    data_points = (context or {}).get("data_points") or {}
    input_summary = (context or {}).get("input_summary") or {}
    context_used = ",".join(input_summary.get("context_used") or []) or "none"
    print(
        "WEEKLY_MIRROR "
        f"status={status} "
        f"provider={provider} "
        f"prompt_version={WEEKLY_MIRROR_PROMPT_VERSION} "
        f"reflections={data_points.get('reflections', 0)} "
        f"tasks={data_points.get('tasks', 0)} "
        f"context_used={context_used} "
        f"latency_ms={latency_ms if latency_ms is not None else 'n/a'} "
        f"validation_failure_reason={validation_failure_reason or 'none'} "
        f"error_reason={error_reason or 'none'}"
    )


def get_cached_weekly_synthesis(
    user_id: str,
    week_start: str,
    week_end: str,
    source_fingerprint: str,
) -> dict | None:
    try:
        response = (
            supabase.table("weekly_syntheses")
            .select("status,synthesis_json,input_summary_json,prompt_version,fallback_used")
            .eq("user_id", user_id)
            .eq("week_start", week_start)
            .eq("week_end", week_end)
            .limit(1)
            .execute()
        )
    except Exception as error:
        print(
            "WEEKLY_MIRROR "
            "status=storage_lookup_failed "
            f"error_type={type(error).__name__} "
            f"error_code={getattr(error, 'code', 'n/a') or 'n/a'}"
        )
        return None

    row = (response.data or [None])[0]
    if not row:
        return None

    input_summary = row.get("input_summary_json") or {}
    if (
        row.get("prompt_version") == WEEKLY_MIRROR_PROMPT_VERSION
        and input_summary.get("source_fingerprint") == source_fingerprint
        and isinstance(row.get("synthesis_json"), dict)
    ):
        return row
    return None


def save_weekly_synthesis(
    *,
    user_id: str,
    week_start: str,
    week_end: str,
    status: str,
    synthesis: dict,
    input_summary: dict,
    fallback_used: bool,
) -> None:
    payload = {
        "user_id": user_id,
        "week_start": week_start,
        "week_end": week_end,
        "status": status,
        "synthesis_json": synthesis,
        "input_summary_json": input_summary,
        "prompt_version": WEEKLY_MIRROR_PROMPT_VERSION,
        "fallback_used": fallback_used,
        "updated_at": datetime.utcnow().isoformat(),
    }
    try:
        existing = (
            supabase.table("weekly_syntheses")
            .select("id")
            .eq("user_id", user_id)
            .eq("week_start", week_start)
            .eq("week_end", week_end)
            .limit(1)
            .execute()
        )
        row = (existing.data or [None])[0]
        if row and row.get("id"):
            (
                supabase.table("weekly_syntheses")
                .update(payload)
                .eq("id", row["id"])
                .execute()
            )
        else:
            supabase.table("weekly_syntheses").insert(payload).execute()
    except Exception as error:
        print(
            "WEEKLY_MIRROR "
            "status=persistence_failed "
            f"error_type={type(error).__name__} "
            f"error_code={getattr(error, 'code', 'n/a') or 'n/a'}"
        )


def is_duplicate_insert_error(error: Exception) -> bool:
    error_code = str(getattr(error, "code", "") or "")
    error_message = str(error).lower()
    return (
        error_code == "23505"
        or "duplicate key" in error_message
        or "idx_loop_unique_incomplete_generated_core" in error_message
        or "idx_loop_unique_incomplete_core_all_sources" in error_message
    )


def is_missing_column_error(error: Exception) -> bool:
    error_code = str(getattr(error, "code", "") or "")
    error_message = str(error).lower()
    return error_code == "42703" or "does not exist" in error_message


def compact_error_message(error: Exception, max_chars: int = 240) -> str:
    message = " ".join(str(error).split())
    if len(message) > max_chars:
        return f"{message[:max_chars]}..."
    return message


def get_missing_loop_task_optional_insert_columns() -> set[str]:
    """Probe optional columns once so task generation survives partial DB migrations."""
    global _loop_task_missing_optional_insert_columns
    if _loop_task_missing_optional_insert_columns is not None:
        return _loop_task_missing_optional_insert_columns

    missing: set[str] = set()
    for column in sorted(LOOP_TASK_OPTIONAL_INSERT_COLUMNS):
        try:
            supabase.table("loop_tasks").select(column).limit(0).execute()
        except Exception as error:
            if is_missing_column_error(error):
                missing.add(column)
            else:
                print(
                    "AI_TASK_GENERATION "
                    "status=schema_probe_warning "
                    f"column={column} "
                    f"error_type={type(error).__name__} "
                    f"error_code={getattr(error, 'code', 'n/a') or 'n/a'}"
                )

    _loop_task_missing_optional_insert_columns = missing
    if missing:
        print(
            "AI_TASK_GENERATION "
            "status=optional_columns_omitted "
            f"columns={','.join(sorted(missing))}"
        )
    return missing


def sanitize_loop_task_insert_rows(rows: list[dict]) -> list[dict]:
    missing_columns = get_missing_loop_task_optional_insert_columns()
    if not missing_columns:
        return rows
    return [
        {key: value for key, value in row.items() if key not in missing_columns}
        for row in rows
    ]


def insert_repair_rows(
    user_id: str,
    local_date: str,
    rows: list[dict],
    missing_categories: list[str],
) -> tuple[str, list[dict]]:
    """Insert only rows whose category is in missing_categories; ignore duplicates silently."""
    cats = set(missing_categories)
    rows_to_insert = [
        r for r in rows
        if normalize_category(r.get("category", "")) in cats
    ]
    if not rows_to_insert:
        return "existing", fetch_today_core_tasks(user_id, local_date)
    rows_to_insert = sanitize_loop_task_insert_rows(rows_to_insert)
    for row in rows_to_insert:
        try:
            supabase.table("loop_tasks").insert(row).execute()
        except Exception as err:
            if is_duplicate_insert_error(err):
                print(
                    "AI_TASK_GENERATION "
                    f"repair_duplicate_skipped=true "
                    f"category={normalize_category(row.get('category', ''))} "
                    f"error_code={getattr(err, 'code', 'n/a') or 'n/a'}"
                )
            else:
                raise
    return "repaired", fetch_today_core_tasks(user_id, local_date)


def insert_task_rows(
    user_id: str,
    local_date: str,
    rows: list[dict],
    *,
    source: str,
) -> tuple[str, list[dict]]:
    rows_to_insert = sanitize_loop_task_insert_rows(rows)
    try:
        db_response = supabase.table("loop_tasks").insert(rows_to_insert).execute()
        return "inserted", sort_task_rows(db_response.data or [])
    except Exception as insert_error:
        if is_duplicate_insert_error(insert_error):
            print(
                "AI_TASK_GENERATION "
                f"duplicate_insert_caught=true source={source} "
                f"error_type={type(insert_error).__name__} "
                f"error_code={getattr(insert_error, 'code', 'n/a') or 'n/a'}"
            )
            existing_after_race = fetch_today_core_tasks(user_id, local_date)
            print(
                "AI_TASK_GENERATION "
                f"duplicate_refetch source={source} "
                f"existing_count={len(existing_after_race)}"
            )
            if existing_after_race:
                if source in {"fallback", "safe_fallback"}:
                    return "fallback_existing", existing_after_race
                return "existing", existing_after_race
        raise


def build_insert_rows(
    tasks: list[dict],
    user_id: str,
    local_date: str,
    ai_generated: bool,
    *,
    generation_provider: str | None = None,
    generation_model: str | None = None,
    generation_prompt_version: str | None = None,
    generation_failure_reason: str | None = None,
) -> list[dict]:
    return [
        normalize_task_for_insert(
            task,
            user_id=user_id,
            local_date=local_date,
            index=index,
            ai_generated=ai_generated,
            generation_provider=generation_provider,
            generation_model=generation_model,
            generation_prompt_version=generation_prompt_version,
            generation_failure_reason=generation_failure_reason,
        )
        for index, task in enumerate(tasks)
    ]


def save_fallback_tasks(
    context: dict,
    user_id: str,
    local_date: str,
    missing_categories: list[str] | None = None,
    *,
    generation_provider: str = "safe_fallback",
    generation_failure_reason: str | None = None,
    force_insert_all: bool = False,
) -> tuple[str, list[dict]]:
    # Another request may have inserted tasks while the AI call was failing.
    if not force_insert_all:
        existing_after_failure = fetch_today_core_tasks(user_id, local_date)
        if existing_after_failure:
            # In repair mode, only short-circuit if the set is now complete
            if missing_categories:
                existing_cats = {normalize_category(t.get("category", "")) for t in existing_after_failure}
                if not [c for c in CORE_CATEGORY_ORDER if c not in existing_cats]:
                    return "existing", existing_after_failure
            else:
                return "existing", existing_after_failure

    fallback_tasks = generate_fallback_tasks(context)
    fallback_rows = build_insert_rows(
        fallback_tasks,
        user_id=user_id,
        local_date=local_date,
        ai_generated=False,
        generation_provider=generation_provider,
        generation_model=None,
        generation_prompt_version=LOOP_TASKS_PROMPT_VERSION,
        generation_failure_reason=generation_failure_reason,
    )
    if missing_categories:
        insert_status, rows = insert_repair_rows(
            user_id, local_date, fallback_rows, missing_categories
        )
    else:
        insert_status, rows = insert_task_rows(
            user_id,
            local_date,
            fallback_rows,
            source=generation_provider,
        )
    if insert_status in {"existing", "fallback_existing", "repaired"}:
        return insert_status, rows
    return "fallback", rows


@app.get("/api/life-companion/conversations")
async def list_life_companion_conversations(
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        response = (
            supabase.table("companion_conversations")
            .select(COMPANION_CONVERSATION_COLUMNS)
            .eq("user_id", token_user_id)
            .eq("archived", False)
            .order("updated_at", desc=True)
            .limit(30)
            .execute()
        )
        return {"conversations": response.data or []}
    except HTTPException:
        raise
    except Exception as error:
        print(
            "LIFE_COMPANION_HISTORY "
            "status=list_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to load conversations") from error


@app.post("/api/life-companion/conversations")
async def create_life_companion_conversation(
    request: CompanionConversationCreateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        conversation = create_companion_conversation(
            user_id=token_user_id,
            title=request.title,
        )
        return {"conversation": conversation}
    except HTTPException:
        raise
    except Exception as error:
        print(
            "LIFE_COMPANION_HISTORY "
            "status=create_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to create conversation") from error


@app.get("/api/life-companion/conversations/{conversation_id}/messages")
async def list_life_companion_messages(
    conversation_id: str,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        conversation = get_owned_companion_conversation(
            user_id=token_user_id,
            conversation_id=conversation_id,
        )
        response = (
            supabase.table("companion_messages")
            .select(COMPANION_MESSAGE_COLUMNS)
            .eq("user_id", token_user_id)
            .eq("conversation_id", conversation["id"])
            .order("created_at", desc=False)
            .execute()
        )
        return {"messages": response.data or []}
    except HTTPException:
        raise
    except Exception as error:
        print(
            "LIFE_COMPANION_HISTORY "
            "status=messages_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to load messages") from error


@app.delete("/api/life-companion/conversations/{conversation_id}")
async def delete_life_companion_conversation(
    conversation_id: str,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        conversation = get_owned_companion_conversation(
            user_id=token_user_id,
            conversation_id=conversation_id,
            allow_archived=True,
        )
        (
            supabase.table("companion_conversations")
            .delete()
            .eq("id", conversation["id"])
            .eq("user_id", token_user_id)
            .execute()
        )
        return {"status": "deleted", "conversation_id": conversation["id"]}
    except HTTPException:
        raise
    except Exception as error:
        print(
            "LIFE_COMPANION_HISTORY "
            "status=delete_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to delete conversation") from error


@app.post("/api/loop-tasks/{task_id}/feedback")
async def save_loop_task_feedback(
    task_id: str,
    request: LoopTaskFeedbackRequest,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        validate_request_user(token_user_id, request.user_id)
        normalized_task_id = validate_companion_uuid(task_id, field="task_id")

        completion_state = normalize_metadata_label(
            request.completion_state,
            allowed=COMPLETION_STATES,
            field_name="completion_state",
            required=True,
        )
        friction_level = normalize_metadata_label(
            request.task_friction_level,
            allowed=TASK_FRICTION_LEVELS,
            field_name="task_friction_level",
        )
        mood_before = normalize_metadata_label(
            request.mood_before,
            allowed=SAFE_MOOD_LABELS,
            field_name="mood_before",
        )
        mood_after = normalize_metadata_label(
            request.mood_after or request.post_action_mood,
            allowed=SAFE_MOOD_LABELS,
            field_name="mood_after",
        )
        skip_reason_label = normalize_metadata_label(
            request.skip_reason_label,
            allowed=SKIP_REASON_LABELS,
            field_name="skip_reason_label",
        )

        task_response = (
            supabase.table("loop_tasks")
            .select("id,user_id")
            .eq("id", normalized_task_id)
            .eq("user_id", token_user_id)
            .limit(1)
            .execute()
        )
        if not (task_response.data or []):
            raise HTTPException(status_code=404, detail="Task not found")

        payload = {
            "completion_state": completion_state,
            "post_action_mood": mood_after,
            "mood_after": mood_after,
            "mood_before": mood_before,
            "task_friction_level": friction_level,
            "skip_reason_label": skip_reason_label,
            "feedback_recorded_at": utc_now_iso(),
        }
        # When completion_state is "skipped", mark the task skipped boolean so
        # the adaptation engine (context.py) can count it correctly.
        if completion_state == "skipped":
            payload["skipped"] = True
        payload = {key: value for key, value in payload.items() if value is not None}

        update_response = (
            supabase.table("loop_tasks")
            .update(payload)
            .eq("id", normalized_task_id)
            .eq("user_id", token_user_id)
            .execute()
        )
        updated_rows = update_response.data or []
        updated_task = updated_rows[0] if updated_rows else {}
        return {
            "status": "success",
            "task": updated_task,
        }
    except HTTPException:
        raise
    except Exception as error:
        print(
            "SAFE_METADATA "
            "status=loop_feedback_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to save task feedback") from error


def compute_reset_next_step_type(mood_after: str | None, reflection_tag: str | None) -> str:
    """Return the recommended next step label based on safe mood/tag signals."""
    mood = str(mood_after or "").strip().lower()
    tag = str(reflection_tag or "").strip().lower()
    if mood == "grateful":
        return "reflection"
    if mood in {"calmer", "clearer", "clear", "focused", "proud", "hopeful"}:
        return "loop"
    if mood == "sleepy":
        return "rest"
    if mood in {"still_heavy", "heavy", "restless", "anxious", "overwhelmed", "drained"}:
        return "reset"
    if tag == "overthinking":
        return "reset"
    return "none"


@app.post("/api/reset-sessions")
async def save_reset_session_metadata(
    request: ResetSessionMetadataRequest,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        validate_request_user(token_user_id, request.user_id)

        mood_after = normalize_metadata_label(
            request.mood_after_reset or request.mood_after,
            allowed=SAFE_MOOD_LABELS,
            field_name="mood_after",
        )
        reflection_tag = normalize_metadata_label(
            request.reset_reflection_tag or request.reflection_tag,
            allowed=RESET_REFLECTION_TAGS,
            field_name="reflection_tag",
        )
        next_step_type = compute_reset_next_step_type(mood_after, reflection_tag)

        payload = {
            "user_id": token_user_id,
            "session_title": clean_metadata_text(request.session_title, max_chars=120),
            "session_type": clean_metadata_text(request.session_type, max_chars=48),
            "duration_seconds": clamp_duration_seconds(request.duration_seconds),
            "mood_after": mood_after,
            "reflection_tag": reflection_tag,
            "next_step_type": next_step_type,
        }
        payload = {key: value for key, value in payload.items() if value is not None}

        response = supabase.table("reset_sessions").insert(payload).execute()
        row = (response.data or [None])[0]
        return {
            "status": "success",
            "reset_session": row,
            "next_step_type": next_step_type,
        }
    except HTTPException:
        raise
    except Exception as error:
        print(
            "SAFE_METADATA "
            "status=reset_session_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to save reset metadata") from error


@app.post("/api/curator/interactions")
async def save_curator_interaction(
    request: CuratorInteractionRequest,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        validate_request_user(token_user_id, request.user_id)

        action_type = normalize_metadata_label(
            request.action_type,
            allowed=CURATOR_ACTION_TYPES,
            field_name="action_type",
            required=True,
        )
        payload = {
            "user_id": token_user_id,
            "book_id": clean_metadata_text(request.book_id, max_chars=80),
            "path_slug": clean_metadata_text(request.path_slug, max_chars=80),
            "action_type": action_type,
            "duration_seconds": clamp_duration_seconds(request.duration_seconds),
        }
        payload = {key: value for key, value in payload.items() if value is not None}

        response = supabase.table("curator_interactions").insert(payload).execute()
        row = (response.data or [None])[0]
        return {
            "status": "success",
            "curator_interaction": row,
        }
    except HTTPException:
        raise
    except Exception as error:
        print(
            "SAFE_METADATA "
            "status=curator_interaction_failed "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to save curator metadata") from error


@app.post("/api/life-companion/chat")
async def life_companion_chat(
    request: LifeCompanionRequest,
    authorization: str | None = Header(default=None),
):
    request_started = perf_counter()
    context_build_ms = 0
    prompt_build_ms = 0
    retrieval_ms = 0
    try:
        log_life_companion_route_hit(
            request=request,
            authorization_present=bool(authorization),
        )
        token_user_id = validate_supabase_access_token(authorization)

        try:
            mode = validate_life_companion_mode(request.mode)
            user_message = validate_life_companion_message(request.message)
        except LifeCompanionValidationError as validation_error:
            raise HTTPException(status_code=400, detail=validation_error.reason) from validation_error

        conversation = None
        if request.conversation_id:
            conversation = get_owned_companion_conversation(
                user_id=token_user_id,
                conversation_id=request.conversation_id,
            )

        detected_intent = detect_companion_intent(user_message, mode)
        request_slots = extract_request_slots(user_message, detected_intent)
        safety_signal = detect_life_companion_safety(user_message)
        if safety_signal.get("crisis"):
            companion_response = generate_life_companion_crisis_response()
            log_life_companion_event(
                status="safety",
                mode=mode,
                provider="deterministic",
                risk_level="crisis",
                total_request_ms=int((perf_counter() - request_started) * 1000),
                context_build_ms=context_build_ms,
                prompt_build_ms=prompt_build_ms,
                retrieval_ms=retrieval_ms,
                provider_ms=0,
                validation_ms=0,
                provider_selected="deterministic",
                final_response_mode="safety",
            )
            total_request_ms = int((perf_counter() - request_started) * 1000)
            return build_life_companion_response(
                "safety",
                companion_response,
                meta=build_life_companion_meta(
                    provider_selected="deterministic",
                    final_response_mode="safety",
                    fallback_reason=None,
                    provider_ms=0,
                    validation_ms=0,
                    total_request_ms=total_request_ms,
                    context_build_ms=context_build_ms,
                    prompt_build_ms=prompt_build_ms,
                    retrieval_ms=retrieval_ms,
                ),
                conversation_id=conversation.get("id") if conversation else None,
            )

        if conversation is None:
            conversation = create_companion_conversation(
                user_id=token_user_id,
            )

        context_started = perf_counter()
        context = build_life_companion_context(supabase, token_user_id, mode)
        context["latest_request_slots"] = request_slots
        context_build_ms = int((perf_counter() - context_started) * 1000)

        retrieval_started = perf_counter()
        knowledge_chunks = retrieve_companion_knowledge(
            user_message,
            mode,
            detected_intent,
            max_chunks=4,
        )
        retrieval_ms = int((perf_counter() - retrieval_started) * 1000)
        knowledge_chunk_ids = [
            str(chunk.get("id") or "")
            for chunk in knowledge_chunks
            if isinstance(chunk, dict) and chunk.get("id")
        ]

        if safety_signal.get("prompt_injection"):
            companion_response = generate_life_companion_fallback(
                mode,
                context,
                prompt_injection=True,
                user_message=user_message,
                knowledge_chunks=knowledge_chunks,
            )
            log_life_companion_event(
                status="fallback",
                mode=mode,
                provider="deterministic",
                error_reason="prompt_injection_detected",
                fallback_reason="unsafe_output",
                risk_level=companion_response["safety"]["risk_level"],
                context=context,
                total_request_ms=int((perf_counter() - request_started) * 1000),
                context_build_ms=context_build_ms,
                prompt_build_ms=prompt_build_ms,
                retrieval_ms=retrieval_ms,
                provider_ms=0,
                validation_ms=0,
                provider_selected="deterministic",
                final_response_mode="fallback",
                knowledge_chunk_ids=knowledge_chunk_ids,
            )
            total_request_ms = int((perf_counter() - request_started) * 1000)
            updated_conversation = persist_companion_exchange(
                user_id=token_user_id,
                conversation=conversation,
                mode=mode,
                user_message=user_message,
                companion_response=companion_response,
                companion_intent=detected_intent,
            )
            return build_life_companion_response(
                "fallback",
                companion_response,
                meta=build_life_companion_meta(
                    provider_selected="deterministic",
                    final_response_mode="fallback",
                    context=context,
                    fallback_reason="unsafe_output",
                    provider_ms=0,
                    validation_ms=0,
                    total_request_ms=total_request_ms,
                    context_build_ms=context_build_ms,
                    prompt_build_ms=prompt_build_ms,
                    retrieval_ms=retrieval_ms,
                    knowledge_chunk_ids=knowledge_chunk_ids,
                ),
                conversation_id=updated_conversation["id"],
                conversation=updated_conversation,
            )

        prompt_started = perf_counter()
        prompt = build_life_companion_prompt(
            context,
            mode,
            user_message,
            intent=detected_intent,
            knowledge_chunks=knowledge_chunks,
        )
        prompt_build_ms = int((perf_counter() - prompt_started) * 1000)
        gateway_result = generate_life_companion_response(
            prompt=prompt,
            prompt_version=LIFE_COMPANION_PROMPT_VERSION,
            mode=mode,
            context=context,
            user_message=user_message,
            knowledge_chunks=knowledge_chunks,
        )
        log_life_companion_event(
            status=gateway_result.status,
            mode=mode,
            provider=gateway_result.provider,
            latency_ms=gateway_result.latency_ms,
            total_request_ms=int((perf_counter() - request_started) * 1000),
            context_build_ms=context_build_ms,
            prompt_build_ms=prompt_build_ms,
            retrieval_ms=retrieval_ms,
            provider_ms=gateway_result.provider_ms,
            validation_ms=gateway_result.validation_ms,
            fallback_reason=gateway_result.fallback_reason,
            provider_selected=gateway_result.provider,
            final_response_mode=gateway_result.final_response_mode,
            validation_failure_reason=gateway_result.validation_failure_reason,
            error_reason=gateway_result.error_reason,
            risk_level=gateway_result.companion_response["safety"]["risk_level"],
            context=context,
            knowledge_chunk_ids=knowledge_chunk_ids,
        )
        total_request_ms = int((perf_counter() - request_started) * 1000)
        updated_conversation = None
        if gateway_result.status != "safety":
            updated_conversation = persist_companion_exchange(
                user_id=token_user_id,
                conversation=conversation,
                mode=mode,
                user_message=user_message,
                companion_response=gateway_result.companion_response,
                companion_intent=detected_intent,
            )
        return build_life_companion_response(
            gateway_result.status,
            gateway_result.companion_response,
            meta=build_life_companion_meta(
                provider_selected=gateway_result.provider,
                final_response_mode=gateway_result.final_response_mode,
                context=context,
                fallback_reason=gateway_result.fallback_reason,
                provider_ms=gateway_result.provider_ms,
                validation_ms=gateway_result.validation_ms,
                total_request_ms=total_request_ms,
                context_build_ms=context_build_ms,
                prompt_build_ms=prompt_build_ms,
                retrieval_ms=retrieval_ms,
                knowledge_chunk_ids=knowledge_chunk_ids,
            ),
            conversation_id=(updated_conversation or conversation)["id"],
            conversation=updated_conversation,
        )

    except HTTPException:
        raise
    except Exception as error:
        print(
            "LIFE_COMPANION "
            "status=critical_error "
            f"error_type={type(error).__name__} "
            f"total_request_ms={int((perf_counter() - request_started) * 1000)}"
        )
        raise HTTPException(status_code=500, detail="Failed to generate Life Companion response") from error


@app.post("/api/weekly-synthesis")
async def weekly_synthesis(
    request: WeeklySynthesisRequest,
    authorization: str | None = Header(default=None),
):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        if token_user_id != request.user_id:
            raise HTTPException(status_code=403, detail="Session user does not match request user")

        week_start, week_end = validate_week_range(request.week_start, request.week_end)
        context = build_weekly_mirror_context(
            supabase,
            request.user_id,
            week_start,
            week_end,
        )
        input_summary = context.get("input_summary") or {}
        source_fingerprint = input_summary.get("source_fingerprint") or ""

        cached = get_cached_weekly_synthesis(
            request.user_id,
            week_start,
            week_end,
            source_fingerprint,
        )
        if cached:
            log_weekly_mirror_event(
                status=f"cached_{cached.get('status', 'success')}",
                provider="cache",
                context=context,
            )
            return build_weekly_response(
                cached.get("status") or "success",
                cached.get("synthesis_json") or {},
                context,
                fallback_used=bool(cached.get("fallback_used")),
            )

        if is_insufficient_weekly_data(context):
            synthesis = generate_insufficient_weekly_mirror(context)
            save_weekly_synthesis(
                user_id=request.user_id,
                week_start=week_start,
                week_end=week_end,
                status="insufficient_data",
                synthesis=synthesis,
                input_summary=input_summary,
                fallback_used=False,
            )
            log_weekly_mirror_event(
                status="insufficient_data",
                provider="deterministic",
                context=context,
            )
            return build_weekly_response(
                "insufficient_data",
                synthesis,
                context,
                fallback_used=False,
            )

        if gemini_model is None:
            synthesis = generate_fallback_weekly_mirror(context)
            save_weekly_synthesis(
                user_id=request.user_id,
                week_start=week_start,
                week_end=week_end,
                status="fallback",
                synthesis=synthesis,
                input_summary=input_summary,
                fallback_used=True,
            )
            log_weekly_mirror_event(
                status="fallback",
                provider="fallback",
                error_reason="provider_unavailable",
                context=context,
            )
            return build_weekly_response(
                "fallback",
                synthesis,
                context,
                fallback_used=True,
            )

        prompt = build_weekly_mirror_prompt(context)
        try:
            provider_response = generate_with_gemini(
                gemini_model,
                prompt,
                prompt_version=WEEKLY_MIRROR_PROMPT_VERSION,
            )
            synthesis = validate_weekly_mirror_synthesis(provider_response.text)
            save_weekly_synthesis(
                user_id=request.user_id,
                week_start=week_start,
                week_end=week_end,
                status="success",
                synthesis=synthesis,
                input_summary=input_summary,
                fallback_used=False,
            )
            log_weekly_mirror_event(
                status="success",
                provider=provider_response.provider,
                latency_ms=provider_response.latency_ms,
                context=context,
            )
            return build_weekly_response(
                "success",
                synthesis,
                context,
                fallback_used=False,
            )
        except WeeklyMirrorValidationError as validation_error:
            synthesis = generate_fallback_weekly_mirror(context)
            save_weekly_synthesis(
                user_id=request.user_id,
                week_start=week_start,
                week_end=week_end,
                status="fallback",
                synthesis=synthesis,
                input_summary=input_summary,
                fallback_used=True,
            )
            log_weekly_mirror_event(
                status="fallback",
                validation_failure_reason=validation_error.reason,
                context=context,
            )
            return build_weekly_response(
                "fallback",
                synthesis,
                context,
                fallback_used=True,
            )
        except AIGenerationError as ai_error:
            synthesis = generate_fallback_weekly_mirror(context)
            save_weekly_synthesis(
                user_id=request.user_id,
                week_start=week_start,
                week_end=week_end,
                status="fallback",
                synthesis=synthesis,
                input_summary=input_summary,
                fallback_used=True,
            )
            log_weekly_mirror_event(
                status="fallback",
                latency_ms=ai_error.latency_ms,
                error_reason=ai_error.reason,
                context=context,
            )
            return build_weekly_response(
                "fallback",
                synthesis,
                context,
                fallback_used=True,
            )

    except HTTPException:
        raise
    except Exception as error:
        print(
            "WEEKLY_MIRROR "
            "status=critical_error "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to generate Weekly Mirror") from error


@app.post("/api/generate-loop-tasks")
async def generate_tasks(request: TaskRequest, authorization: str | None = Header(default=None)):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        if token_user_id != request.user_id:
            raise HTTPException(status_code=403, detail="Session user does not match request user")

        # Three-tier struggle fallback:
        # Tier 1: request.struggles (from frontend / onboarding session)
        # Tier 2: Supabase Auth user_metadata (JWT, no extra network call needed)
        # Tier 3: user_behavior.core_struggles DB query (inside build_generation_context, already optional)
        resolved_struggles = [s for s in (request.struggles or []) if isinstance(s, str) and s.strip()]
        if not resolved_struggles:
            try:
                token = extract_bearer_token(authorization)
                auth_resp = supabase.auth.get_user(token)
                auth_user = getattr(auth_resp, "user", None)
                if auth_user:
                    raw_meta = getattr(auth_user, "user_metadata", None) or {}
                    meta_struggles = raw_meta.get("struggles") or raw_meta.get("struggle_tags") or []
                    if isinstance(meta_struggles, list):
                        resolved_struggles = [str(s) for s in meta_struggles if s]
            except Exception:
                pass  # Safe: tier 3 handles this inside build_generation_context

        existing_tasks = fetch_today_core_tasks(request.user_id, request.local_date)
        existing_categories = {normalize_category(t.get("category", "")) for t in existing_tasks}
        missing_categories = [c for c in CORE_CATEGORY_ORDER if c not in existing_categories]
        repair_mode = bool(existing_tasks and missing_categories and not request.regenerate)

        # Full set present — return immediately
        if existing_tasks and not missing_categories and not request.regenerate:
            return build_task_response("existing", existing_tasks, cached=True)

        # Partial set — log and fall through to generate missing categories only
        if repair_mode:
            print(
                "AI_TASK_GENERATION "
                f"repair_mode=true existing_count={len(existing_tasks)} "
                f"missing_categories={','.join(missing_categories)}"
            )

        # Regenerate: block if any task completed, else wipe uncompleted
        if request.regenerate and existing_tasks:
            if any(is_completed_task(task) for task in existing_tasks):
                return build_task_response("locked", existing_tasks, cached=True)
            delete_uncompleted_generated_core_tasks(request.user_id, request.local_date)
            repair_mode = False
            missing_categories = list(CORE_CATEGORY_ORDER)

        context = build_generation_context(
            resolved_struggles,
            request.current_streak,
            supabase=supabase,
            user_id=request.user_id,
            local_date=request.local_date,
            existing_tasks=existing_tasks,
        )
        context["auth_user_id"] = token_user_id

        tag = request.recalibrate_tag
        if tag and tag in RECALIBRATE_TAG_OVERRIDES and request.regenerate:
            context.update(RECALIBRATE_TAG_OVERRIDES[tag])
            print(f"AI_TASK_GENERATION recalibrate_tag={tag} overrides_applied=true")

        prompt = build_loop_tasks_prompt(context)
        gemini_diagnosis_context = {
            "key_source": effective_gemini_key_source,
            "gemini_api_key_present": bool(gemini_api_key),
            "google_api_key_present": bool(google_api_key),
            "model_name": gemini_model_name,
        }

        if loop_gemini_client is None:
            diagnosis = build_gemini_diagnosis(
                "provider_unavailable",
                **gemini_diagnosis_context,
            )
            if not request.allow_safe_fallback:
                log_generation_event(
                    status="retryable_ai_failure",
                    provider="gemini",
                    error_reason="provider_unavailable",
                    diagnosis=diagnosis,
                    context=context,
                )
                return build_retryable_task_failure_response(
                    context=context,
                    reason="provider_unavailable",
                    diagnosis=diagnosis,
                )

            delete_uncompleted_generated_core_tasks(request.user_id, request.local_date)
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                request.local_date,
                generation_provider="safe_fallback",
                generation_failure_reason="provider_unavailable",
                force_insert_all=True,
            )
            log_generation_event(
                status=fallback_status,
                provider="safe_fallback",
                error_reason="provider_unavailable",
                diagnosis=diagnosis,
                context=context,
            )
            return build_task_response(
                fallback_status,
                fallback_rows,
                context,
                meta_extra={
                    "provider": "safe_fallback",
                    "fallback_used": True,
                    "fallback_reason": "provider_unavailable",
                    "diagnosis": diagnosis,
                },
            )

        try:
            provider_response = generate_loop_tasks_with_gemini(
                loop_gemini_client,
                gemini_model_name,
                prompt,
                prompt_version=LOOP_TASKS_PROMPT_VERSION,
                diagnosis_context=gemini_diagnosis_context,
            )
            category_tasks = validate_ai_tasks(provider_response.text, context)
            formatted_tasks = build_insert_rows(
                category_tasks,
                user_id=request.user_id,
                local_date=request.local_date,
                ai_generated=True,
                generation_provider="gemini",
                generation_model=gemini_model_name,
                generation_prompt_version=provider_response.prompt_version,
            )
            if repair_mode:
                insert_status, rows = insert_repair_rows(
                    request.user_id,
                    request.local_date,
                    formatted_tasks,
                    missing_categories,
                )
            else:
                insert_status, rows = insert_task_rows(
                    request.user_id,
                    request.local_date,
                    formatted_tasks,
                    source="ai_success",
                )
            status = "existing" if insert_status == "existing" else (insert_status or "success")
            log_generation_event(
                status=status,
                provider=provider_response.provider,
                prompt_version=provider_response.prompt_version,
                latency_ms=provider_response.latency_ms,
                context=context,
            )
            return build_task_response(status, rows, context)
        except TaskValidationError as validation_error:
            diagnosis = build_gemini_diagnosis(
                f"validation_failed:{validation_error.reason}",
                **gemini_diagnosis_context,
            )
            if not request.allow_safe_fallback:
                log_generation_event(
                    status="retryable_ai_failure",
                    validation_failure_reason=validation_error.reason,
                    diagnosis=diagnosis,
                    context=context,
                )
                return build_retryable_task_failure_response(
                    context=context,
                    reason=f"validation_failed:{validation_error.reason}",
                    diagnosis=diagnosis,
                )

            delete_uncompleted_generated_core_tasks(request.user_id, request.local_date)
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                request.local_date,
                generation_provider="safe_fallback",
                generation_failure_reason=f"validation_failed:{validation_error.reason}",
                force_insert_all=True,
            )
            log_generation_event(
                status=fallback_status,
                provider="safe_fallback",
                validation_failure_reason=validation_error.reason,
                diagnosis=diagnosis,
                context=context,
            )
            return build_task_response(
                fallback_status,
                fallback_rows,
                context,
                meta_extra={
                    "provider": "safe_fallback",
                    "fallback_used": True,
                    "fallback_reason": f"validation_failed:{validation_error.reason}",
                    "diagnosis": diagnosis,
                },
            )
        except AIGenerationError as ai_error:
            diagnosis = ai_error.diagnosis or build_gemini_diagnosis(
                ai_error.reason,
                **gemini_diagnosis_context,
            )
            if not request.allow_safe_fallback:
                log_generation_event(
                    status="retryable_ai_failure",
                    latency_ms=ai_error.latency_ms,
                    error_reason=ai_error.reason,
                    diagnosis=diagnosis,
                    context=context,
                )
                return build_retryable_task_failure_response(
                    context=context,
                    reason=ai_error.reason,
                    diagnosis=diagnosis,
                    latency_ms=ai_error.latency_ms,
                )

            delete_uncompleted_generated_core_tasks(request.user_id, request.local_date)
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                request.local_date,
                generation_provider="safe_fallback",
                generation_failure_reason=ai_error.reason,
                force_insert_all=True,
            )
            log_generation_event(
                status=fallback_status,
                provider="safe_fallback",
                latency_ms=ai_error.latency_ms,
                error_reason=ai_error.reason,
                diagnosis=diagnosis,
                context=context,
            )
            return build_task_response(
                fallback_status,
                fallback_rows,
                context,
                meta_extra={
                    "provider": "safe_fallback",
                    "fallback_used": True,
                    "fallback_reason": ai_error.reason,
                    "diagnosis": diagnosis,
                },
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(
            "AI_TASK_GENERATION "
            "status=critical_error "
            f"error_type={type(e).__name__} "
            f"error_code={getattr(e, 'code', 'n/a') or 'n/a'} "
            f"error_message={compact_error_message(e)}"
        )
        raise HTTPException(status_code=500, detail="Failed to generate or save tasks")



@app.post("/api/execution-engine")
async def execution_engine(
    request: ExecutionEngineRequest,
    authorization: str | None = Header(default=None),
):
    request_started = perf_counter()
    try:
        token_user_id = validate_supabase_access_token(authorization)
        if token_user_id != request.user_id:
            raise HTTPException(
                status_code=403,
                detail="Session user does not match request user",
            )

        raw_pain_point = str(request.pain_point or "").strip()
        if raw_pain_point not in ALLOWED_PAIN_POINTS:
            raise HTTPException(status_code=400, detail="Invalid pain_point value")

        # Sanitise progression inputs — cap count at 999, strip each recent title
        completed_tasks_count = max(0, min(999, int(request.completed_tasks_count or 0)))
        recent_tasks = [
            str(t).strip()[:120]
            for t in (request.recent_tasks or [])[:5]
            if str(t).strip()
        ]

        # Derive phase label for logging (mirrors _get_phase logic)
        if completed_tasks_count <= 7:
            phase_label = "phase_1_triage"
        elif completed_tasks_count <= 14:
            phase_label = "phase_2_awareness"
        elif completed_tasks_count <= 21:
            phase_label = "phase_3_restructure"
        else:
            phase_label = "phase_4_sovereignty"

        prompt = build_execution_engine_prompt(
            pain_point=raw_pain_point,
            completed_tasks_count=completed_tasks_count,
            recent_tasks=recent_tasks,
        )
        fallback_reason = None

        try:
            groq_response = generate_life_companion_with_groq(
                prompt=prompt,
                prompt_version=EXECUTION_ENGINE_PROMPT_VERSION,
                timeout_seconds=8,
            )
            raw_text = groq_response.text.strip()
            if raw_text.startswith("```"):
                raw_text = _re.sub(r"^```[a-z]*\n?", "", raw_text).rstrip("`").strip()

            parsed = _json.loads(raw_text)
            task_title = str(parsed.get("taskTitle") or "").strip()
            duration_label = str(parsed.get("durationLabel") or "").strip()
            context_note = str(parsed.get("contextNote") or "").strip()

            if not task_title or not duration_label or not context_note:
                raise ValueError("incomplete_fields")

            latency_ms = int((perf_counter() - request_started) * 1000)
            print(
                f"EXECUTION_ENGINE status=success provider=groq "
                f"prompt_version={EXECUTION_ENGINE_PROMPT_VERSION} "
                f"phase={phase_label} completed_count={completed_tasks_count} "
                f"recent_tasks_count={len(recent_tasks)} latency_ms={latency_ms}"
            )
            return {
                "status": "success",
                "taskTitle": task_title,
                "durationLabel": duration_label,
                "contextNote": context_note,
                "meta": {
                    "provider": "groq",
                    "prompt_version": EXECUTION_ENGINE_PROMPT_VERSION,
                    "phase": phase_label,
                    "fallback_used": False,
                },
            }

        except (GroqCompanionProviderError, Exception) as ai_error:
            fallback_reason = getattr(ai_error, "reason", None) or type(ai_error).__name__
            print(
                f"EXECUTION_ENGINE status=fallback provider=static "
                f"fallback_reason={fallback_reason} "
                f"prompt_version={EXECUTION_ENGINE_PROMPT_VERSION}"
            )

        fallback = get_execution_engine_fallback(raw_pain_point)
        latency_ms = int((perf_counter() - request_started) * 1000)
        return {
            "status": "fallback",
            "taskTitle": fallback["taskTitle"],
            "durationLabel": fallback["durationLabel"],
            "contextNote": fallback["contextNote"],
            "meta": {
                "provider": "static",
                "prompt_version": EXECUTION_ENGINE_PROMPT_VERSION,
                "fallback_used": True,
                "fallback_reason": fallback_reason,
            },
        }

    except HTTPException:
        raise
    except Exception as error:
        print(
            f"EXECUTION_ENGINE status=critical_error error_type={type(error).__name__}"
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to generate execution engine action",
        ) from error
