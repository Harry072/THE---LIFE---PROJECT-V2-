import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone


Message = dict[str, str]
SessionKey = tuple[str, str]


@dataclass
class CompanionSession:
    id: str
    user_id: str
    history: list[Message] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_sessions: dict[SessionKey, CompanionSession] = {}
_locks: dict[SessionKey, asyncio.Lock] = {}
_registry_lock = asyncio.Lock()


def make_key(user_id: str, session_id: str) -> SessionKey:
    return (str(user_id), str(session_id))


async def get_lock(user_id: str, session_id: str) -> asyncio.Lock:
    key = make_key(user_id, session_id)
    async with _registry_lock:
        lock = _locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            _locks[key] = lock
        return lock


async def get_or_create(user_id: str, session_id: str) -> CompanionSession:
    key = make_key(user_id, session_id)
    async with _registry_lock:
        session = _sessions.get(key)
        if session is None:
            session = CompanionSession(id=str(session_id), user_id=str(user_id))
            _sessions[key] = session
        return session


async def save(session: CompanionSession) -> None:
    session.updated_at = datetime.now(timezone.utc)
    key = make_key(session.user_id, session.id)
    async with _registry_lock:
        _sessions[key] = session


async def clear_for_tests() -> None:
    async with _registry_lock:
        _sessions.clear()
        _locks.clear()

