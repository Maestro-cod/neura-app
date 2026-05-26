"""
JWT authentication dependency for NEURA FastAPI backend.
Validates Supabase-issued JWTs locally using the project JWT secret (no network call).
"""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

_bearer = HTTPBearer()

SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    """
    Extract and validate a Supabase JWT from the Authorization: Bearer header.
    Returns the verified user_id (JWT 'sub' claim).
    Raises HTTP 401 on missing, expired, or tampered tokens.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim",
        )
    return user_id


def require_self(current_user: str, requested_user_id: str) -> None:
    """Raise HTTP 403 if the authenticated user doesn't match the requested user_id."""
    if current_user != requested_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own resources",
        )
