import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone
import bcrypt

# JWT secret key from environment or persistent local default
JWT_SECRET_KEY = os.environ.get(
    "JWT_SECRET_KEY",
    "daybook-digital-diary-secret-key-production-hs256-2026"
).encode("utf-8")

JWT_ALGORITHM = "HS256"
DEFAULT_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    """Base64 URL-safe encoding without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    """Base64 URL-safe decoding with restoration of padding."""
    rem = len(s) % 4
    if rem:
        s += "=" * (4 - rem)
    return base64.urlsafe_b64decode(s.encode("ascii"))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a standard RFC 7519 HS256 signed JSON Web Token (JWT)."""
    to_encode = data.copy()

    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=DEFAULT_EXPIRE_DAYS)

    to_encode.update({
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    })

    header = _b64url_encode(json.dumps({"alg": JWT_ALGORITHM, "typ": "JWT"}).encode("utf-8"))
    payload = _b64url_encode(json.dumps(to_encode, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header}.{payload}".encode("ascii")
    signature = _b64url_encode(hmac.new(JWT_SECRET_KEY, signing_input, hashlib.sha256).digest())

    return f"{header}.{payload}.{signature}"


def decode_access_token(token: str) -> dict | None:
    """Decode and verify a standard HS256 signed JWT token."""
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts

        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = _b64url_encode(hmac.new(JWT_SECRET_KEY, signing_input, hashlib.sha256).digest())

        if not hmac.compare_digest(sig_b64, expected_sig):
            return None

        # Verify header
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        if header.get("alg") != JWT_ALGORITHM:
            return None

        # Decode payload and check expiration
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        exp = payload.get("exp")
        if exp and int(time.time()) > int(exp):
            return None

        return payload
    except Exception:
        return None

