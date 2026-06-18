from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any


PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 260_000
TOKEN_TTL = timedelta(hours=12)


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    return (
        f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt}$"
        f"{base64.urlsafe_b64encode(derived).decode('ascii')}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, digest = stored_hash.split("$", 3)
        if algorithm != PASSWORD_ALGORITHM:
            return False
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
        expected = base64.urlsafe_b64decode(digest.encode("ascii"))
        return hmac.compare_digest(derived, expected)
    except (ValueError, TypeError):
        return False


def issue_access_token(user_id: str, secret: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + TOKEN_TTL).timestamp()),
    }
    encoded_payload = _b64encode_json(payload)
    signature = _sign(encoded_payload, secret or auth_secret())
    return f"{encoded_payload}.{signature}"


def verify_access_token(token: str, secret: str | None = None) -> str:
    try:
        encoded_payload, signature = token.split(".", 1)
    except ValueError as exc:
        raise TokenError("invalid token") from exc

    expected = _sign(encoded_payload, secret or auth_secret())
    if not hmac.compare_digest(signature, expected):
        raise TokenError("invalid token signature")

    try:
        payload = json.loads(_b64decode(encoded_payload))
        expires_at = int(payload["exp"])
        user_id = str(payload["sub"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise TokenError("invalid token payload") from exc

    if expires_at < int(datetime.now(timezone.utc).timestamp()):
        raise TokenError("token expired")
    return user_id


def auth_secret() -> str:
    return os.getenv("AUTH_TOKEN_SECRET", "dev-insecure-change-me")


def _b64encode_json(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> str:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")


def _sign(value: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256)
    return base64.urlsafe_b64encode(digest.digest()).decode("ascii").rstrip("=")
