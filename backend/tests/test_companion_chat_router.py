import asyncio
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.companion import create_companion_router
from services import ai_service, session_service


class CompanionChatRouterTests(unittest.TestCase):
    def setUp(self):
        asyncio.run(session_service.clear_for_tests())
        app = FastAPI()
        app.include_router(create_companion_router())
        self.client = TestClient(app)

    def test_chat_creates_session_and_preserves_history(self):
        user_id = str(uuid4())
        session_id = str(uuid4())
        calls = []

        async def fake_chat(*, system_prompt: str, history: list[dict]) -> str:
            calls.append({"system_prompt": system_prompt, "history": history})
            return f"reply {len(calls)}"

        with patch(
            "routers.companion.ai_service.chat",
            new=AsyncMock(side_effect=fake_chat),
        ):
            first = self.client.post(
                "/companion/chat",
                json={
                    "user_id": user_id,
                    "session_id": session_id,
                    "message": "I feel stuck with my project",
                },
            )
            second = self.client.post(
                "/companion/chat",
                json={
                    "user_id": user_id,
                    "session_id": session_id,
                    "message": "I keep procrastinating everything",
                },
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["reply"], "reply 1")
        self.assertEqual(first.json()["message_count"], 2)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["message_count"], 4)

        self.assertIn("This is the user's first session", calls[0]["system_prompt"])
        self.assertEqual(
            calls[0]["history"],
            [{"role": "user", "content": "I feel stuck with my project"}],
        )
        self.assertEqual(
            [message["role"] for message in calls[1]["history"]],
            ["user", "assistant", "user"],
        )

    def test_api_alias_is_available_for_frontend_shape(self):
        user_id = str(uuid4())

        with patch(
            "routers.companion.ai_service.chat",
            new=AsyncMock(return_value="alias reply"),
        ):
            response = self.client.post(
                "/api/companion/chat",
                json={"user_id": user_id, "message": "hello"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "alias reply")
        self.assertEqual(response.json()["message_count"], 2)

    def test_provider_configuration_errors_return_503(self):
        user_id = str(uuid4())

        with patch(
            "routers.companion.ai_service.chat",
            new=AsyncMock(
                side_effect=ai_service.AIConfigurationError(
                    "GROQ_API_KEY is not configured."
                )
            ),
        ):
            response = self.client.post(
                "/companion/chat",
                json={"user_id": user_id, "message": "hello"},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "GROQ_API_KEY is not configured.")

    def test_main_app_can_enforce_user_validation(self):
        user_id = str(uuid4())

        def validate_user(authorization: str | None, request_user_id: str) -> str:
            self.assertEqual(authorization, "Bearer test-token")
            self.assertEqual(request_user_id, user_id)
            return request_user_id

        app = FastAPI()
        app.include_router(create_companion_router(validate_user=validate_user))
        client = TestClient(app)

        with patch(
            "routers.companion.ai_service.chat",
            new=AsyncMock(return_value="validated reply"),
        ):
            response = client.post(
                "/companion/chat",
                headers={"Authorization": "Bearer test-token"},
                json={"user_id": user_id, "message": "hello"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "validated reply")


if __name__ == "__main__":
    unittest.main()

