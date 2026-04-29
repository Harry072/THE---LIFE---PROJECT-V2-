from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai

from ai.context import (
    ALLOWED_LOOP_CATEGORIES,
    CORE_CATEGORY_ORDER,
    build_generation_context,
    build_weekly_mirror_context,
    normalize_category,
)
from ai.fallbacks import (
    generate_fallback_tasks,
    generate_fallback_weekly_mirror,
    generate_insufficient_weekly_mirror,
)
from ai.gateway import AIGenerationError, generate_with_gemini
from ai.prompts import (
    LOOP_TASKS_PROMPT_VERSION,
    WEEKLY_MIRROR_PROMPT_VERSION,
    build_loop_tasks_prompt,
    build_weekly_mirror_prompt,
)
from ai.validator import (
    TaskValidationError,
    WeeklyMirrorValidationError,
    normalize_task_for_insert,
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
gemini_model = None

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
    gemini_model = genai.GenerativeModel(gemini_model_name)
else:
    print(
        "AI_TASK_GENERATION "
        "provider_unavailable=true provider=gemini "
        "reason=missing_gemini_api_key"
    )

# 2. SCHEMA FIX: Receive the exact identity and date from React
class TaskRequest(BaseModel):
    user_id: str
    local_date: str
    struggles: list[str] = Field(default_factory=list)
    current_streak: int = 0
    regenerate: bool = False


class WeeklySynthesisRequest(BaseModel):
    user_id: str
    week_start: str
    week_end: str


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
            f"reason=invalid_token error={type(auth_error).__name__}:{str(auth_error)}"
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
    context: dict | None = None,
) -> None:
    context_used = ",".join((context or {}).get("context_used") or []) or "none"
    streak_band = (context or {}).get("streak_band") or "n/a"
    completion_pattern = (context or {}).get("completion_pattern") or "n/a"
    suggested_intensity = (context or {}).get("suggested_intensity") or "n/a"
    latest_mood_present = bool((context or {}).get("latest_mood"))
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
        f"error_reason={error_reason or 'none'}"
    )


def build_response_meta(context: dict | None = None, *, cached: bool = False) -> dict:
    return {
        "prompt_version": LOOP_TASKS_PROMPT_VERSION,
        "personalization_level": "lite",
        "context_used": ["cache"] if cached else (context or {}).get("context_used", []),
    }


def build_task_response(
    status: str,
    rows: list[dict],
    context: dict | None = None,
    *,
    cached: bool = False,
) -> dict:
    return {
        "status": status,
        "data": rows,
        "meta": build_response_meta(context, cached=cached),
    }


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


def insert_task_rows(
    user_id: str,
    local_date: str,
    rows: list[dict],
    *,
    source: str,
) -> tuple[str, list[dict]]:
    try:
        db_response = supabase.table("loop_tasks").insert(rows).execute()
        return "inserted", sort_task_rows(db_response.data or [])
    except Exception as insert_error:
        if is_duplicate_insert_error(insert_error):
            print(
                "AI_TASK_GENERATION "
                f"duplicate_insert_caught=true source={source} "
                f"error={str(insert_error)}"
            )
            existing_after_race = fetch_today_core_tasks(user_id, local_date)
            print(
                "AI_TASK_GENERATION "
                f"duplicate_refetch source={source} "
                f"existing_count={len(existing_after_race)}"
            )
            if existing_after_race:
                if source == "fallback":
                    return "fallback_existing", existing_after_race
                return "existing", existing_after_race
        raise


def build_insert_rows(
    tasks: list[dict],
    user_id: str,
    local_date: str,
    ai_generated: bool,
) -> list[dict]:
    return [
        normalize_task_for_insert(
            task,
            user_id=user_id,
            local_date=local_date,
            index=index,
            ai_generated=ai_generated,
        )
        for index, task in enumerate(tasks)
    ]


def save_fallback_tasks(context: dict, user_id: str, local_date: str) -> tuple[str, list[dict]]:
    # Another request may have inserted tasks while the AI call was failing.
    existing_after_failure = fetch_today_core_tasks(user_id, local_date)
    if existing_after_failure:
        return "existing", existing_after_failure

    fallback_tasks = generate_fallback_tasks(context)
    fallback_rows = build_insert_rows(
        fallback_tasks,
        user_id=user_id,
        local_date=local_date,
        ai_generated=False,
    )
    insert_status, rows = insert_task_rows(
        user_id,
        local_date,
        fallback_rows,
        source="fallback",
    )
    if insert_status in {"existing", "fallback_existing"}:
        return insert_status, rows
    return "fallback", rows


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

        existing_tasks = fetch_today_core_tasks(request.user_id, request.local_date)

        if existing_tasks and not request.regenerate:
            return build_task_response("existing", existing_tasks, cached=True)

        if request.regenerate and existing_tasks:
            if any(is_completed_task(task) for task in existing_tasks):
                return build_task_response("locked", existing_tasks, cached=True)

            delete_uncompleted_generated_core_tasks(request.user_id, request.local_date)

        context = build_generation_context(
            request.struggles,
            request.current_streak,
            supabase=supabase,
            user_id=request.user_id,
            local_date=request.local_date,
            existing_tasks=existing_tasks,
        )
        context["auth_user_id"] = token_user_id
        prompt = build_loop_tasks_prompt(context)

        if gemini_model is None:
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                request.local_date,
            )
            log_generation_event(
                status=fallback_status,
                provider="fallback",
                error_reason="provider_unavailable",
                context=context,
            )
            return build_task_response(fallback_status, fallback_rows, context)

        try:
            provider_response = generate_with_gemini(
                gemini_model,
                prompt,
                prompt_version=LOOP_TASKS_PROMPT_VERSION,
            )
            category_tasks = validate_ai_tasks(provider_response.text, context)
            formatted_tasks = build_insert_rows(
                category_tasks,
                user_id=request.user_id,
                local_date=request.local_date,
                ai_generated=True,
            )
            insert_status, rows = insert_task_rows(
                request.user_id,
                request.local_date,
                formatted_tasks,
                source="ai_success",
            )
            status = "existing" if insert_status == "existing" else "success"
            log_generation_event(
                status=status,
                provider=provider_response.provider,
                prompt_version=provider_response.prompt_version,
                latency_ms=provider_response.latency_ms,
                context=context,
            )
            return build_task_response(status, rows, context)
        except TaskValidationError as validation_error:
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                request.local_date,
            )
            log_generation_event(
                status=fallback_status,
                validation_failure_reason=validation_error.reason,
                context=context,
            )
            return build_task_response(fallback_status, fallback_rows, context)
        except AIGenerationError as ai_error:
            fallback_status, fallback_rows = save_fallback_tasks(
                context,
                request.user_id,
                request.local_date,
            )
            log_generation_event(
                status=fallback_status,
                latency_ms=ai_error.latency_ms,
                error_reason=ai_error.reason,
                context=context,
            )
            return build_task_response(fallback_status, fallback_rows, context)
        
    except HTTPException:
        raise
    except Exception as e:
        # 5. NO MORE SILENT FAILS: Print error to terminal and alert frontend
        print(f"CRITICAL BACKEND ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to generate or save tasks: {str(e)}")
