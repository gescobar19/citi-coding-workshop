from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from psycopg_pool import ConnectionPool
from app.db import pool

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user_id: int
    email: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate user with email and plaintext password.
    Returns user info and role.
    """
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Query the users table with explicit schema
                cur.execute(
                    "SELECT user_id, email, password, role, is_active FROM pms.users WHERE email = %s",
                    (request.email,),
                )
                user = cur.fetchone()

                if not user:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password",
                    )

                user_id, email, stored_password, role, is_active = user

                if not is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User account is inactive",
                    )

                # Compare plaintext password
                if request.password != stored_password:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password",
                    )

                return LoginResponse(user_id=user_id, email=email, role=role)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {str(e)}",
        )
