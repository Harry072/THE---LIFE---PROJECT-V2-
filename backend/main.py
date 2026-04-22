from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
import random, os, json, logging
from datetime import datetime, timezone
from auth import get_user_id

# Load environment variables
load_dotenv()

# Supabase Config
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("CRITICAL: SUPABASE_URL or SUPABASE_KEY missing from environment.")
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HAS_AI_KEY = bool(os.environ.get("GEMINI_API_KEY"))
if HAS_AI_KEY:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

app = FastAPI(title="The Life Project API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TaskRequest(BaseModel):
    user_id: str
    local_date: str
    context: dict = {}

@app.get("/api/get-loop-tasks")
async def get_loop_tasks(
    for_date: str = None,
    user_id: str = Depends(get_user_id)
):
    today_str = for_date or datetime.now().strftime("%Y-%m-%d")
    
    # Fetch from Supabase
    response = supabase.table("loop_tasks") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("for_date", today_str) \
        .execute()
    
    tasks = response.data or []
    
    return {
        "tasks": [
            {
                "id": t["id"],
                "title": t["title"],
                "subtitle": t["subtitle"],
                "category": t["category"],
                "why_this_helps": t["why"],
                "estimated_duration_mins": t["duration_minutes"],
                "supportive_tone_line": t.get("detail_description"),
                "done": t["done"]
            } for t in tasks
        ],
        "insight": "Your path is unfolding as it should."
    }

@app.post("/api/generate-loop-tasks")
async def generate_loop_tasks(
    payload: TaskRequest, 
    user_id_from_token: str = Depends(get_user_id) # kept for security verification
):
    context = payload.context
    struggle_profile = context.get("struggle_profile", ["general_growth"])
    for_date = payload.local_date
    
    def get_fallback_tasks():
        return [
            {"title": "Digital Space", "category": "focus", "why_this_helps": "Dopamine reset.", "estimated_duration_mins": 60, "detail_description": "Put your phone away."},
            {"title": "One Curious Thing", "category": "meaning", "why_this_helps": "Alignment.", "estimated_duration_mins": 10, "detail_description": "Explore a new topic."},
            {"title": "Breath Work", "category": "mental", "why_this_helps": "Calm.", "estimated_duration_mins": 5, "detail_description": "Five deep breaths."}
        ]

    tasks_to_generate = []
    if not HAS_AI_KEY:
        tasks_to_generate = get_fallback_tasks()
    else:
        prompt = f"""You are the Philosophical Guide Engine for "The Life Project" — an app designed to cure digital distraction by helping users rediscover their own existence and purpose.

A user is struggling with: {', '.join(struggle_profile)}.

Generate exactly 4 daily therapeutic tasks. Each task MUST be rooted in ONE of these four frameworks (use all four across the set):

1. **Logotherapy** (Viktor Frankl): Finding meaning even in suffering, boredom, or emptiness. The task should help the user discover that their discomfort is a compass pointing toward what matters. Suffering without meaning is unbearable; suffering with meaning becomes a passage.

2. **Morita Therapy**: Accept feelings as they are — do not fight anxiety, boredom, or restlessness. Instead, take purpose-driven action regardless of emotional state. The task should embody "action before motivation." Feelings are weather; purpose is the mountain.

3. **Flow State** (Csikszentmihalyi): Design a task that demands just enough challenge to pull the user beyond the shallow waters of distraction into deep, single-pointed engagement. The task should be a doorway out of the "2D dopamine loop" — the endless scroll, the flat screen — into the vast 3D landscape of real experience.

4. **Ikigai**: Align the task with the intersection of what the user loves, what they are good at, what the world needs, and what gives them a quiet sense of aliveness. The task should whisper: "This is why you are here."

**TONE RULES:**
- Write as if you are an ancient sage who also understands neuroscience.
- Use metaphors of vast mental landscapes: oceans of attention, mountains of discipline, forests of curiosity.
- Reference the "dopamine loop" as a flat, grey prison — and these tasks as keys to a world with depth, color, and texture.
- Each task's "why_this_helps" field must feel like a personal letter — not clinical advice, but a whispered truth.
- The "detail_description" should be what a wise mentor would say after the user completes the task.

**STRUCTURAL RULES:**
- Duration should range from 5 to 60 minutes, appropriate to the task depth.

Return a JSON array of exactly 4 objects with these exact keys:
category, title, estimated_duration_mins, why_this_helps, detail_description

Categories MUST be one of: focus, meaning, reflection, discipline, action, emotional-reset, awareness, health.

Return ONLY the JSON array, no markdown wrapping."""
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            res = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            tasks_to_generate = json.loads(res.text)
        except Exception as e:
            print(f"Gemini API Error: {str(e)}")
            raise HTTPException(status_code=500, detail="AI generation failed.")

    today_str = for_date
    
    # 1. Clear existing tasks for today in Supabase
    supabase.table("loop_tasks") \
        .delete() \
        .eq("user_id", payload.user_id) \
        .eq("for_date", today_str) \
        .execute()
    
    # 2. Insert new tasks
    insert_data = []
    for idx, t in enumerate(tasks_to_generate):
        insert_data.append({
            "user_id": payload.user_id,
            "for_date": today_str,
            "title": t.get("title"),
            "subtitle": t.get("category", "").title(), # Fallback visual formatting
            "category": t.get("category"),
            "why": t.get("why_this_helps"),
            "detail_title": t.get("title"),
            "detail_description": t.get("detail_description"),
            "duration_minutes": t.get("estimated_duration_mins", 15),
            "intensity": "medium",
            "is_optional": idx == 3, # Makes the 4th task optional automatically
            "preferred_time": "morning",
            "done": False
        })
    
    try:
        response = supabase.table("loop_tasks").insert(insert_data).execute()
        saved_tasks = response.data or []
    except Exception as e:
        print(f"Supabase Insert Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")
    
    return {
        "tasks": [
            {
                "id": t["id"],
                "title": t["title"],
                "subtitle": t["subtitle"],
                "category": t["category"],
                "why_this_helps": t["why"],
                "estimated_duration_mins": t["duration_minutes"],
                "supportive_tone_line": t.get("detail_description"),
                "done": t["done"]
            } for t in saved_tasks
        ],
        "insight": "A new path is set."
    }


@app.post("/api/toggle-task/{task_id}")
async def toggle_task(
    task_id: str,
    user_id: str = Depends(get_user_id)
):
    # Call the production RPC for task completion to trigger scoring pipeline
    # complete_loop_task_v4(p_task_id UUID)
    try:
        response = supabase.rpc("complete_loop_task_v4", {"p_task_id": task_id}).execute()
        if response.data and response.data.get("status") == "success":
            return {"status": "success", "done": True}
        
        # Fallback for un-completing (if not handled by RPC yet)
        # Note: complete_loop_task_v4 is designed for completion. 
        # If we need to toggle OFF, we do it manually.
        current = supabase.table("loop_tasks").select("done").eq("id", task_id).single().execute()
        new_state = not current.data["done"]
        supabase.table("loop_tasks").update({"done": new_state, "completed_at": datetime.utcnow().isoformat() if new_state else None}).eq("id", task_id).execute()
        return {"status": "success", "done": new_state}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
