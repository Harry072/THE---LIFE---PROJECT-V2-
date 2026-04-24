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
    return json.loads(cleaned.strip(), strict=False)


def limit_words(text: str, max_words: int) -> str:
    words = str(text or "").split()
    return " ".join(words[:max_words]).strip()


def ensure_terminal_punctuation(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned:
        return cleaned
    return cleaned if cleaned[-1] in ".!?" else f"{cleaned}."


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
        Generate 3 deeply meaningful daily tasks based on Logotherapy, Morita Therapy, Flow State, and Ikigai.
        Help the user break the 2D dopamine loop and return to deliberate living.
        The user is struggling with {struggles_summary}. They are on Day {current_day}.
        Tailor tasks to heal these exact struggles.
        If Day < 5, focus on gentle awareness. If Day 5-15, focus on taking action. If Day > 15, focus on deep purpose and meaning.
        Current day guidance: {journey_guidance}
        The category for each task MUST be one of exactly these values:
        ["awareness", "action", "meaning"]
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

        for task in tasks_data[:3]:
            task["philosophy"] = str(task.get("philosophy") or "")
            task["action_step"] = str(task.get("action_step") or "")
            task["detail_description"] = f"{task.pop('philosophy', '').strip()}\n\n{task.pop('action_step', '').strip()}"

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
