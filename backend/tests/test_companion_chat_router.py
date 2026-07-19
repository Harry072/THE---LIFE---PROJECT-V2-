import unittest
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.companion import create_companion_router


class CompanionChatRouterDeprecatedTests(unittest.TestCase):
    """Both paths were a live, authenticated attack surface with zero
    crisis protection (2026-07-19 audit finding S1) — deprecated to a
    plain 410 rather than wired into the safety pipeline. These tests
    replace the pre-deprecation suite (session creation, history,
    provider-error handling, validate_user enforcement), which tested
    behavior this router no longer has."""

    def setUp(self):
        app = FastAPI()
        app.include_router(create_companion_router())
        self.client = TestClient(app)

    def test_companion_chat_path_returns_410(self):
        response = self.client.post(
            "/companion/chat",
            json={"user_id": str(uuid4()), "message": "hello"},
        )
        self.assertEqual(response.status_code, 410)
        self.assertEqual(
            response.json()["detail"], "Deprecated. Use /api/life-companion/chat"
        )

    def test_api_companion_chat_alias_returns_410(self):
        response = self.client.post(
            "/api/companion/chat",
            json={"user_id": str(uuid4()), "message": "hello"},
        )
        self.assertEqual(response.status_code, 410)
        self.assertEqual(
            response.json()["detail"], "Deprecated. Use /api/life-companion/chat"
        )

    def test_410_regardless_of_body_or_auth(self):
        # No request-shape validation left in this route on purpose — the
        # endpoint is gone, not gated, so any payload/header combination
        # gets the same 410.
        response = self.client.post(
            "/companion/chat",
            headers={"Authorization": "Bearer not-a-real-token"},
            json={"anything": "at all"},
        )
        self.assertEqual(response.status_code, 410)

    def test_validate_user_is_never_invoked(self):
        calls = []

        def validate_user(authorization, request_user_id):
            calls.append((authorization, request_user_id))
            return request_user_id

        app = FastAPI()
        app.include_router(create_companion_router(validate_user=validate_user))
        client = TestClient(app)

        response = client.post(
            "/companion/chat",
            headers={"Authorization": "Bearer test-token"},
            json={"user_id": str(uuid4()), "message": "hello"},
        )

        self.assertEqual(response.status_code, 410)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
