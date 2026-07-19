"""
The Loop task retrieval — sparse-embedding lookup over backend/rag/tasks_library.json.

Mirrors the retrieval shape already used for the companion PDF knowledge base
(see companion_pdf_knowledge.py / companion_knowledge.py): a cached loader
produces normalized records with a precomputed sparse embedding, and
retrieve_candidates() scores the library against a free-text struggle message.

Safety gates (from tasks_library.json's own safety_rules block):
  - food   : opt-in AND non-foundation. Both conditions must hold or the task
             is dropped from candidates entirely.
  - money  : never excluded. It is only ever annotated (the safety_gate field
             passes through untouched) so a caller can apply gentle framing.
  - level  : a scoring boost toward the caller's journey_phase, never a filter.
             Every level is always eligible.
  - balance nudge : optional recent_directions param. No-op unless the caller
             passes a history that is entirely "inward" — then "outward"
             tasks get a small boost. Default (None/empty) changes nothing.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .sparse_embedding import build_sparse_embedding, sparse_cosine
from .task_intelligence import FOCUS_AREA_TO_INNER_LAYER

TASKS_LIBRARY_FILE_NAME = "tasks_library.json"

# Raw data uses "kaam" and "lust" for the same concept (Sanskrit/English for
# the same one of the five classical "thieves"). Casing noise like "Awareness"
# is handled by lowercasing every raw value before this lookup runs.
INNER_LAYER_ALIASES: dict[str, str] = {
    "kaam": "lust",
}

_LEVELS = ("foundation", "recognition", "integration")

# Optional focus-area -> inner-layer boost. Reuses the mapping already
# established in task_intelligence.py rather than inventing a second one,
# since it already speaks this task library's inner_layer vocabulary.
# Strictly opt-in: only applied when a caller passes focus_areas explicitly,
# so it cannot change behavior for any call that omits it.
_FOCUS_AREA_MAP: dict[str, list[str]] = FOCUS_AREA_TO_INNER_LAYER

_LEVEL_BOOST = 0.08
_DIRECTION_BOOST = 0.08
_INNER_LAYER_PRIMARY_BOOST = 0.06
_INNER_LAYER_SECONDARY_BOOST = 0.03


def _tasks_library_path() -> Path:
    return Path(__file__).resolve().parents[1] / "rag" / TASKS_LIBRARY_FILE_NAME


def _normalize_inner_layer(raw: str) -> str:
    lowered = str(raw or "none").strip().lower()
    return INNER_LAYER_ALIASES.get(lowered, lowered)


def _normalize_task(task: dict) -> dict:
    retrieval_text = str(task.get("retrieval_text") or "")
    return {
        **task,
        "inner_layer": _normalize_inner_layer(task.get("inner_layer")),
        "_embedding": build_sparse_embedding(retrieval_text),
    }


@lru_cache(maxsize=1)
def load_task_library() -> tuple[dict, ...]:
    raw = json.loads(_tasks_library_path().read_text(encoding="utf-8"))
    tasks = raw.get("tasks") or []
    return tuple(_normalize_task(task) for task in tasks if isinstance(task, dict))


def _passes_safety_gates(task: dict, allow_food: bool) -> bool:
    if task.get("safety_gate") == "food":
        return allow_food and task.get("level") != "foundation"
    return True  # money tasks and ungated tasks are always eligible


def _level_boost(task_level: str, journey_phase: str | None) -> float:
    if not journey_phase or task_level != journey_phase:
        return 0.0
    return _LEVEL_BOOST


def _direction_boost(direction: str, recent_directions: list[str] | None) -> float:
    if not recent_directions:
        return 0.0
    if any(d != "inward" for d in recent_directions):
        return 0.0
    return _DIRECTION_BOOST if direction == "outward" else 0.0


def _inner_layer_boost(inner_layer: str, focus_areas: list[str] | None) -> float:
    if not focus_areas:
        return 0.0
    wanted: list[str] = []
    for area in focus_areas:
        wanted.extend(_FOCUS_AREA_MAP.get(str(area or "").lower().strip(), []))
    if not wanted:
        return 0.0
    if inner_layer == wanted[0]:
        return _INNER_LAYER_PRIMARY_BOOST
    if inner_layer in wanted:
        return _INNER_LAYER_SECONDARY_BOOST
    return 0.0


def retrieve_candidates(
    message: str,
    *,
    max_candidates: int = 2,
    journey_phase: str | None = None,
    allow_food: bool = False,
    recent_directions: list[str] | None = None,
    focus_areas: list[str] | None = None,
) -> list[dict]:
    """
    Score backend/rag/tasks_library.json against a free-text struggle message.

    Filtering only ever removes food-gated tasks when not opted in (or still
    in the foundation level). Everything else — level, direction, money gate —
    is a scoring signal, never an exclusion.
    """
    query_embedding = build_sparse_embedding(message)

    scored: list[tuple[float, str, dict]] = []
    for task in load_task_library():
        if not _passes_safety_gates(task, allow_food):
            continue
        score = sparse_cosine(query_embedding, task["_embedding"])
        score += _level_boost(task.get("level", ""), journey_phase)
        score += _direction_boost(task.get("direction", ""), recent_directions)
        score += _inner_layer_boost(task.get("inner_layer", ""), focus_areas)
        scored.append((score, task["id"], task))

    scored.sort(key=lambda item: (-item[0], item[1]))

    results: list[dict] = []
    for score, _id, task in scored[:max_candidates]:
        clean = {key: value for key, value in task.items() if key != "_embedding"}
        clean["score"] = round(score, 4)
        results.append(clean)
    return results
