from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from supabase import create_client, Client
import json
from dotenv import load_dotenv
from google import genai

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

gemini_model = get_env_value("GEMINI_MODEL") or "gemini-2.5-flash"
gemini_client = genai.Client(api_key=gemini_api_key)

# 2. SCHEMA FIX: Receive the exact identity and date from React
class TaskRequest(BaseModel):
    user_id: str
    local_date: str


ALLOWED_LOOP_CATEGORIES = {
    "awareness",
    "action",
    "meaning",
}


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
    return json.loads(cleaned.strip())


def normalize_generated_task(task: dict, user_id: str, local_date: str, index: int) -> dict:
    category = normalize_category(task.get("category"))
    title = str(task.get("title") or f"Meaningful Task {index + 1}").strip()
    why_this_helps = str(task.get("why_this_helps") or "").strip()
    detail_description = str(task.get("detail_description") or "").strip()

    try:
        duration_minutes = int(task.get("estimated_duration_mins") or 15)
    except (TypeError, ValueError):
        duration_minutes = 15

    return {
        "user_id": user_id,
        "for_date": local_date,
        "category": category,
        "title": title,
        "subtitle": category.replace("-", " ").title(),
        "why": why_this_helps,
        "detail_title": title,
        "detail_description": detail_description,
        "duration_minutes": max(5, duration_minutes),
        "sort_order": index + 1,
        "ai_generated": True,
    }


@app.post("/api/generate-loop-tasks")
async def generate_tasks(request: TaskRequest):
    try:
        # 3. PHILOSOPHICAL AI PROMPT
        prompt = """
        Generate 3 deeply meaningful daily tasks based on Logotherapy, Morita Therapy, Flow State, and Ikigai.
        Help the user break the 2D dopamine loop and find their own existence.
        The category for each task MUST be one of exactly these values:
        ["awareness", "action", "meaning"]
        Output ONLY valid JSON in this exact format:
        [
          {
            "category": "awareness",
            "title": "Task Name",
            "estimated_duration_mins": 20,
            "why_this_helps": "Short philosophical reason based on Morita or Logotherapy.",
            "detail_description": "How to execute this task to achieve mental freedom."
          }
        ]
        """
        response = gemini_client.models.generate_content(
            model=gemini_model,
            contents=prompt,
        )
        tasks_data = parse_model_json(response.text)

        if not isinstance(tasks_data, list) or not tasks_data:
            raise ValueError("Gemini returned an invalid task payload.")

        # 4. STRICT SUPABASE INSERT PIPELINE
        formatted_tasks = [
            normalize_generated_task(task, request.user_id, request.local_date, index)
            for index, task in enumerate(tasks_data[:3])
        ]

        # Insert into the database
        db_response = supabase.table("loop_tasks").insert(formatted_tasks).execute()
        
        return {"status": "success", "data": db_response.data}

    except Exception as e:
        # 5. NO MORE SILENT FAILS: Print error to terminal and alert frontend
        print(f"CRITICAL BACKEND ERROR: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to generate or save tasks: {str(e)}")
