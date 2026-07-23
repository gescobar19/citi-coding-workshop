from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.errors import UniqueViolation

from app.db import get_cursor
from app.models import (
    OperationResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.security import CurrentUser, require_admin

router = APIRouter(prefix="/users", tags=["users"])

_ALLOWED_ROLES = {"admin", "executive"}

# Passwords are never returned — the admin console only manages them.
_SELECT = "SELECT user_id, email, role, is_active, created_at, updated_at FROM users"


def _validate_role(role: str | None) -> None:
    if role and role not in _ALLOWED_ROLES:
        allowed = ", ".join(sorted(_ALLOWED_ROLES))
        raise HTTPException(400, f"Invalid role '{role}'. Allowed values: {allowed}")


@router.get("")
def list_users(
    role: str | None = Query(None), _: CurrentUser = Depends(require_admin)
) -> list[UserResponse]:
    """Accounts with portal access. Admin-only view."""
    _validate_role(role)

    sql = _SELECT
    params: list = []
    if role:
        sql += " WHERE role = %s"
        params.append(role)
    sql += " ORDER BY role, email"

    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreateRequest, _: CurrentUser = Depends(require_admin)
) -> UserResponse:
    _validate_role(payload.role)
    if not payload.password.strip():
        raise HTTPException(400, "Password is required")

    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, password, role, is_active)
                VALUES (%s, %s, %s, %s)
                RETURNING user_id, email, role, is_active, created_at, updated_at
                """,
                (payload.email, payload.password, payload.role, payload.is_active),
            )
            return cur.fetchone()
    except UniqueViolation:
        raise HTTPException(409, "A user with that email already exists")


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int, payload: UserUpdateRequest, user: CurrentUser = Depends(require_admin)
) -> UserResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "At least one field is required for update")
    _validate_role(updates.get("role"))

    # Don't let an admin lock themselves out of the console.
    if user.user_id == user_id:
        if updates.get("role") == "executive":
            raise HTTPException(400, "You cannot downgrade your own account")
        if updates.get("is_active") is False:
            raise HTTPException(400, "You cannot deactivate your own account")

    set_clauses = [f"{column} = %s" for column in updates]
    values = list(updates.values()) + [user_id]

    try:
        with get_cursor() as cur:
            cur.execute(
                f"UPDATE users SET {', '.join(set_clauses)}, updated_at = now() "
                "WHERE user_id = %s "
                "RETURNING user_id, email, role, is_active, created_at, updated_at",
                values,
            )
            updated = cur.fetchone()
    except UniqueViolation:
        raise HTTPException(409, "A user with that email already exists")

    if not updated:
        raise HTTPException(404, "User not found")

    return updated


@router.delete("/{user_id}", response_model=OperationResponse)
def delete_user(
    user_id: int, user: CurrentUser = Depends(require_admin)
) -> OperationResponse:
    if user.user_id == user_id:
        raise HTTPException(400, "You cannot delete your own account")

    with get_cursor() as cur:
        cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found")

        if target["role"] == "admin":
            cur.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active")
            if cur.fetchone()["n"] <= 1:
                raise HTTPException(400, "The last active administrator cannot be deleted")

        cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))

    return OperationResponse(message=f"User {user_id} deleted")
