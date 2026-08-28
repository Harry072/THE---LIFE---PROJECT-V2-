import json as _json
import re as _re
from pathlib import Path
from datetime import datetime
from time import perf_counter
from uuid import UUID

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as legacy_genai
from google import genai as google_genai
from auth import router as auth_router, verify_app_access_token
from routers.companion import create_companion_router

from ai.context import (
    ALLOWED_LOOP_CATEGORIES,
    CORE_CATEGORY_ORDER,
    build_generation_context,
    build_life_companion_context,
    build_weekly_mirror_context,
    normalize_category,
    table_select_optional,
)
from ai.task_intelligence import (
    build_task_intelligence_context,
    build_intelligence_context_block,
)
from ai.task_retrieval import retrieve_candidates
from ai.companion_agent import count_questions_asked, detect_distress, run_react_loop
from ai.companion_guardrails import apply_guardrails, has_memory_grounding
from ai.companion_orchestrator import build_orchestrator_payload, feed_orchestrator
from ai.companion_security import (
    DAILY_LIMIT_MESSAGE,
    SESSION_PAUSE_MESSAGE,
    check_rate_limits,
    sanitize_untrusted_text,
)
from ai.companion_tools import escalation_trigger
from ai.reflection_agent import (
    analyse_entry_task,
    clear_pending_reveal,
    embed_and_analyse_task,
    find_pending_reveal,
)
from ai.growth_tree_intelligence import (
    build_journey,
    get_score_payload,
    get_season_payload,
)
from ai.master_orchestrator import build_safe_default, get_dashboard_payload
from ai.companion_knowledge import (
    detect_companion_intent,
    extract_request_slots,
    retrieve_companion_knowledge,
)
from ai.companion_understanding import understand_companion_message
from ai.fallbacks import (
    KOTLER_TAG_BY_CATEGORY,
    build_life_companion_response as build_companion_payload,
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
    build_loop_tasks_prompt,
    build_weekly_mirror_prompt,
    build_execution_engine_prompt,
)
from ai.companion_playbooks.loader import build_chunk_index
from ai.groq_companion_gateway import (
    GroqCompanionProviderError,
    generate_life_companion_with_groq,
)
from ai.validator import (
    GENERIC_SPAM_PATTERNS,
    OVERWHELMING_PATTERNS,
    UNSAFE_PATTERNS,
    LifeCompanionValidationError,
    TaskValidationError,
    WeeklyMirrorValidationError,
    _word_overlap_ratio,
    detect_life_companion_safety,
    has_pattern,
    limit_words,
    normalize_task_for_insert,
    normalize_title,
    sanitize_detail_description,
    sanitize_ikigai_purpose,
    sanitize_waar_action,
    validate_life_companion_message,
    validate_life_companion_mode,
    validate_weekly_mirror_synthesis,
)

# Initialize local .env before configuring middleware or clients.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


DEFAULT_FRONTEND_URL = "https://the-life-project.vercel.app"
ALLOWED_ORIGIN = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)


def normalize_origin(value: str | None) -> str | None:
    if not value:
        return None
    origin = value.strip().rstrip("/")
    return origin or None


def split_origins(value: str | None) -> list[str]:
    if not value:
        return []
    return [
        origin
        for origin in (normalize_origin(item) for item in value.split(","))
        if origin
    ]


_ALWAYS_ALLOWED_ORIGINS = [
    DEFAULT_FRONTEND_URL,
    "https://the-life-project.vercel.app",
    "https://www.the-life-project.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]


def get_cors_origins() -> list[str]:
    frontend_origin = normalize_origin(ALLOWED_ORIGIN) or DEFAULT_FRONTEND_URL
    configured_origins = split_origins(os.environ.get("CORS_ORIGINS"))

    # Merge so the Vercel URL is always present regardless of env config.
    seen = set()
    merged = []
    for origin in [frontend_origin, *_ALWAYS_ALLOWED_ORIGINS, *configured_origins]:
        if origin not in seen:
            seen.add(origin)
            merged.append(origin)
    return merged


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=r"https://the-life-project.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)

# Build playbook chunk index at startup (graceful — missing .md files are skipped).
build_chunk_index()

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
    "kotler_tag",
    # Intelligence fields — added by task_intelligence upgrade
    "inner_work_layer",
    "approach_angle",
    "journey_phase",
    "ikigai_quadrant",
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
        app_payload = verify_app_access_token(token)
        return str(app_payload["sub"])
    except HTTPException:
        pass

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


def public_loop_category(row: dict) -> str:
    subtitle = str(row.get("subtitle") or "").strip().lower().replace("_", "-")
    if subtitle:
        if "reflection" in subtitle or "journal" in subtitle:
            return "reflection"
        if "reset" in subtitle or "breath" in subtitle or "ground" in subtitle:
            return "reset"
        if "growth" in subtitle or "meaning" in subtitle or "purpose" in subtitle:
            return "growth"
        if "awareness" in subtitle:
            return "awareness"
        if "action" in subtitle:
            return "action"
    return normalize_category(row.get("category"))


def publicize_loop_task_row(row: dict) -> dict:
    public_row = dict(row)
    public_row["category"] = public_loop_category(row)
    return public_row


def publicize_loop_task_rows(rows: list[dict]) -> list[dict]:
    return [publicize_loop_task_row(row) for row in rows]


LEGACY_DB_CATEGORY_BY_PUBLIC_CATEGORY = {
    "awareness": "awareness",
    "action": "action",
    "reflection": "awareness",
    "reset": "action",
    "growth": "meaning",
}


def to_legacy_category_storage_rows(rows: list[dict]) -> list[dict]:
    """
    Compatibility for deployed databases that still constrain category to the
    old awareness/action/meaning set. The public category stays in subtitle.
    """
    converted: list[dict] = []
    for row in rows:
        public_category = normalize_category(row.get("category"))
        legacy_row = dict(row)
        legacy_row["category"] = LEGACY_DB_CATEGORY_BY_PUBLIC_CATEGORY.get(
            public_category,
            "meaning",
        )
        # Legacy unique indexes only allow one generated core row per old
        # category. This keeps all 5 public categories insertable until the DB
        # category constraint is migrated.
        legacy_row["ai_generated"] = False
        legacy_row["is_optional"] = True
        if not str(legacy_row.get("subtitle") or "").strip():
            legacy_row["subtitle"] = f"{public_category.title()} Practice"
        converted.append(legacy_row)
    return converted


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
    category = public_loop_category(row)
    is_optional = row.get("is_optional")
    subtitle = str(row.get("subtitle") or "").lower()
    is_compat_core = bool(is_optional in {True, "true", "True", "1", 1}) and "practice" in subtitle
    return (
        category in ALLOWED_LOOP_CATEGORIES
        and (is_optional not in {True, "true", "True", "1", 1} or is_compat_core)
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
        publicize_loop_task_row(row) for row in (response.data or [])
        if is_core_task(row)
    ])


