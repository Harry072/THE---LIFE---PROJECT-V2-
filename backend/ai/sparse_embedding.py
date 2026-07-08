from __future__ import annotations

import math
import re


def _tokens(value: str) -> list[str]:
    normalized = str(value or "").lower().replace("'", "")
    return re.findall(r"[a-z0-9]+", normalized)


def build_sparse_embedding(value: str) -> dict[str, float]:
    counts: dict[str, float] = {}
    for token in _tokens(value):
        if len(token) < 3:
            continue
        counts[token] = counts.get(token, 0.0) + 1.0
    norm = math.sqrt(sum(weight * weight for weight in counts.values())) or 1.0
    return {token: weight / norm for token, weight in counts.items()}


def sparse_cosine(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    smaller, larger = (left, right) if len(left) <= len(right) else (right, left)
    return sum(weight * larger.get(token, 0.0) for token, weight in smaller.items())
