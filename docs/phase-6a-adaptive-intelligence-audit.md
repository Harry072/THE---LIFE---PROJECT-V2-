# Phase 6A Adaptive User Intelligence Audit

## Product stance

The Life Project should behave as a mirror, not a master. Adaptive intelligence should reflect patterns, reduce friction, and suggest one honest next step without forcing purpose, diagnosing the user, or turning private writing into fuel for broad personalization.

Phase 6A uses safe metadata only. It must not log or use raw prompts, raw provider outputs, API keys, bearer tokens, hidden instructions, private journal text, raw reflection answers, or raw Companion text for adaptive intelligence.

## Current signal map

| Signal source | Current storage | Current use | Gap |
| --- | --- | --- | --- |
| Onboarding struggle tags | `profiles.struggle_tags`, `profiles.struggle_cluster`, `TaskRequest.struggles` | Loop generation context, Companion understand-me context | Not yet reused in Dashboard whispers or Purpose Map direction signals. |
| Loop tasks | `loop_tasks` category, duration, intensity, done/completed/skipped, date | Dashboard, Loop, Growth Tree scoring RPC, Weekly Mirror input summary, Companion task context | No post-action mood, friction, skip reason label, success condition, smaller version, or feedback timestamp. |
| Loop task completion | `complete_loop_task_v4` RPC | Marks completion and updates Growth Tree | No micro-question after completion; feedback cannot tune tomorrow safely. |
| Night Reflection | `reflections.mood`, `reflections.questions` | Weekly Mirror and Reflection archive | Current archive stores raw answers. Phase 6A adaptive intelligence should use mood and prompt labels only; future privacy migration should be planned separately. |
| Reset Space sessions | Local player state and completion UI | User sees a completion ritual | Mood after reset and reflection label are not persisted. |
| Weekly Mirror synthesis | `weekly_syntheses.synthesis_json`, `input_summary_json` | Weekly Mirror card, Companion suggest-next-step context | Next focus is not reused by Dashboard whispers or Loop intensity summaries. |
| Companion intents | Runtime `detect_companion_intent` result | Prompt retrieval and response mode | Intent/action metadata is not persisted in queryable safe fields. |
| Curator interactions | Local UI and localStorage active shelf | Curator page only | No safe category/book interaction metadata for future recommendations. |
| Growth Tree/streak | `user_tree`, `user_behavior`, loop stats | Dashboard, Loop generation intensity | Not combined with friction and mood to soften or slightly stretch future tasks. |

## Safe metadata added in 6A

Loop tasks receive safe feedback fields:

- `post_action_mood`, `mood_before`, `mood_after`
- `task_friction_level`: `too_easy`, `right_sized`, `too_heavy`
- `completion_state`: `pending`, `done`, `skipped`, `partial`
- `skip_reason_label`
- `feedback_recorded_at`
- `difficulty_level`, `success_condition`, `smaller_version`, `post_completion_question`

Reset sessions get a new user-owned metadata table:

- `session_id`, `session_type`, `session_category`, `reset_need`
- `duration_seconds`, `mood_after`, `reflection_tag`
- `created_at`

Curator interactions get a new user-owned metadata table:

- `book_id`, `path_slug`, `action_type`
- `duration_seconds`
- `created_at`

Companion messages receive safe metadata fields:

- `companion_intent`
- `resolved_action_type`

## Adaptive behavior rules

Task adaptation stays conservative:

- If recent tasks are marked `too_heavy` or repeatedly skipped, halve or simplify durations and instructions.
- If recent tasks are consistently `too_easy` and mood is clear/focused, increase difficulty only slightly.
- Always provide a smaller version.
- Do not frame skipped tasks as failure.
- Do not diagnose mood or claim clinical insight.

Dashboard whispers are deterministic:

- Heavy/restless mood or heavy friction -> one gentle action is enough.
- Strong completion and clear mood -> encourage steady consistency without hype.
- Skipped action category -> suggest the smallest visible action.
- Reset completion with calmer mood -> reflect the return to steadiness.
- No data -> warm empty guidance.

## Purpose Map architecture only

Do not create `purpose_signals` in Phase 6A. The proposed future table can be:

- `user_id`
- `source`: `loop`, `reflection`, `reset`, `weekly_mirror`, `companion`, `curator`
- `signal_type`: `energy`, `strength`, `service`, `value`
- `signal_value`
- `confidence`
- `created_at`

Purpose Map should populate passively from repeated signals:

- Energy: what repeatedly gives the user clarity, aliveness, or return.
- Strength: what the user keeps completing, practicing, or improving.
- Service: what points toward helping future self or others.
- Value: what appears in repeated themes, chosen books, and moral/purpose questions.

The UI should not ask the user to fill an Ikigai chart. It should show four gentle signal levels, recent sources, and premium empty states while signals form.

## Privacy notes

Phase 6A does not delete existing Reflection archive or Companion chat persistence. Instead, new adaptive features must use sanitized labels and safe metadata only. Any future move away from raw reflection or chat storage should be a separate privacy migration with explicit product approval.

