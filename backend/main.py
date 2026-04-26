from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
from supabase import create_client, Client
import json
import re
from dotenv import load_dotenv
import google.generativeai as genai

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


ALLOWED_LOOP_CATEGORIES = {
    "awareness",
    "action",
    "meaning",
}

CORE_CATEGORY_ORDER = ["awareness", "action", "meaning"]


CATEGORY_ALIASES = {
    "awareness": "awareness",
    "reflection": "awareness",
    "reflect": "awareness",
    "mindfulness": "awareness",
    "journaling": "awareness",
    "journal": "awareness",
    "clarity": "awareness",
    "breathing": "awareness",
    "action": "action",
    "focus": "action",
    "discipline": "action",
    "health": "action",
    "exercise": "action",
    "movement": "action",
    "sleep": "action",
    "connection": "action",
    "contribution": "meaning",
    "service": "meaning",
    "purpose": "meaning",
    "meaning": "meaning",
    "gratitude": "meaning",
    "ikigai": "meaning",
    "logotherapy": "meaning",
}


def normalize_category(value: str | None) -> str:
    raw_category = str(value or "meaning").strip().lower().replace("_", "-")

    if raw_category in ALLOWED_LOOP_CATEGORIES:
        return raw_category

    if raw_category in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[raw_category]

    for token in raw_category.split("-"):
        if token in CATEGORY_ALIASES:
            return CATEGORY_ALIASES[token]

    return "meaning"


def parse_model_json(raw_text: str):
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return json.loads(cleaned.strip(), strict=False)


def limit_words(text: str, max_words: int) -> str:
    words = str(text or "").split()
    return " ".join(words[:max_words]).strip()


def ensure_terminal_punctuation(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned:
        return cleaned
    return cleaned if cleaned[-1] in ".!?" else f"{cleaned}."


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


def is_generated_core_task(row: dict) -> bool:
    category = normalize_category(row.get("category"))
    return (
        category in ALLOWED_LOOP_CATEGORIES
        and not bool(row.get("is_optional"))
        and bool(row.get("ai_generated", True))
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
        if is_generated_core_task(row)
    ])


def delete_uncompleted_generated_core_tasks(user_id: str, local_date: str) -> None:
    for category in CORE_CATEGORY_ORDER:
        (
            supabase.table("loop_tasks")
            .delete()
            .eq("user_id", user_id)
            .eq("for_date", local_date)
            .eq("category", category)
            .eq("ai_generated", True)
            .eq("is_optional", False)
            .eq("done", False)
            .filter("completed_at", "is", "null")
            .execute()
        )


def default_task_for_category(category: str, struggles_summary: str) -> dict:
    defaults = {
        "awareness": {
            "title": "Awareness Practice",
            "estimated_duration_mins": 5,
            "why_this_helps": "Noticing the pattern lowers its grip and creates room for choice.",
            "philosophy": "Clarity starts when attention stops running on autopilot.",
            "action_step": "Action: Write one loop you noticed today.",
        },
        "action": {
            "title": "Action Practice",
            "estimated_duration_mins": 15,
            "why_this_helps": "A small physical action interrupts avoidance and rebuilds trust.",
            "philosophy": "Momentum returns through one useful movement.",
            "action_step": "Action: Do one postponed task for ten minutes.",
        },
        "meaning": {
            "title": "Meaning Practice",
            "estimated_duration_mins": 5,
            "why_this_helps": "Connecting action to meaning makes discipline feel less mechanical.",
            "philosophy": "Purpose becomes visible through one honest choice.",
            "action_step": "Action: Name who benefits from your effort.",
        },
    }
    task = defaults[category].copy()
    task["category"] = category
    return task


def select_one_task_per_category(tasks_data: list[dict], struggles_summary: str) -> list[dict]:
    selected: dict[str, dict] = {}

    for task in tasks_data:
        if not isinstance(task, dict):
            continue

        category = normalize_category(task.get("category"))
        if category in ALLOWED_LOOP_CATEGORIES and category not in selected:
            selected[category] = {**task, "category": category}

    return [
        selected.get(category) or default_task_for_category(category, struggles_summary)
        for category in CORE_CATEGORY_ORDER
    ]


