from collections.abc import Callable
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException

from companion_schemas import ChatRequest, ChatResponse
from services import ai_service, memory_service, session_service
from services.companion_prompt import COMPANION_SYSTEM_PROMPT


ValidateUser = Callable[[str | None, str], str]


def create_companion_router(validate_user: ValidateUser | None = None) -> APIRouter:
    router = APIRouter(tags=["companion"])

    @router.post("/companion/chat", response_model=ChatResponse)
    @router.post("/api/companion/chat", response_model=ChatResponse, include_in_schema=False)
    async def chat(
        request: ChatRequest,
        authorization: str | None = Header(default=None),
    ) -> ChatResponse:
        user_id = str(request.user_id)
        if validate_user is not None:
            user_id = validate_user(authorization, user_id)

        session_id = request.session_id or uuid4()
        lock = await session_service.get_lock(user_id, str(session_id))

        async with lock:
            try:
                user_memory = await memory_service.load(user_id)
                session = await session_service.get_or_create(user_id, str(session_id))
                memory_context = memory_service.build_context(user_memory)
                system_prompt = COMPANION_SYSTEM_PROMPT.replace(
                    "{memory_context}",
                    memory_context,
                )

                pending_history = [
                    *session.history,
                    {"role": "user", "content": request.message},
                ]
                reply = await ai_service.chat(
                    system_prompt=system_prompt,
                    history=pending_history,
                )

                session.history = [
                    *pending_history,
                    {"role": "assistant", "content": reply},
                ]
                await session_service.save(session)

                return ChatResponse(
                    reply=reply,
                    session_id=UUID(session.id),
                    message_count=len(session.history),
                )
            except ai_service.AIConfigurationError as error:
                raise HTTPException(status_code=503, detail=str(error)) from error
            except ai_service.AIProviderError as error:
                raise HTTPException(
                    status_code=502,
                    detail="Companion provider failed. Please try again.",
                ) from error

    return router

