import json


LOOP_TASKS_PROMPT_VERSION = "loop_tasks_v2"
WEEKLY_MIRROR_PROMPT_VERSION = "weekly_mirror_v1"


INTENSITY_GUIDANCE = {
    "gentle": "Use very small, emotionally light tasks from 2 to 10 minutes.",
    "normal": "Use grounded daily tasks from 10 to 20 minutes.",
    "deeper": "Use meaningful but still doable tasks from 20 to 30 minutes.",
}

INTENSITY_EXAMPLE_DURATIONS = {
    "gentle": {"awareness": 5, "action": 5, "meaning": 5},
    "normal": {"awareness": 10, "action": 15, "meaning": 10},
    "deeper": {"awareness": 20, "action": 25, "meaning": 20},
}


def build_loop_tasks_prompt(context: dict) -> str:
    struggles_summary = context["struggles_summary"]
    current_day = context["current_day"]
    journey_guidance = context["journey_guidance"]
    streak_band = context.get("streak_band") or "new"
    completion_pattern = context.get("completion_pattern") or "mixed"
    strong_categories = context.get("strong_categories") or []
    weak_categories = context.get("weak_categories") or []
    suggested_intensity = context.get("suggested_intensity") or "normal"
    latest_mood = context.get("latest_mood") or "not provided"
    prompt_labels = context.get("prompt_labels") or []
    context_note = context.get("context_note") or "Use balanced, concrete tasks that are easy to start today."
    recent_titles = context.get("recent_titles_to_avoid") or context.get("recent_titles") or []
    recent_title_text = ", ".join(recent_titles[:8]) if recent_titles else "none"
    prompt_label_text = ", ".join(prompt_labels[:3]) if prompt_labels else "none"
    intensity_guidance = INTENSITY_GUIDANCE.get(
        suggested_intensity,
        INTENSITY_GUIDANCE["normal"],
    )
    example_durations = INTENSITY_EXAMPLE_DURATIONS.get(
        suggested_intensity,
        INTENSITY_EXAMPLE_DURATIONS["normal"],
    )

    return f"""
Generate exactly 3 daily core practices for The Life Project.
Use only this compact, privacy-safe personalization context:
- Request struggles summary: {struggles_summary}
- Current streak day: {current_day}
- Streak band: {streak_band}
- Completion pattern: {completion_pattern}
- Strong categories: {", ".join(strong_categories) if strong_categories else "none"}
- Weak categories: {", ".join(weak_categories) if weak_categories else "none"}
- Latest mood label: {latest_mood}
- Reflection prompt labels only: {prompt_label_text}
- Context note: {context_note}
- Current day guidance: {journey_guidance}
- Suggested intensity: {suggested_intensity}. {intensity_guidance}
- Recent task titles to avoid repeating exactly: {recent_title_text}

Create one task for each category, in this exact order:
1. "awareness"
2. "action"
3. "meaning"

Safety and quality rules:
- Output strictly valid JSON only.
- Do not use markdown, bullets, numbering, code fences, or commentary.
- Use the compact context, but do not mention private data or infer anything clinical.
- Do not diagnose the user or make medical, clinical, or treatment claims.
- Do not give harmful advice or extreme instructions.
- Do not create overwhelming tasks; each task must be doable today.
- Do not use shame-heavy language or imply the user is failing.
- Avoid generic productivity spam like "be productive", "stay motivated", or "think positive".
- Avoid exact title repeats from the recent title list.
- Each task must be simple, concrete, physical or written, and emotionally grounded.
- If a category is weak, make that category especially approachable.
- "title" must describe the concrete practice.
- "subtitle" must be a short human label, not a slogan.
- "detail_description" must be one calm reason sentence followed by "Action:" and one concrete action.
- "duration_minutes" must match suggested intensity.
- "preferred_time_of_day" must be morning, afternoon, evening, or today.
- "supportive_line" must be one calm sentence, max 16 words.
- "why_chosen" must be one calm sentence, max 18 words.
- "easier_version" must be one smaller version of the same task.

Output ONLY valid JSON in this exact shape:
[
  {{
    "category": "awareness",
    "title": "Write the Loop Down",
    "subtitle": "Awareness Practice",
    "why_this_helps": "Naming the loop makes your next choice easier.",
    "detail_description": "Naming the thought lowers its grip. Action: Sit quietly and write the thought your mind keeps returning to.",
    "duration_minutes": {example_durations["awareness"]},
    "preferred_time_of_day": "morning",
    "supportive_line": "Clarity begins when the loop is no longer invisible.",
    "why_chosen": "This helps you notice the loop before it controls the day.",
    "easier_version": "Write one sentence naming the recurring thought."
  }},
  {{
    "category": "action",
    "title": "Start One Avoided Task",
    "subtitle": "Action Practice",
    "why_this_helps": "One small start turns pressure into movement.",
    "detail_description": "Momentum returns through one useful movement. Action: Work on one task you have been avoiding.",
    "duration_minutes": {example_durations["action"]},
    "preferred_time_of_day": "afternoon",
    "supportive_line": "You are starting, not fixing everything at once.",
    "why_chosen": "This turns mental noise into one concrete step.",
    "easier_version": "Work on the task for five minutes."
  }},
  {{
    "category": "meaning",
    "title": "Make Tomorrow Lighter",
    "subtitle": "Meaning Practice",
    "why_this_helps": "Meaning grows when effort serves a future you care about.",
    "detail_description": "A small helpful act can reconnect effort to purpose. Action: Do one thing that makes tomorrow easier for you or someone else.",
    "duration_minutes": {example_durations["meaning"]},
    "preferred_time_of_day": "evening",
    "supportive_line": "Small service can make the day feel less random.",
    "why_chosen": "This connects today's action to something larger than escape.",
    "easier_version": "Write one sentence about who this effort helps."
  }}
]
""".strip()


