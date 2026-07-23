from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation

from app.db import get_cursor
from app.models import (
    OperationResponse,
    ResourceCreateRequest,
    ResourceLoadResponse,
    ResourceResponse,
    ResourceUpdateRequest,
)
from app.security import require_admin

router = APIRouter(prefix="/resources", tags=["resources"])

_SELECT = """
    SELECT r.*, r.first_name || ' ' || r.last_name AS resource_name,
           COALESCE(l.allocated_hours, 0) AS allocated_hours,
           COALESCE(l.available_hours, r.weekly_hours) AS available_hours,
           COALESCE(l.is_over_allocated, FALSE) AS is_over_allocated,
           (SELECT COUNT(*) FROM allocations a WHERE a.resource_id = r.resource_id) AS project_count
    FROM resources r
    LEFT JOIN v_resource_load l ON l.resource_id = r.resource_id
"""


@router.get("")
def list_resources() -> list[ResourceLoadResponse]:
    """Workload view — capacity vs allocated hours."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM v_resource_load ORDER BY resource_name")
        return cur.fetchall()


@router.get("/over-allocated")
def over_allocated() -> list[ResourceLoadResponse]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM v_resource_load WHERE is_over_allocated ORDER BY allocated_hours DESC"
        )
        return cur.fetchall()


@router.get("/directory")
def directory() -> list[ResourceResponse]:
    """Full employee records — used when picking people for a project."""
    with get_cursor() as cur:
        cur.execute(_SELECT + " ORDER BY r.first_name, r.last_name")
        return cur.fetchall()


@router.post("", response_model=ResourceResponse, status_code=201)
def create_resource(
    payload: ResourceCreateRequest, _: object = Depends(require_admin)
) -> ResourceResponse:
    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO resources (first_name, last_name, email, job_title, department,
                                       hourly_rate, annual_salary, weekly_hours, hire_date, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING resource_id
                """,
                (
                    payload.first_name,
                    payload.last_name,
                    payload.email,
                    payload.job_title,
                    payload.department,
                    payload.hourly_rate,
                    payload.annual_salary,
                    payload.weekly_hours,
                    payload.hire_date,
                    payload.is_active,
                ),
            )
            resource_id = cur.fetchone()["resource_id"]
            cur.execute(_SELECT + " WHERE r.resource_id = %s", (resource_id,))
            return cur.fetchone()
    except UniqueViolation:
        raise HTTPException(409, "An employee with that email already exists")


@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int, payload: ResourceUpdateRequest, _: object = Depends(require_admin)
) -> ResourceResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "At least one field is required for update")

    set_clauses = [f"{column} = %s" for column in updates]
    values = list(updates.values()) + [resource_id]

    try:
        with get_cursor() as cur:
            cur.execute(
                f"UPDATE resources SET {', '.join(set_clauses)} WHERE resource_id = %s "
                "RETURNING resource_id",
                values,
            )
            if not cur.fetchone():
                raise HTTPException(404, "Employee not found")
            cur.execute(_SELECT + " WHERE r.resource_id = %s", (resource_id,))
            return cur.fetchone()
    except UniqueViolation:
        raise HTTPException(409, "An employee with that email already exists")


@router.delete("/{resource_id}", response_model=OperationResponse)
def delete_resource(
    resource_id: int, _: object = Depends(require_admin)
) -> OperationResponse:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM resources WHERE resource_id = %s RETURNING resource_id",
            (resource_id,),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Employee not found")

    return OperationResponse(message=f"Employee {resource_id} deleted")
