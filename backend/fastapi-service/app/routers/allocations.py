from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from app.costing import STANDARD_HOURLY_RATE, weekly_cost
from app.db import get_cursor
from app.models import (
    AllocationCreateRequest,
    AllocationResponse,
    AllocationUpdateRequest,
    OperationResponse,
)
from app.security import require_admin

router = APIRouter(prefix="/allocations", tags=["allocations"])

_SELECT = """
    SELECT a.allocation_id, a.project_id, a.resource_id, a.role,
           a.allocated_hours, a.start_date, a.end_date,
           p.name AS project_name,
           r.first_name || ' ' || r.last_name AS resource_name,
           r.job_title, r.department
    FROM allocations a
    JOIN projects p  ON p.project_id  = a.project_id
    JOIN resources r ON r.resource_id = a.resource_id
"""


def _with_cost(row: dict) -> dict:
    row["hourly_rate"] = STANDARD_HOURLY_RATE
    row["weekly_cost"] = weekly_cost(row.get("allocated_hours"))
    return row


def _validate_hours(hours) -> None:
    if hours is None:
        return
    if not 0 < float(hours) <= 40:
        raise HTTPException(400, "Allocated hours must be between 1 and 40 per week")


@router.get("")
def list_allocations(project_id: int | None = Query(None)) -> list[AllocationResponse]:
    sql = _SELECT
    params: list = []
    if project_id:
        sql += " WHERE a.project_id = %s"
        params.append(project_id)
    sql += " ORDER BY a.allocated_hours DESC"

    with get_cursor() as cur:
        cur.execute(sql, params)
        return [_with_cost(row) for row in cur.fetchall()]


@router.post("", response_model=AllocationResponse, status_code=201)
def create_allocation(
    payload: AllocationCreateRequest, _: object = Depends(require_admin)
) -> AllocationResponse:
    """Assign an employee to a project."""
    _validate_hours(payload.allocated_hours)

    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO allocations
                    (project_id, resource_id, role, allocated_hours, start_date, end_date)
                VALUES (%s, %s, %s, %s, COALESCE(%s, CURRENT_DATE), %s)
                RETURNING allocation_id
                """,
                (
                    payload.project_id,
                    payload.resource_id,
                    payload.role,
                    payload.allocated_hours,
                    payload.start_date,
                    payload.end_date,
                ),
            )
            allocation_id = cur.fetchone()["allocation_id"]
            cur.execute(_SELECT + " WHERE a.allocation_id = %s", (allocation_id,))
            return _with_cost(cur.fetchone())
    except UniqueViolation:
        raise HTTPException(409, "That employee is already assigned to this project")
    except ForeignKeyViolation:
        raise HTTPException(404, "Project or employee not found")


@router.put("/{allocation_id}", response_model=AllocationResponse)
def update_allocation(
    allocation_id: int,
    payload: AllocationUpdateRequest,
    _: object = Depends(require_admin),
) -> AllocationResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "At least one field is required for update")
    _validate_hours(updates.get("allocated_hours"))

    set_clauses = [f"{column} = %s" for column in updates]
    values = list(updates.values()) + [allocation_id]

    with get_cursor() as cur:
        cur.execute(
            f"UPDATE allocations SET {', '.join(set_clauses)} WHERE allocation_id = %s "
            "RETURNING allocation_id",
            values,
        )
        if not cur.fetchone():
            raise HTTPException(404, "Allocation not found")
        cur.execute(_SELECT + " WHERE a.allocation_id = %s", (allocation_id,))
        return _with_cost(cur.fetchone())


@router.delete("/{allocation_id}", response_model=OperationResponse)
def delete_allocation(
    allocation_id: int, _: object = Depends(require_admin)
) -> OperationResponse:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM allocations WHERE allocation_id = %s RETURNING allocation_id",
            (allocation_id,),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Allocation not found")

    return OperationResponse(message=f"Allocation {allocation_id} removed")
