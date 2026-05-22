from datetime import datetime, timedelta, timezone
import os
from uuid import NAMESPACE_URL, uuid5

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException
from google.auth.transport.requests import Request
from google.oauth2 import id_token
import jwt
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY")
)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
APP_JWT_SECRET = (
    os.environ.get("APP_JWT_SECRET")
    or os.environ.get("JWT_SECRET")
    or os.environ.get("SECRET_KEY")
    or os.environ.get("SUPABASE_JWT_SECRET")
    or SUPABASE_KEY
)
APP_JWT_ALGORITHM = "HS256"
APP_JWT_EXPIRE_MINUTES = int(os.environ.get("APP_JWT_EXPIRE_MINUTES", "10080"))

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client | None = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None


class GoogleAuthRequest(BaseModel):
    token: str


def _require_google_client_id() -> str:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID is not configured on the backend.",
        )
    return GOOGLE_CLIENT_ID


def _require_jwt_secret() -> str:
    if not APP_JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="APP_JWT_SECRET or JWT_SECRET is not configured.",
        )
    return APP_JWT_SECRET


def _profile_id_for_google_subject(google_subject: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"the-life-project:google:{google_subject}"))


def create_app_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=APP_JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user["id"],
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "provider": "google",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, _require_jwt_secret(), algorithm=APP_JWT_ALGORITHM)


def verify_app_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            _require_jwt_secret(),
            algorithms=[APP_JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Session expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


def _ensure_google_profile(user: dict) -> None:
    if not supabase:
        return

    try:
        supabase.table("profiles").upsert(
            {
                "id": user["id"],
                "onboarding_completed": True,
            },
            on_conflict="id",
        ).execute()
    except Exception:
        # Do not leak database details to auth callers.
        pass

    try:
        supabase.table("growth_trees").upsert(
            {"user_id": user["id"]},
            on_conflict="user_id",
        ).execute()
    except Exception:
        pass

    try:
        supabase.table("user_behavior").upsert(
            {"user_id": user["id"]},
            on_conflict="user_id",
        ).execute()
    except Exception:
        pass


@router.post("/google")
async def google_auth(request: GoogleAuthRequest):
    if not request.token.strip():
        raise HTTPException(status_code=400, detail="Google token is required.")

    try:
        verified = id_token.verify_oauth2_token(
            request.token,
            Request(),
            _require_google_client_id(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google token") from exc

    email = str(verified.get("email") or "").strip().lower()
    google_subject = str(verified.get("sub") or "").strip()
    if not email or not google_subject:
        raise HTTPException(status_code=401, detail="Google token missing identity fields")

    user = {
        "id": _profile_id_for_google_subject(google_subject),
        "email": email,
        "name": verified.get("name") or email.split("@")[0],
        "picture": verified.get("picture"),
        "user_metadata": {
            "username": verified.get("name") or email.split("@")[0],
            "full_name": verified.get("name") or email.split("@")[0],
            "avatar_url": verified.get("picture"),
            "picture": verified.get("picture"),
            "struggle_tags": [],
            "onboarding_completed": True,
        },
        "app_metadata": {"provider": "google"},
        "identities": [{"provider": "google"}],
        "email_confirmed_at": datetime.now(timezone.utc).isoformat(),
    }

    _ensure_google_profile(user)
    access_token = create_app_access_token(user)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": APP_JWT_EXPIRE_MINUTES * 60,
        "user": user,
    }


async def get_user_id(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    token = authorization.replace("Bearer ", "")

    try:
        app_payload = verify_app_access_token(token)
        return str(app_payload["sub"])
    except HTTPException:
        pass

    if not supabase:
        return "dev-user-id"

    user_response = supabase.auth.get_user(token)
    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user_response.user.id
