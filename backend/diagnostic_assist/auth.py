"""Who is asking."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from typing import Final

from pydantic import BaseModel, ConfigDict

from .config import (
    AUTH_SECRET,
    AUTH_TOKEN_TTL_SECONDS,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_COST,
    SCRYPT_PARALLELISATION,
    STREAM_TICKET_TTL_SECONDS,
)


class User(BaseModel):
    """Everything the rest of the application is allowed to know about who is asking."""

    model_config = ConfigDict(frozen=True)

    username: str
    name: str
    email: str


class _Account(BaseModel):
    """A user plus the two values needed to check a password. Never leaves this module."""

    model_config = ConfigDict(frozen=True)

    user: User
    salt: bytes
    password_hash: bytes


def hash_password(password: str, salt: bytes) -> bytes:
    """scrypt, with the cost parameters from config.py."""
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_COST,
        r=SCRYPT_BLOCK_SIZE,
        p=SCRYPT_PARALLELISATION,
        dklen=32,
    )


def _account(name: str, email: str, password: str) -> _Account:
    """Build an account, hashing at import."""
    salt = secrets.token_bytes(16)
    return _Account(
        user=User(username=email, name=name, email=email),
        salt=salt,
        password_hash=hash_password(password, salt),
    )


# STUB: one hard-coded account. Production is an identity provider and no user table here.
_ACCOUNTS: Final[dict[str, _Account]] = {
    account.user.username: account
    for account in (
        _account(
            "Test User",
            "user@test.com",
            os.environ.get("DIAGNOSTIC_ASSIST_USER_PASSWORD", "user"),
        ),
    )
}


def update_profile(username: str, name: str) -> User | None:
    """Change the display name. Returns the updated user, or None if there is no such one."""
    account = _ACCOUNTS.get(username)
    if account is None:
        return None
    updated = account.user.model_copy(update={"name": name})
    _ACCOUNTS[username] = account.model_copy(update={"user": updated})
    return updated


def change_password(username: str, current: str, new: str) -> bool:
    """Re-hash with a fresh salt. False when the current password is wrong."""
    if authenticate(username, current) is None:
        return False
    account = _ACCOUNTS[username]
    salt = secrets.token_bytes(16)
    _ACCOUNTS[username] = account.model_copy(
        update={"salt": salt, "password_hash": hash_password(new, salt)}
    )
    return True


def authenticate(username: str, password: str) -> User | None:
    """The user, or None. One code path whether the username exists or not."""
    account = _ACCOUNTS.get(username)
    if account is None:
        hash_password(password, b"\x00" * 16)
        return None
    candidate = hash_password(password, account.salt)
    if not hmac.compare_digest(candidate, account.password_hash):
        return None
    return account.user


def _sign(payload: str, key: bytes | None = None) -> str:
    """HMAC over the payload, keyed by AUTH_SECRET and optionally by more."""
    digest = hmac.new(key or AUTH_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256)
    return base64.urlsafe_b64encode(digest.digest()).decode("ascii").rstrip("=")


def _token_key(account: _Account) -> bytes:
    """The signing key for one account's tokens.

    The password hash is part of it, so every token issued before a password change stops
    verifying the moment the password changes. Without that, the one remediation available
    to a user whose token leaked would not actually revoke anything.
    """
    return AUTH_SECRET.encode("utf-8") + account.password_hash


def _verify(payload: str, signature: str, key: bytes | None = None) -> bool:
    """Constant-time signature check that cannot raise on attacker-supplied bytes."""
    expected = _sign(payload, key).encode("ascii")
    return hmac.compare_digest(expected, signature.encode("utf-8", "replace"))


def issue_token(user: User, now: float | None = None) -> str:
    """`username:expiry:signature`; only the signature is urlsafe-base64 without padding."""
    account = _ACCOUNTS[user.username]
    expiry = int((now if now is not None else time.time()) + AUTH_TOKEN_TTL_SECONDS)
    payload = f"{user.username}:{expiry}"
    return f"{payload}:{_sign(payload, _token_key(account))}"


def user_from_token(token: str, now: float | None = None) -> User | None:
    """The user a token names, or None if it is malformed, forged or expired."""
    parts = token.split(":")
    if len(parts) != 3:
        return None
    username, raw_expiry, signature = parts
    account = _ACCOUNTS.get(username)
    if account is None:
        return None
    if not _verify(f"{username}:{raw_expiry}", signature, _token_key(account)):
        return None
    try:
        expiry = int(raw_expiry)
    except ValueError:
        return None
    if expiry <= (now if now is not None else time.time()):
        return None
    return account.user


def issue_stream_ticket(session_id: str, now: float | None = None) -> str:
    """A short-lived credential for one session's SSE channel.

    EventSource cannot set headers, so whatever authorises the stream travels in the query
    string and lands verbatim in every access log and proxy. A bearer token there is a
    12-hour credential written to disk in plain text; this is a minute, bound to one session
    id, and useless on any other route.
    """
    expiry = int((now if now is not None else time.time()) + STREAM_TICKET_TTL_SECONDS)
    return f"{expiry}:{_sign(f'stream:{session_id}:{expiry}')}"


def stream_ticket_is_valid(session_id: str, ticket: str, now: float | None = None) -> bool:
    """Whether this ticket was minted for this session and has not expired."""
    raw_expiry, _, signature = ticket.partition(":")
    if not signature:
        return False
    if not _verify(f"stream:{session_id}:{raw_expiry}", signature):
        return False
    try:
        expiry = int(raw_expiry)
    except ValueError:
        return False
    return expiry > (now if now is not None else time.time())