def sanitize_detail_description(detail_description: str, fallback_action: str = "") -> str:
    normalized = str(detail_description or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    normalized = normalized.strip("\"").strip("'")

    action_match = re.match(r"^(.*?)(?:\n\s*\n)?Action:\s*(.+)$", normalized, re.S)
    if action_match:
        benefit_text = action_match.group(1)
        action_text = action_match.group(2)
    else:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", normalized) if part.strip()]
        benefit_text = paragraphs[0] if paragraphs else normalized
        action_text = paragraphs[1] if len(paragraphs) > 1 else ""

    benefit_text = limit_words(" ".join(benefit_text.split()), 15)
    action_text = limit_words(" ".join((action_text or fallback_action).split()), 10)

    if action_text.lower().startswith("action:"):
        action_text = action_text[7:].strip()

    benefit_text = ensure_terminal_punctuation(
        benefit_text or "Calm focus returns when attention meets one clear task"
    )
    action_text = ensure_terminal_punctuation(
        action_text or "Open a notebook and begin now"
    )

    return f"{benefit_text}\n\nAction: {action_text}"


def normalize_generated_task(task: dict, user_id: str, local_date: str, index: int) -> dict:
    category = normalize_category(task.get("category"))
    title = str(task.get("title") or f"Meaningful Task {index + 1}").strip()
    why_this_helps = str(task.get("why_this_helps") or "").strip()
    detail_description = str(task.get("detail_description") or "").strip()
    raw_action_steps = task.pop("action_steps", None)

    if isinstance(raw_action_steps, list):
        fallback_action = next(
            (
                " ".join(str(step).replace("\n", " ").split())
                for step in raw_action_steps
                if str(step).strip()
            ),
            "",
        )
    else:
        fallback_action = str(raw_action_steps or "").replace("\n", " ").strip()

    detail_description = sanitize_detail_description(detail_description, fallback_action)

    try:
        duration_minutes = int(task.get("estimated_duration_mins") or 15)
    except (TypeError, ValueError):
        duration_minutes = 15

    return {
        "user_id": user_id,
        "for_date": local_date,
        "category": category,
        "title": title,
        "subtitle": f"{category.title()} Practice",
        "why": why_this_helps,
        "detail_title": title,
        "detail_description": detail_description,
        "duration_minutes": max(5, duration_minutes),
        "sort_order": index + 1,
        "ai_generated": True,
        "is_optional": False,
        "done": False,
    }


@app.post("/api/generate-loop-tasks")
async def generate_tasks(request: TaskRequest):
    try:
        existing_tasks = fetch_today_core_tasks(request.user_id, request.local_date)

        if existing_tasks and not request.regenerate:
            return {"status": "existing", "data": existing_tasks}

        if request.regenerate and existing_tasks:
            if any(is_completed_task(task) for task in existing_tasks):
                return {"status": "locked", "data": existing_tasks}

            delete_uncompleted_generated_core_tasks(request.user_id, request.local_date)

        struggles = [
            struggle.strip()
            for struggle in request.struggles
            if str(struggle).strip()
        ]
        struggles_summary = ", ".join(struggles) if struggles else "overthinking, distraction, and inconsistency"
        current_day = max(0, int(request.current_streak))

        if current_day < 5:
            journey_guidance = "Focus on gentle awareness and nervous-system safety."
        elif current_day <= 15:
            journey_guidance = "Focus on taking clear action and building consistency."
        else:
            journey_guidance = "Focus on deep purpose, meaning, and identity-level growth."

        # 3. PHILOSOPHICAL AI PROMPT
        prompt = f"""
        Generate exactly 3 deeply meaningful daily tasks based on Logotherapy, Morita Therapy, Flow State, and Ikigai.
        Help the user break the 2D dopamine loop and return to deliberate living.
        The user is struggling with {struggles_summary}. They are on Day {current_day}.
        Tailor tasks to heal these exact struggles.
        If Day < 5, focus on gentle awareness. If Day 5-15, focus on taking action. If Day > 15, focus on deep purpose and meaning.
        Current day guidance: {journey_guidance}
        Create one task for each category, in this exact order:
        1. "awareness"
        2. "action"
        3. "meaning"
        Rules:
        - Output strictly valid JSON with NO raw newlines (`\\n`) inside strings.
        - Do not use markdown, bullet points, numbering, code fences, or commentary.
        - Do not output "detail_description"; output "philosophy" and "action_step" instead.
        - "philosophy" must be one short, gentle, poetic sentence. Max 15 words.
        - "philosophy" must stay on one line.
        - "action_step" must start with "Action:" and describe one highly specific, physical action. Max 10 words.
        - "action_step" must stay on one line.
        - Keep every string compact, concrete, and healing.
        Output ONLY valid JSON in this exact format:
        [
          {{
            "category": "awareness",
            "title": "Task Name",
            "estimated_duration_mins": 20,
            "why_this_helps": "Short philosophical reason based on Morita or Logotherapy.",
            "philosophy": "Breathing room begins when the mind stops carrying everything at once.",
            "action_step": "Action: Write three thoughts on paper."
          }}
        ]
        """
        response = gemini_model.generate_content(prompt)
        tasks_data = parse_model_json(response.text)

        if not isinstance(tasks_data, list) or not tasks_data:
            raise ValueError("Gemini returned an invalid task payload.")

        category_tasks = select_one_task_per_category(tasks_data, struggles_summary)

        for task in category_tasks:
            task["philosophy"] = str(task.get("philosophy") or "")
            task["action_step"] = str(task.get("action_step") or "")
            task["detail_description"] = f"{task.pop('philosophy', '').strip()}\n\n{task.pop('action_step', '').strip()}"

        # 4. STRICT SUPABASE INSERT PIPELINE
        formatted_tasks = [
            normalize_generated_task(task, request.user_id, request.local_date, index)
            for index, task in enumerate(category_tasks)
        ]

        # Insert into the database. If a concurrent request won the unique index
        # race, return the existing daily practices instead of creating duplicates.
        try:
            db_response = supabase.table("loop_tasks").insert(formatted_tasks).execute()
        except Exception as insert_error:
            duplicate_message = str(insert_error).lower()
            if "duplicate" in duplicate_message or "idx_loop_unique_incomplete_generated_core" in duplicate_message:
                existing_after_race = fetch_today_core_tasks(request.user_id, request.local_date)
                if existing_after_race:
                    return {"status": "existing", "data": existing_after_race}
            raise
        
        return {"status": "success", "data": sort_task_rows(db_response.data or [])}

    except Exception as e:
        # 5. NO MORE SILENT FAILS: Print error to terminal and alert frontend
        print(f"CRITICAL BACKEND ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to generate or save tasks: {str(e)}")
