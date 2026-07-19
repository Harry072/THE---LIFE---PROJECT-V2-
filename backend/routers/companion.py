from collections.abc import Callable

from fastapi import APIRouter
from fastapi.responses import JSONResponse


ValidateUser = Callable[[str | None, str], str]

# This router's two paths bypassed the entire safety pipeline (distress
# escalation, injection sanitization, rate limits, guardrails) that
# /api/life-companion/chat has — see the 2026-07-19 pre-launch audit,
# finding S1. The legitimate frontend never called either path (confirmed
# by grep). Deprecated rather than repaired: an authenticated client could
# still reach a "companion" endpoint with zero crisis protection, so a
# clean 410 is safer than wiring Gate 1 into a second code path.
DEPRECATION_DETAIL = {"detail": "Deprecated. Use /api/life-companion/chat"}


def create_companion_router(validate_user: ValidateUser | None = None) -> APIRouter:
    router = APIRouter(tags=["companion"])

    @router.post("/companion/chat")
    @router.post("/api/companion/chat", include_in_schema=False)
    async def chat_deprecated():
        return JSONResponse(status_code=410, content=DEPRECATION_DETAIL)

    return router

