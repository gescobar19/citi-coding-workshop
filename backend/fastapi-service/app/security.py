"""Role-based access control.

The workshop app has no token layer — login returns the user row and the
frontend echoes it back on every call via X-User-Id / X-User-Role. Writes are
admin-only; executives get read access to everything.
"""

from fastapi import Depends, Header, HTTPException

ADMIN = "admin"
EXECUTIVE = "executive"


class CurrentUser:
    def __init__(self, user_id: int | None, role: str):
        self.user_id = user_id
        self.role = role

    @property
    def is_admin(self) -> bool:
        return self.role == ADMIN


def current_user(
    x_user_id: int | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> CurrentUser:
    return CurrentUser(x_user_id, (x_user_role or EXECUTIVE).strip().lower())


def require_admin(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(
            403, "Administrator role required — executive accounts are read-only"
        )
    return user
