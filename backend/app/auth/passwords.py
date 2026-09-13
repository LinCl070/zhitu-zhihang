"""Password hashing and validation helpers for local account authentication."""

import base64
import hashlib
import hmac
import re
from secrets import token_urlsafe

_PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")
_USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,63}$")
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not _USERNAME_PATTERN.fullmatch(username):
        raise ValueError("用户名须为 3-64 位小写字母、数字或 ._-，且以字母或数字开头")
    return username


def validate_password(value: str) -> None:
    if not _PASSWORD_PATTERN.fullmatch(value):
        raise ValueError("密码须为 8-128 位，并同时包含字母和数字")


def hash_password(password: str) -> str:
    validate_password(password)
    salt = token_urlsafe(16).encode("ascii")
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${encoded_salt}${encoded_digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, n, r, p, encoded_salt, encoded_digest = stored_hash.split("$", maxsplit=5)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
        expected = base64.urlsafe_b64decode(encoded_digest.encode("ascii"))
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
    except (ValueError, TypeError, UnicodeError):
        return False
    return hmac.compare_digest(actual, expected)


def generate_temporary_password() -> str:
    """Return a random password that always satisfies the local password policy."""

    return f"T{token_urlsafe(12)}9a"


def hash_temporary_credential(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()
