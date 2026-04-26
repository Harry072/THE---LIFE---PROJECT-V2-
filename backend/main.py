from pathlib import Path

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
    normalize_category,
)
from ai.fallbacks import generate_fallback_tasks
from ai.gateway import AIGenerationError, generate_with_gemini
from ai.prompts import LOOP_TASKS_PROMPT_VERSION, build_loop_tasks_prompt
from ai.validator import (
    TaskValidationError,
    normalize_task_for_insert,
    validate_ai_tasks,
)

app = FastAPI()

# 1. BULLETPROOF CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


def get_env_value(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    return value.strip().strip("\"").strip("'")


supabase_url = get_env_value("SUPABASE_URL")
supabase_key = get_env_value("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

supabase: Client = create_client(supabase_url, supabase_key)

# Initialize Gemini
gemini_api_key = get_env_value("GEMINI_API_KEY")
if not gemini_api_key:
    raise RuntimeError("GEMINI_API_KEY must be set in backend/.env")

gemini_model_name = get_env_value("GEMINI_MODEL") or "gemini-2.5-flash"
genai.configure(api_key=gemini_api_key)
gemini_model = genai.GenerativeModel(gemini_model_name)

# 2. SCHEMA FIX: Receive the exact identity and date from React
class TaskRequest(BaseModel):
    user_id: str
    local_date: str
    struggles: list[str] = Field(default_factory=list)
    current_streak: int = 0
    regenerate: bool = False


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


@app.post("/api/generate-loop-tasks")
async def generate_tasks(request: TaskRequest, authorization: str | None = Header(default=None)):
    try:
        auth_header_present = bool(authorization and authorization.lower().startswith("bearer "))
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
        context["auth_header_present"] = auth_header_present
        prompt = build_loop_tasks_prompt(context)

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
        
    except Exception as e:
        # 5. NO MORE SILENT FAILS: Print error to terminal and alert frontend
        print(f"CRITICAL BACKEND ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to generate or save tasks: {str(e)}")