def build_weekly_mirror_prompt(context: dict) -> str:
    prompt_context = {
        "week_start": context.get("week_start"),
        "week_end": context.get("week_end"),
        "reflections": context.get("reflections", []),
        "task_summary": context.get("task_summary", {}),
        "tree_summary": context.get("tree_summary", {}),
    }
    context_json = json.dumps(prompt_context, ensure_ascii=True, sort_keys=True)

    return f"""
You are the Weekly Mirror for The Life Project.
Act as a calm weekly reflection guide, not a chatbot, therapist, clinician, coach, or judge.

Use only this compact, privacy-bounded weekly context:
{context_json}

Core experience:
- Help the user gently understand patterns from the past 7 days.
- Synthesize patterns, not performance.
- Turn the insight into one small focus for next week.
- Make the user feel seen, grounded, and guided.

Safety and tone rules:
- Output strictly valid JSON only.
- Do not use markdown, bullets, numbering, code fences, or commentary.
- Do not diagnose the user or mention mental health conditions.
- Do not make medical, clinical, therapy, treatment, or trauma claims.
- Do not use shame-heavy, harsh, dramatic, or absolute language.
- Do not say "you are", "your problem is", "you need to fix", or "this proves".
- Use gentle uncertainty language such as "Your reflections suggest", "This week seemed", "You may be returning to", or "One pattern that appeared".
- Keep every field concise: 1 to 2 sentences maximum.
- Be specific to the provided weekly context without quoting private journal text.

Return ONLY valid JSON in this exact shape:
{{
  "week_sentence": "This week seemed to carry one clear pattern without turning it into a score.",
  "inner_weather_pattern": "Your reflections suggest a steady emotional weather pattern.",
  "repeated_theme": "One pattern that appeared was returning to the same kind of choice.",
  "helped_forward": "Small completed actions seemed to create movement.",
  "pulled_back": "Skipped or unfinished areas seemed to pull attention away from momentum.",
  "weekly_question": "What small promise would still feel honest on a low-energy day?",
  "next_focus": "Begin smaller, but begin honestly."
}}
""".strip()
