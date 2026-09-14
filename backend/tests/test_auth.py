"""Who is asking, and what happens when nobody is."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from diagnostic_assist.api import app
from diagnostic_assist.auth import authenticate, issue_token, user_from_token

# Every route that reads or writes case data. The list is here rather than derived from
# the app so that adding a route and forgetting to protect it fails a test instead of
# passing one.
PROTECTED = [
    ("PATCH", "/auth/me", {"name": "Someone Else"}),
    ("POST", "/auth/password", {"current_password": "x", "new_password": "xxxxxxxx"}),
    ("POST", "/sessions", {"description": "anything"}),
    ("GET", "/sessions/does-not-exist", None),
    ("POST", "/sessions/does-not-exist/answers", {"question_id": "x", "value": "y"}),
    ("POST", "/sessions/does-not-exist/close", {"confirmed_cause_id": None}),
    ("GET", "/cases", None),
    ("GET", "/cases/C-48211", None),
    ("GET", "/equipment", None),
    ("GET", "/taxonomy", None),
]


@pytest.fixture
def anonymous() -> TestClient:
    return TestClient(app)


class TestPasswords:
    def test_the_right_password_is_the_user(self) -> None:
        user = authenticate("user@test.com", "user")
        assert user is not None
        assert user.name == "Test User"

    def test_the_wrong_password_is_nobody(self) -> None:
        assert authenticate("user@test.com", "wrong") is None

    def test_an_unknown_username_is_nobody(self) -> None:
        assert authenticate("nobody@test.com", "user") is None

    def test_login_says_the_same_thing_either_way(self, anonymous: TestClient) -> None:
        """Which half was wrong is not information the caller is owed."""
        bad_user = anonymous.post(
            "/auth/login", json={"username": "nobody@test.com", "password": "user"}
        )
        bad_password = anonymous.post(
            "/auth/login", json={"username": "user@test.com", "password": "wrong"}
        )
        assert bad_user.status_code == bad_password.status_code == 401
        assert bad_user.json() == bad_password.json()


class TestTokens:
    def test_a_token_round_trips(self) -> None:
        user = authenticate("user@test.com", "user")
        assert user is not None
        assert user_from_token(issue_token(user)) == user

    def test_an_expired_token_is_nobody(self) -> None:
        user = authenticate("user@test.com", "user")
        assert user is not None
        # Issued far enough in the past that its own TTL has already run out.
        stale = issue_token(user, now=time.time() - 10**6)
        assert user_from_token(stale) is None

    def test_a_tampered_expiry_is_nobody(self) -> None:
        """The signature is checked before the expiry is read."""
        user = authenticate("user@test.com", "user")
        assert user is not None
        username, _, signature = issue_token(user).split(":")
        forged = f"{username}:{int(time.time()) + 10**6}:{signature}"
        assert user_from_token(forged) is None

    def test_the_username_is_inside_the_signature(self) -> None:
        """Swapping the username on a valid token invalidates it."""
        tester = authenticate("user@test.com", "user")
        assert tester is not None
        _, expiry, signature = issue_token(tester).split(":")
        assert user_from_token(f"someone@else.com:{expiry}:{signature}") is None

    @pytest.mark.parametrize("junk", ["", "abc", "a:b", "a:b:c:d", "user@test.com:notanumber:x"])
    def test_malformed_tokens_are_nobody(self, junk: str) -> None:
        assert user_from_token(junk) is None


class TestProtectedRoutes:
    @pytest.mark.parametrize(("method", "path", "body"), PROTECTED)
    def test_no_token_is_a_401(
        self, anonymous: TestClient, method: str, path: str, body: dict | None
    ) -> None:
        assert anonymous.request(method, path, json=body).status_code == 401

    @pytest.mark.parametrize(("method", "path", "body"), PROTECTED)
    def test_a_forged_token_is_a_401(
        self, anonymous: TestClient, method: str, path: str, body: dict | None
    ) -> None:
        response = anonymous.request(
            method,
            path,
            json=body,
            headers={"Authorization": "Bearer user@test.com:99999999999:x"},
        )
        assert response.status_code == 401

    def test_the_event_stream_rejects_a_bad_query_token(self, anonymous: TestClient) -> None:
        """EventSource cannot set a header, so this route takes the token in the URL."""
        response = anonymous.get("/sessions/does-not-exist/events?token=nonsense")
        assert response.status_code == 401

    def test_the_event_stream_requires_a_token_at_all(self, anonymous: TestClient) -> None:
        assert anonymous.get("/sessions/does-not-exist/events").status_code == 422


class TestAccountSettings:
    """Changing account data. Restores what it changed, because the store is one process."""

    @pytest.fixture
    def signed_in(self) -> TestClient:
        client = TestClient(app)
        credentials = {"username": "user@test.com", "password": "user"}
        token = client.post("/auth/login", json=credentials).json()["token"]
        client.headers["Authorization"] = f"Bearer {token}"
        return client

    def test_the_display_name_can_be_changed(self, signed_in: TestClient) -> None:
        try:
            updated = signed_in.patch("/auth/me", json={"name": "Sam Tester"}).json()
            assert updated["name"] == "Sam Tester"
            assert signed_in.get("/auth/me").json()["name"] == "Sam Tester"
            # The identity did not move with it.
            assert updated["username"] == "user@test.com"
            assert updated["email"] == "user@test.com"
        finally:
            signed_in.patch("/auth/me", json={"name": "Test User"})

    def test_an_empty_name_is_rejected(self, signed_in: TestClient) -> None:
        assert signed_in.patch("/auth/me", json={"name": ""}).status_code == 422

    def test_the_password_can_be_changed_and_the_old_one_stops_working(
        self, signed_in: TestClient, anonymous: TestClient
    ) -> None:
        try:
            response = signed_in.post(
                "/auth/password",
                json={"current_password": "user", "new_password": "spanner-99"},
            )
            assert response.status_code == 200
            assert set(response.json()) == {"token", "user"}
            assert authenticate("user@test.com", "user") is None
            assert authenticate("user@test.com", "spanner-99") is not None
            assert (
                anonymous.post(
                    "/auth/login", json={"username": "user@test.com", "password": "user"}
                ).status_code
                == 401
            )
        finally:
            signed_in.post(
                "/auth/password",
                json={"current_password": "spanner-99", "new_password": "user"},
            )

    def test_the_wrong_current_password_changes_nothing(self, signed_in: TestClient) -> None:
        response = signed_in.post(
            "/auth/password",
            json={"current_password": "not-it", "new_password": "spanner-99"},
        )
        assert response.status_code == 401
        assert authenticate("user@test.com", "user") is not None

    def test_an_empty_new_password_is_rejected(self, signed_in: TestClient) -> None:
        response = signed_in.post(
            "/auth/password", json={"current_password": "user", "new_password": ""}
        )
        assert response.status_code == 422
        assert authenticate("user@test.com", "user") is not None


class TestSignedInReach:
    """One account, one answer: signed in reaches everything, signed out reaches nothing."""

    @pytest.fixture
    def signed_in(self) -> TestClient:
        client = TestClient(app)
        token = client.post(
            "/auth/login", json={"username": "user@test.com", "password": "user"}
        ).json()["token"]
        client.headers["Authorization"] = f"Bearer {token}"
        return client

    def test_a_signed_in_user_reads_the_review_queue(self, signed_in: TestClient) -> None:
        assert len(signed_in.get("/cases").json()) == 22

    def test_a_signed_in_user_can_diagnose(self, signed_in: TestClient) -> None:
        created = signed_in.post("/sessions", json={"description": "hyd. lk @ boom cyl"})
        assert created.status_code == 200
        session_id = created.json()["session_id"]
        assert signed_in.get(f"/sessions/{session_id}").status_code == 200
        assert signed_in.get("/equipment").status_code == 200
        assert signed_in.get("/cases/C-48211").status_code == 200

    def test_a_signed_out_caller_reaches_nothing(self, anonymous: TestClient) -> None:
        assert anonymous.get("/cases").status_code == 401
        assert anonymous.get("/cases/C-48211").status_code == 401

    def test_a_token_names_its_holder_and_nothing_else(self) -> None:
        """A token carries a username and an expiry, and the user is read at verification."""
        user = authenticate("user@test.com", "user")
        assert user is not None
        verified = user_from_token(issue_token(user))
        assert verified is not None
        assert verified == user


class TestWhoAmI:
    def test_me_returns_the_signed_in_user(self, anonymous: TestClient) -> None:
        token = anonymous.post(
            "/auth/login", json={"username": "user@test.com", "password": "user"}
        ).json()["token"]
        response = anonymous.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.json() == {
            "username": "user@test.com",
            "name": "Test User",
            "email": "user@test.com",
        }

    def test_login_never_returns_the_password_or_the_hash(self, anonymous: TestClient) -> None:
        body = anonymous.post(
            "/auth/login", json={"username": "user@test.com", "password": "user"}
        ).json()
        assert set(body) == {"token", "user"}
        assert set(body["user"]) == {"username", "name", "email"}