def delete_uncompleted_generated_core_tasks(user_id: str, local_date: str) -> None:
    # Include legacy "meaning" rows so regeneration cannot leave a duplicate
    # old-category task beside the new "growth" task.
    for category in [*CORE_CATEGORY_ORDER, "meaning"]:
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
    "neutral",
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


def validate_companion_chat_user(authorization: str | None, request_user_id: str) -> str:
    token_user_id = validate_supabase_access_token(authorization)
    validate_request_user(token_user_id, request_user_id)
    return token_user_id


app.include_router(create_companion_router(validate_user=validate_companion_chat_user))


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
    conversation_closed: bool = False,
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
    # Response-level only, never stored: this turn is deliberately not
    # persisted. Emitted only when the frozen state is permanent, so the
    # frontend can retire the composer instead of accepting input into a void.
    if conversation_closed:
        response["conversation_closed"] = True
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
    knowledge_used_count: int | None = None,
) -> None:
    context_used = ",".join((context or {}).get("context_used") or []) or "none"
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
        f"knowledge_used_count={knowledge_used_count if knowledge_used_count is not None else 0} "
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
    knowledge_used_count: int | None = None,
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
        "knowledge_used_count": knowledge_used_count or 0,
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
    guardrails_fired: list[str] | None = None,
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
            "suggested_action_json": {
                "_v": 2,
                "action": suggested_action or {},
                "sections": companion_response.get("sections") or [],
                "reply_format": companion_response.get("reply_format") or "conversation",
                # Guardrail note NAMES only -- never the stripped text and never
                # user content, matching the signals-only rule the tools follow.
                # Without this the notes are printed and discarded, so an empty
                # reply has to be reconstructed from server logs after the fact.
                "guardrails_fired": [
                    clean_metadata_text(note, max_chars=48)
                    for note in (guardrails_fired or [])
                ],
            },
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


def fetch_companion_conversation_history(
    *,
    user_id: str,
    conversation_id: str | None,
    limit: int = 10,
) -> list[dict]:
    if not conversation_id:
        return []

    rows = table_select_optional(
        supabase,
        "companion_messages",
        "life_companion_conversation_history",
        {
            "select": "role,content,created_at",
            "ops": [
                ("eq", ("user_id", user_id)),
                ("eq", ("conversation_id", conversation_id)),
                ("order", ("created_at",), {"desc": True}),
                ("limit", (limit,)),
            ],
        },
    )
    history: list[dict] = []
    for row in reversed(rows):
        role = str(row.get("role") or "").strip().lower()
        content = compact_companion_text(row.get("content"), max_chars=1200)
        if role in {"user", "assistant"} and content:
            history.append({"role": role, "content": content})
    return history[-limit:]


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


def is_legacy_category_constraint_error(error: Exception) -> bool:
    error_code = str(getattr(error, "code", "") or "")
    error_message = str(error).lower()
    return error_code == "23514" and (
        "loop_tasks_category_check" in error_message
        or ("violates check constraint" in error_message and "category" in error_message)
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
    try:
        supabase.table("loop_tasks").insert(rows_to_insert).execute()
    except Exception as err:
        if is_legacy_category_constraint_error(err):
            compat_rows = sanitize_loop_task_insert_rows(
                to_legacy_category_storage_rows(rows_to_insert)
            )
            supabase.table("loop_tasks").insert(compat_rows).execute()
            print(
                "AI_TASK_GENERATION "
                "category_storage_compat=true mode=repair"
            )
        elif is_duplicate_insert_error(err):
            print(
                "AI_TASK_GENERATION "
                "repair_duplicate_skipped=true "
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
        return "inserted", sort_task_rows(publicize_loop_task_rows(db_response.data or []))
    except Exception as insert_error:
        if is_legacy_category_constraint_error(insert_error):
            compat_rows = sanitize_loop_task_insert_rows(
                to_legacy_category_storage_rows(rows_to_insert)
            )
            db_response = supabase.table("loop_tasks").insert(compat_rows).execute()
            print(
                "AI_TASK_GENERATION "
                f"category_storage_compat=true source={source}"
            )
            return "inserted", sort_task_rows(publicize_loop_task_rows(db_response.data or []))
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
    if not missing_categories:
        # Keep fallback days consistent with retrieval-success days: always
        # _RETRIEVAL_TASK_COUNT tasks, never all of CORE_CATEGORY_ORDER.
        fallback_tasks = fallback_tasks[:_RETRIEVAL_TASK_COUNT]
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


@app.post("/api/life-companion/session/end")
async def end_companion_session(
    request: LifeCompanionRequest,
    authorization: str | None = Header(default=None),
):
    """
    Called when the user closes the companion chat.
    Summarizes the session using Groq and returns the structured summary.
    Updates the conversation title with a human-readable label.
    """
    try:
        from ai.groq_companion_gateway import summarize_companion_session
        token_user_id = validate_supabase_access_token(authorization)

        conversation_id = request.conversation_id
        if not conversation_id:
            return {"status": "skipped", "reason": "no_conversation_id"}

        # Fetch the conversation messages
        history = fetch_companion_conversation_history(
            user_id=token_user_id,
            conversation_id=conversation_id,
            limit=40,
        )
        if not history:
            return {"status": "skipped", "reason": "empty_session"}

        # Summarize using Groq (low temperature for consistency)
        summary = summarize_companion_session(history)

        # Update the conversation title with a readable label from the summary
        topic = summary.get("main_topic") or ""
        emotion = summary.get("primary_emotion") or ""
        auto_title = f"{emotion.capitalize()} — {topic}" if emotion and topic else topic or "Session"
        if len(auto_title) > 60:
            auto_title = auto_title[:57] + "..."

        try:
            (
                supabase.table("companion_conversations")
                .update({"title": auto_title})
                .eq("id", conversation_id)
                .eq("user_id", token_user_id)
                .execute()
            )
        except Exception:
            pass  # title update is best-effort

        print(
            f"SESSION_END conv={conversation_id} "
            f"emotion={summary.get('primary_emotion')} "
            f"topic={summary.get('main_topic')}"
        )
        return {
            "status": "summarized",
            "conversation_id": conversation_id,
            "summary": summary,
        }
    except HTTPException:
        raise
    except Exception as error:
        print(f"SESSION_END error={type(error).__name__}: {error}")
        return {"status": "error", "reason": str(error)[:120]}


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
        # NOTE: skipped_at does NOT exist in loop_tasks — never add it.
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


@app.post("/api/reflections/{entry_id}/embed")
async def schedule_reflection_embedding(
    entry_id: str,
    background_tasks: BackgroundTasks = None,
    authorization: str | None = Header(default=None),
):
    """Reflection Layer 2: fire-and-forget embedding trigger. The journal
    save has already succeeded (frontend -> Supabase) before this is called.
    Accepts NO text — only the entry id in the path; the backend re-fetches
    the entry server-side, scoped to the token user. Returns immediately;
    the embedding runs as a background task after the response."""
    token_user_id = validate_supabase_access_token(authorization)
    if background_tasks is None:
        background_tasks = BackgroundTasks()
    # Layer 2 -> Layer 3 trigger chain: embed, then analyse, one background
    # task. Composed in reflection_agent so journal_embeddings stays untouched.
    background_tasks.add_task(embed_and_analyse_task, supabase, token_user_id, entry_id)
    print(
        "REFLECTION_EMBEDDING "
        f"status=scheduled entry_id={entry_id} user_id={token_user_id}"
    )
    return {"status": "scheduled"}


@app.post("/api/reflections/{entry_id}/analyse")
async def schedule_reflection_analysis(
    entry_id: str,
    background_tasks: BackgroundTasks = None,
    authorization: str | None = Header(default=None),
):
    """Reflection Layer 3: fire-and-forget analysis trigger (also runs
    automatically after every embed via the trigger chain — this standalone
    endpoint exists for re-analysis and Layer 4). Accepts NO text; the agent
    re-fetches the entry server-side, scoped to the token user."""
    token_user_id = validate_supabase_access_token(authorization)
    if background_tasks is None:
        background_tasks = BackgroundTasks()
    background_tasks.add_task(analyse_entry_task, supabase, token_user_id, entry_id)
    print(
        "REFLECTION_AGENT "
        f"status=scheduled entry_id={entry_id} user_id={token_user_id}"
    )
    return {"status": "scheduled"}


@app.get("/api/reflections/pattern-reveal")
async def get_pattern_reveal(authorization: str | None = Header(default=None)):
    """Reflection Layer 4 — CHECK step. Called after the user completes all
    of today's tasks. Synchronous (not a background task): the frontend needs
    the answer immediately to decide whether to show the gentle prompt."""
    token_user_id = validate_supabase_access_token(authorization)
    try:
        return find_pending_reveal(supabase, token_user_id)
    except HTTPException:
        raise
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=reveal_check_failed user_id={token_user_id} "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to check pattern reveal") from error


@app.post("/api/reflections/pattern-reveal/seen")
async def mark_pattern_reveal_seen(authorization: str | None = Header(default=None)):
    """Reflection Layer 4 — fires only on 'Show me', never on 'Later'."""
    token_user_id = validate_supabase_access_token(authorization)
    try:
        cleared = clear_pending_reveal(supabase, token_user_id)
        return {"status": "cleared" if cleared else "nothing_pending"}
    except HTTPException:
        raise
    except Exception as error:
        print(
            "REFLECTION_AGENT "
            f"status=reveal_seen_failed user_id={token_user_id} "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to clear pattern reveal") from error


@app.get("/api/growth-tree/season")
async def get_growth_tree_season(authorization: str | None = Header(default=None)):
    """Growth Tree — season + milestone + stats. user_id comes from the
    token only; the module itself fails safe to THRIVING on data errors,
    so this endpoint never 500s for a data problem."""
    token_user_id = validate_supabase_access_token(authorization)
    return get_season_payload(supabase, token_user_id)


@app.get("/api/growth-tree/score")
async def get_growth_tree_score(authorization: str | None = Header(default=None)):
    """Growth Tree — canonical server-side score read (Requirement 6).
    Token-scoped; user_id is never accepted from the request."""
    token_user_id = validate_supabase_access_token(authorization)
    try:
        return get_score_payload(supabase, token_user_id)
    except HTTPException:
        raise
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=score_read_failed user_id={token_user_id} "
            f"error_type={type(error).__name__}"
        )
        raise HTTPException(status_code=500, detail="Failed to read score") from error


def _maybe_feed_loop_completion_signal(background_tasks: BackgroundTasks, user_id: str) -> None:
    """Part 4 — when today's Loop is fully done or skipped, schedule one
    companion_context signal via the exact retry-once/fail-open background
    task already used for the Companion flow (feed_orchestrator, see its
    one other call site above). Guarded so it only ever schedules once per
    user per day. Never raises — a failure here must never affect the
    dashboard response itself, which is why every step is wrapped.

    Deliberately does NOT reuse master_orchestrator._fetch_tasks_today's
    core-category check, which is stale (awareness/action/meaning only —
    missing reflection/reset; see the comment left on that function). This
    query uses the current five-category set directly.
    """
    try:
        today = datetime.utcnow().date().isoformat()
        rows = (
            supabase.table("loop_tasks")
            .select("completed_at,skipped,category")
            .eq("user_id", user_id)
            .eq("for_date", today)
            .execute()
        ).data or []
        if not rows:
            return
        if not all(row.get("completed_at") or row.get("skipped") for row in rows):
            return

        existing = (
            supabase.table("companion_context")
            .select("session_quality")
            .eq("user_id", user_id)
            .eq("date", today)
            .maybe_single()
            .execute()
        )
        if existing.data and existing.data.get("session_quality"):
            return  # already recorded today — don't re-fire

        today_categories = {normalize_category(row.get("category")) for row in rows}
        avoided = next((c for c in CORE_CATEGORY_ORDER if c not in today_categories), None)

        background_tasks.add_task(
            feed_orchestrator,
            supabase,
            {
                "user_id": user_id,
                "date": today,
                "session_quality": "deep",
                "task_recommendation": avoided,
            },
        )
    except Exception as error:
        print(
            "LOOP_COMPLETION_SIGNAL "
            f"status=check_failed user_id={user_id} "
            f"error_type={type(error).__name__}"
        )


@app.get("/api/dashboard")
async def get_dashboard(
    fresh: int = 0,
    authorization: str | None = Header(default=None),
    background_tasks: BackgroundTasks = None,
):
    """Master orchestrator — the dashboard's single payload. user_id from
    the token only. The module fails safe internally; this catch-all is the
    last line: the dashboard always renders, never errors.

    `fresh=1` skips the 15-minute cache READ for THIS caller only. Task
    completion is a direct client->Supabase RPC with no backend round-trip,
    so there is no server-side seam to invalidate the cache from; the
    continuation chain sends the hint after a completion event instead.
    The dashboard page itself never sends it, so ordinary rendering still
    reads cache and the cache is not perpetually defeated.

    SECURITY: `fresh` is a bare int flag and carries no identity. The cache
    key is token_user_id, resolved from the validated bearer token on the
    line below and never from query input, so this can only bypass the
    caller's own entry. It skips the CACHE, not the pipeline: the same
    token validation, the same user-scoped RLS-backed reads, and the same
    fresh crisis check all still run underneath."""
    token_user_id = validate_supabase_access_token(authorization)
    if background_tasks is None:
        background_tasks = BackgroundTasks()
    try:
        payload = get_dashboard_payload(
            supabase, token_user_id, force_fresh=bool(fresh)
        )
        _maybe_feed_loop_completion_signal(background_tasks, token_user_id)
        return payload
    except Exception as error:
        print(
            "MASTER_ORCHESTRATOR "
            f"status=endpoint_failed user_id={token_user_id} "
            f"error_type={type(error).__name__}"
        )
        return build_safe_default()


@app.get("/api/growth-tree/journey")
async def get_growth_tree_journey(authorization: str | None = Header(default=None)):
    """Growth Tree — Tree Memory timeline. Token-scoped. On any failure
    returns [] (logged): a missing journey is acceptable, a broken page
    is not."""
    token_user_id = validate_supabase_access_token(authorization)
    try:
        return build_journey(supabase, token_user_id)
    except Exception as error:
        print(
            "GROWTH_TREE "
            f"status=journey_failed user_id={token_user_id} "
            f"error_type={type(error).__name__}"
        )
        return []


@app.post("/api/life-companion")
@app.post("/api/life-companion/chat")
async def life_companion_chat(
    request: LifeCompanionRequest,
    background_tasks: BackgroundTasks = None,
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
        if background_tasks is None:
            background_tasks = BackgroundTasks()

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
        understanding = understand_companion_message(user_message, mode)
        request_slots = extract_request_slots(user_message, detected_intent)
        safety_signal = detect_life_companion_safety(user_message)

        def serve_escalation(escalation: dict):
            companion_response = escalation["response"]
            background_tasks.add_task(
                feed_orchestrator,
                supabase,
                build_orchestrator_payload(
                    user_id=token_user_id,
                    agent_turn=None,
                    message=user_message,
                    escalation_triggered=True,
                ),
            )
            log_life_companion_event(
                status="safety",
                mode=mode,
                provider="deterministic",
                risk_level=companion_response["safety"]["risk_level"],
                total_request_ms=int((perf_counter() - request_started) * 1000),
                context_build_ms=context_build_ms,
                prompt_build_ms=prompt_build_ms,
                retrieval_ms=retrieval_ms,
                provider_ms=0,
                validation_ms=0,
                provider_selected="deterministic",
                final_response_mode="safety",
            )
            return build_life_companion_response(
                "safety",
                companion_response,
                meta=build_life_companion_meta(
                    provider_selected="deterministic",
                    final_response_mode="safety",
                    fallback_reason=None,
                    provider_ms=0,
                    validation_ms=0,
                    total_request_ms=int((perf_counter() - request_started) * 1000),
                    context_build_ms=context_build_ms,
                    prompt_build_ms=prompt_build_ms,
                    retrieval_ms=retrieval_ms,
                ),
                conversation_id=conversation.get("id") if conversation else None,
            )

        # ── AGENT Gate 1: distress routes first (Guardrail 3 — before rate
        # limits, before retrieval, before any provider call. No exceptions.)
        distress_tier = detect_distress(user_message)
        if distress_tier or safety_signal.get("crisis"):
            escalation = escalation_trigger(
                token_user_id,
                distress_tier or "crisis",
                user_message,
                supabase=supabase,
            )
            return serve_escalation(escalation)

        # ── AGENT Gate 2: rate limits (deterministic pause, no provider call).
        # Sits below distress on purpose: a user at the cap in crisis still
        # gets the escalation response above.
        rate_status = check_rate_limits(supabase, token_user_id, request.conversation_id)
        if rate_status.session_exceeded or rate_status.daily_exceeded:
            pause_reply = (
                SESSION_PAUSE_MESSAGE if rate_status.session_exceeded else DAILY_LIMIT_MESSAGE
            )
            # Only the SESSION cap is permanent. Its count query has no time
            # filter, and this branch never persists the turn, so the count can
            # neither fall nor rise -- the conversation is frozen for good and
            # the composer should say so. The DAILY cap self-heals: its query is
            # a rolling 24h window, so rows age out and the user recovers
            # without acting. Flagging daily as closed would be a lie.
            conversation_closed = rate_status.session_exceeded
            companion_response = build_companion_payload(
                reply=pause_reply,
                action_type="new_conversation" if conversation_closed else "none",
                tone="grounded",
                risk_level="none",
                reply_format="conversation",
                intent="general_question",
            )
            total_request_ms = int((perf_counter() - request_started) * 1000)
            return build_life_companion_response(
                "rate_limited",
                companion_response,
                conversation_closed=conversation_closed,
                meta=build_life_companion_meta(
                    provider_selected="deterministic",
                    final_response_mode="rate_limited",
                    fallback_reason=None,
                    provider_ms=0,
                    validation_ms=0,
                    total_request_ms=total_request_ms,
                    context_build_ms=context_build_ms,
                    prompt_build_ms=prompt_build_ms,
                    retrieval_ms=retrieval_ms,
                ),
                conversation_id=request.conversation_id,
            )

        if conversation is None:
            conversation = create_companion_conversation(
                user_id=token_user_id,
            )

        conversation_history = fetch_companion_conversation_history(
            user_id=token_user_id,
            conversation_id=conversation.get("id") if conversation else None,
            limit=10,
        )

        # ── AGENT: ReAct loop (perceive → reason → act → observe). Produces
        # the sanitized message, the tools' signal outputs, the response mode,
        # and the directive block the single provider call will receive.
        agent_turn = run_react_loop(
            user_id=token_user_id,
            message=user_message,
            conversation_history=conversation_history,
            supabase=supabase,
            rate_status=rate_status,
        )
        if agent_turn.escalation:
            # Defense in depth — Gate 1 normally catches distress first.
            return serve_escalation(agent_turn.escalation)
        user_message = agent_turn.sanitized_message or user_message

        context_started = perf_counter()
        context = build_life_companion_context(
            supabase,
            token_user_id,
            mode,
            conversation_id=conversation.get("id") if conversation else None,
            current_intent=detected_intent,
        )
        context["latest_request_slots"] = request_slots
        context["understanding"] = understanding
        context["agent_directive_block"] = agent_turn.directive_block
        # Same predicate GUARDRAIL 1 uses to license a memory claim, computed
        # once here (where agent_turn is in scope) and carried to the prompt
        # builder. The memory block's "reference details / name patterns"
        # instructions are emitted only when this is True — otherwise the
        # model is told to do the exact thing check_fabricated_memory then
        # deletes. One predicate, one call site, no parallel copy to drift.
        context["has_memory_grounding"] = has_memory_grounding(
            agent_turn.tools_called,
            agent_turn.tool_results,
        )
        # The agent's FINAL response mode. The validator's content contract is
        # narrowed against it so a mode that was instructed not to give advice
        # is never rejected for failing to give advice. Acute panic markers
        # override that narrowing — see _validator_intent_from_classification.
        context["agent_response_mode"] = agent_turn.response_mode or ""

        # SECURITY 2: memory summary strings re-enter the prompt every turn —
        # injection-scan them before they do.
        safe_summary = context.get("safe_memory_summary")
        if isinstance(safe_summary, dict):
            context["safe_memory_summary"] = {
                key: (
                    sanitize_untrusted_text(
                        value, source="memory_summary", user_id=token_user_id
                    ).text
                    if isinstance(value, str)
                    else value
                )
                for key, value in safe_summary.items()
            }
        context_build_ms = int((perf_counter() - context_started) * 1000)

        retrieval_message = user_message
        retrieval_intent = detected_intent
        correction_target = (
            (context.get("safe_memory_summary") or {}).get("previous_user_request")
            if detected_intent == "correction_request"
            else None
        )
        if correction_target:
            retrieval_message = correction_target
            retrieval_intent = detect_companion_intent(correction_target, mode)
            context["correction_target_intent"] = retrieval_intent

        retrieval_started = perf_counter()
        knowledge_chunks = retrieve_companion_knowledge(
            retrieval_message,
            mode,
            retrieval_intent,
            max_chunks=4,
            understanding=understanding,
            safe_memory_summary=context.get("safe_memory_summary") or {},
        )
        retrieval_ms = int((perf_counter() - retrieval_started) * 1000)
        knowledge_used_count = len(knowledge_chunks)

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
                knowledge_used_count=knowledge_used_count,
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
                    knowledge_used_count=knowledge_used_count,
                ),
                conversation_id=updated_conversation["id"],
                conversation=updated_conversation,
            )

        gateway_result = generate_life_companion_response(
            prompt_version=LIFE_COMPANION_PROMPT_VERSION,
            mode=mode,
            context=context,
            user_message=user_message,
            knowledge_chunks=knowledge_chunks,
            understanding=understanding,
            conversation_history=conversation_history,
        )
        prompt_build_ms = gateway_result.prompt_build_ms or 0

        # ── AGENT: guardrails on the LLM reply. Applied only to live model
        # output — deterministic safety/fallback copy is already controlled,
        # and the crisis reply's own safety question must never be stripped.
        # Empty unless guardrails actually ran: they apply to live model output
        # only, so a gateway failure or fallback reply records no notes.
        _guardrails_fired: list[str] = []
        if gateway_result.status == "success":
            _reply = str(gateway_result.companion_response.get("reply") or "")
            _questions_allowed = count_questions_asked(conversation_history) < 2
            _guard = apply_guardrails(
                _reply,
                mode=agent_turn.response_mode or "REFLECT",
                tools_called=agent_turn.tools_called,
                tool_results=agent_turn.tool_results,
                questions_allowed=_questions_allowed,
                user_message=user_message,
                classification=agent_turn.classification,
            )
            gateway_result.companion_response["reply"] = _guard.reply
            _guardrails_fired = _guard.fired
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
            knowledge_used_count=knowledge_used_count,
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
                guardrails_fired=_guardrails_fired,
            )

        # ── AGENT STEP 7: orchestrator feed. Fire-and-forget after the
        # response is sent; never blocks the user (retry handled inside).
        background_tasks.add_task(
            feed_orchestrator,
            supabase,
            build_orchestrator_payload(
                user_id=token_user_id,
                agent_turn=agent_turn,
                message=user_message,
                escalation_triggered=False,
            ),
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
                knowledge_used_count=knowledge_used_count,
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


TASK_RETRIEVAL_PROMPT_VERSION = "task_retrieval_v1"
_RETRIEVAL_HIDDEN_TASK_FIELDS = ("inner_work_layer", "approach_angle", "journey_phase", "ikigai_quadrant")
_RETRIEVAL_DURATION_BY_INTENSITY = {"gentle": 5, "normal": 15, "deeper": 25}
_RETRIEVAL_MAX_CANDIDATES = 200
_RETRIEVAL_TASK_COUNT = 2
_RETRIEVAL_TITLE_OVERLAP_THRESHOLD = 0.70


def _retrieval_excerpt(text: str, max_sentences: int, max_words: int) -> str:
    """Mechanical trim of the library's own text: first N sentences, word-capped.
    Never introduces new words."""
    sentences = [s.strip() for s in _re.split(r"(?<=[.!?])\s+", str(text or "").strip()) if s.strip()]
    return limit_words(" ".join(sentences[:max_sentences]), max_words)


def _retrieval_task_title(task_text: str) -> str:
    text = str(task_text or "").strip()
    match = _re.search(r"[.!?—–]", text)
    clause = (text[: match.start()] if match else text).strip(" ,;:-—–")
    return limit_words(clause, 8) or "Practice"


def _retrieval_item_from_candidate(candidate: dict, category: str, duration_minutes: int) -> dict:
    task_text = str(candidate.get("task_text") or "")
    short_excerpt = _retrieval_excerpt(task_text, max_sentences=2, max_words=24)
    return {
        "category": category,
        "title": _retrieval_task_title(task_text),
        "why_this_helps": task_text,
        "waar_action": short_excerpt,
        "ikigai_purpose": short_excerpt,
        "kotler_tag": KOTLER_TAG_BY_CATEGORY.get(category, "Purpose"),
        "duration_minutes": duration_minutes,
        "inner_work_layer": candidate.get("inner_layer"),
        "approach_angle": candidate.get("approach_angle"),
        "journey_phase": candidate.get("level"),
        "ikigai_quadrant": candidate.get("ikigai"),
    }


def _pick_retrieval_tasks(
    candidates: list[dict],
    recent_titles_to_avoid: set[str],
    recent_title_strings: list[str],
    duration_minutes: int,
) -> list[dict]:
    """
    Greedy single pass over candidates already ranked by retrieve_candidates():
    the first (highest-scoring) hit per canonical category wins, until
    _RETRIEVAL_TASK_COUNT distinct categories are filled. A candidate that
    would fail a safety/tone/sanitizer/repetition check is skipped so the
    next-ranked candidate in that category gets a chance. Raises
    TaskValidationError('insufficient_categories:...') if fewer than
    _RETRIEVAL_TASK_COUNT categories ever fill - the caller treats this
    exactly like a validation failure and falls through to the hardcoded
    fallback.

    This absorbs the safety/tone/title-repetition checks that validate_ai_tasks
    (ai/validator.py) provides for the Gemini path, since the retrieval path
    only needs _RETRIEVAL_TASK_COUNT categories rather than all of
    CORE_CATEGORY_ORDER and validate_ai_tasks's all-or-nothing requirement
    isn't parameterized.
    """
    selected: dict[str, dict] = {}
    for candidate in candidates:
        category = normalize_category(candidate.get("category"))
        if category not in CORE_CATEGORY_ORDER or category in selected:
            continue
        try:
            item = _retrieval_item_from_candidate(candidate, category, duration_minutes)
            title = item["title"]
            if len(title) < 3:
                continue
            if normalize_title(title) in recent_titles_to_avoid:
                continue
            if any(
                _word_overlap_ratio(title, recent_title) >= _RETRIEVAL_TITLE_OVERLAP_THRESHOLD
                for recent_title in recent_title_strings
            ):
                continue
            combined_text = " ".join(str(value) for value in item.values() if value is not None)
            if has_pattern(combined_text, UNSAFE_PATTERNS):
                continue
            if has_pattern(combined_text, OVERWHELMING_PATTERNS):
                continue
            if has_pattern(combined_text, GENERIC_SPAM_PATTERNS):
                continue
            sanitize_waar_action(item["waar_action"])
            sanitize_ikigai_purpose(item["ikigai_purpose"])
            sanitize_detail_description(item["ikigai_purpose"], item["waar_action"])
        except TaskValidationError:
            continue
        selected[category] = item
        if len(selected) == _RETRIEVAL_TASK_COUNT:
            break

    if len(selected) < _RETRIEVAL_TASK_COUNT:
        raise TaskValidationError(f"insufficient_categories:{len(selected)}/{_RETRIEVAL_TASK_COUNT}")
    return [selected[c] for c in CORE_CATEGORY_ORDER if c in selected]


def _strip_hidden_task_fields(rows: list[dict]) -> list[dict]:
    return [
        {key: value for key, value in row.items() if key not in _RETRIEVAL_HIDDEN_TASK_FIELDS}
        for row in rows
    ]


@app.post("/api/generate-loop-tasks")
async def generate_tasks(request: TaskRequest, authorization: str | None = Header(default=None)):
    try:
        token_user_id = validate_supabase_access_token(authorization)
        if token_user_id != request.user_id:
            raise HTTPException(status_code=403, detail="Session user does not match request user")
        local_date = parse_iso_date_strict(request.local_date, "local_date").isoformat()

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
                    meta_struggles = (
                        raw_meta.get("struggle_tags")
                        or raw_meta.get("struggles")
                        or raw_meta.get("onboarding_answers")
                        or []
                    )
                    if isinstance(meta_struggles, list):
                        resolved_struggles = [str(s) for s in meta_struggles if s]
            except Exception:
                pass  # Safe: tier 3 handles this inside build_generation_context

        # Persist resolved struggles to user_behavior so the DB fallback tier
        # works for future sessions even after JWT metadata changes.
        if resolved_struggles:
            try:
                supabase.table("user_behavior").upsert(
                    {"user_id": request.user_id, "core_struggles": resolved_struggles[:4]},
                    on_conflict="user_id",
                ).execute()
            except Exception:
                pass  # Non-critical; do not block task generation

        existing_tasks = fetch_today_core_tasks(request.user_id, local_date)
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
            delete_uncompleted_generated_core_tasks(request.user_id, local_date)
            repair_mode = False
            missing_categories = list(CORE_CATEGORY_ORDER)

        _t0 = perf_counter()
        context = build_generation_context(
            resolved_struggles,
            request.current_streak,
            supabase=supabase,
            user_id=request.user_id,
            local_date=local_date,
            existing_tasks=existing_tasks,
        )
        context["auth_user_id"] = token_user_id
        _ctx_ms = int((perf_counter() - _t0) * 1000)

        tag = request.recalibrate_tag
        if tag and tag in RECALIBRATE_TAG_OVERRIDES and request.regenerate:
            context.update(RECALIBRATE_TAG_OVERRIDES[tag])
            print(f"AI_TASK_GENERATION recalibrate_tag={tag} overrides_applied=true")

        # ── INTELLIGENCE LAYER: build per-user reasoning context ─────────────
        _t1 = perf_counter()
        try:
            intel_ctx = build_task_intelligence_context(
                supabase,
                request.user_id,
                local_date,
                resolved_struggles,
                current_streak=request.current_streak,
            )
            intel_block = build_intelligence_context_block(intel_ctx)
        except Exception as _intel_err:
            intel_block = ""
            print(
                "AI_TASK_GENERATION "
                "status=intelligence_context_warn "
                f"error_type={type(_intel_err).__name__}"
            )
        _intel_ms = int((perf_counter() - _t1) * 1000)
        print(f"AI_TASK_GENERATION stage_timing context_ms={_ctx_ms} intel_ms={_intel_ms}")

        # ── RETRIEVAL: serve real library tasks instead of a Gemini call ──────
        _fail_reason = "task_retrieval_error"
        try:
            candidates = retrieve_candidates(
                context["struggles_summary"],
                max_candidates=_RETRIEVAL_MAX_CANDIDATES,
                journey_phase=intel_ctx.get("journey_phase"),
                focus_areas=intel_ctx.get("focus_areas"),
            )
            duration_minutes = _RETRIEVAL_DURATION_BY_INTENSITY.get(
                context.get("suggested_intensity"), 15
            )
            recent_titles = {
                normalize_title(t) for t in (context.get("recent_titles_to_avoid") or [])
            }
            recent_title_strings = [
                str(fp.get("title") or "")
                for fp in (context.get("recent_task_fingerprints") or [])
                if fp.get("title")
            ]
            retrieval_items = _pick_retrieval_tasks(
                candidates, recent_titles, recent_title_strings, duration_minutes
            )

            formatted_tasks = build_insert_rows(
                retrieval_items,
                user_id=request.user_id,
                local_date=local_date,
                ai_generated=False,
                generation_provider="task_library_retrieval",
                generation_model=None,
                generation_prompt_version=TASK_RETRIEVAL_PROMPT_VERSION,
            )
            if repair_mode:
                insert_status, rows = insert_repair_rows(
                    request.user_id,
                    local_date,
                    formatted_tasks,
                    missing_categories,
                )
            else:
                insert_status, rows = insert_task_rows(
                    request.user_id,
                    local_date,
                    formatted_tasks,
                    source="task_retrieval_success",
                )
            status = "existing" if insert_status == "existing" else (insert_status or "success")
            log_generation_event(
                status=status,
                provider="task_library_retrieval",
                prompt_version=TASK_RETRIEVAL_PROMPT_VERSION,
                context=context,
            )
            return build_task_response(status, _strip_hidden_task_fields(rows), context)

        except Exception as _retrieval_err:
            _fail_reason = (
                f"validation_failed:{_retrieval_err.reason}"
                if isinstance(_retrieval_err, TaskValidationError)
                else "task_retrieval_error"
            )
            print(
                "AI_TASK_GENERATION "
                "status=task_retrieval_failed "
                f"reason={_fail_reason} "
                f"error_type={type(_retrieval_err).__name__}"
            )

        # ── Fallback: identical contract to the previous Gemini-path fallback ──
        if request.allow_safe_fallback:
            delete_uncompleted_generated_core_tasks(request.user_id, local_date)
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                local_date,
                missing_categories if repair_mode else None,
                generation_provider="safe_fallback",
                generation_failure_reason=_fail_reason,
                force_insert_all=True,
            )
            log_generation_event(
                status="fallback",
                provider="safe_fallback",
                error_reason=_fail_reason,
                context=context,
            )
            return build_task_response(
                fallback_status,
                fallback_rows,
                context,
                meta_extra={
                    "provider": "safe_fallback",
                    "fallback_used": True,
                    "error_reason": _fail_reason,
                },
            )
        log_generation_event(
            status="retryable_ai_failure",
            error_reason=_fail_reason,
            context=context,
        )
        return build_retryable_task_failure_response(
            context=context,
            reason=_fail_reason,
        )
        # ─── end of generation block ─────────────────────────────────────────

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
