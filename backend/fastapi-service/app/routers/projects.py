from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.costing import (
    STANDARD_HOURLY_RATE,
    STANDARD_WEEKLY_HOURS,
    duration_weeks,
    projected_cost,
    weekly_cost,
)
from app.db import get_cursor
from app.models import (
    OperationResponse,
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectFullResponse,
    ProjectSummaryResponse,
    ProjectUpdateRequest,
)
from app.security import require_admin

router = APIRouter(prefix="/projects", tags=["projects"])

_ALLOWED_STATUSES = {"not_started", "in_progress", "finished", "cancelled"}
_ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}


def _validate_status(status: str | None) -> None:
    if status and status not in _ALLOWED_STATUSES:
        allowed = ", ".join(sorted(_ALLOWED_STATUSES))
        raise HTTPException(400, f"Invalid status '{status}'. Allowed values: {allowed}")


def _validate_priority(priority: str | None) -> None:
    if priority and priority not in _ALLOWED_PRIORITIES:
        allowed = ", ".join(sorted(_ALLOWED_PRIORITIES))
        raise HTTPException(400, f"Invalid priority '{priority}'. Allowed values: {allowed}")


@router.get("")
def list_projects(
    status: str | None = Query(None),
) -> list[ProjectSummaryResponse]:
    """Landing page - one row per project."""
    _validate_status(status)

    sql = "SELECT * FROM v_project_summary"
    params = []
    if status:
        sql += " WHERE status = %s"
        params.append(status)
    sql += " ORDER BY priority, name"

    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{project_id}")
def get_project(project_id: int) -> ProjectFullResponse:
    """Detail page - project plus people, budget, deliverables, blockers."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM v_projects WHERE project_id = %s",
            (project_id,),
        )
        project = cur.fetchone()
        if not project:
            raise HTTPException(404, "Project not found")

        cur.execute(
            """
            SELECT a.allocation_id, a.role, a.allocated_hours,
                   a.start_date, a.end_date,
                   r.resource_id, r.first_name || ' ' || r.last_name AS resource_name,
                   r.job_title, r.department,
                   r.hourly_rate AS actual_hourly_rate
            FROM allocations a
            JOIN resources r ON r.resource_id = a.resource_id
            WHERE a.project_id = %s
            ORDER BY a.allocated_hours DESC
            """,
            (project_id,),
        )
        team = cur.fetchall()

        # Labour is charged at the standard rate (40h week at $100/hour).
        weeks = duration_weeks(project["start_date"], project["expected_end_date"])
        for member in team:
            member["hourly_rate"] = STANDARD_HOURLY_RATE
            member["weekly_cost"] = weekly_cost(member["allocated_hours"])
            member["projected_cost"] = projected_cost(member["allocated_hours"], weeks)

        cur.execute(
            """
            SELECT budget_id, category, description,
                   allocated_amount, spent_amount, currency, fiscal_year
            FROM budgets WHERE project_id = %s ORDER BY category
            """,
            (project_id,),
        )
        budget = cur.fetchall()

        cur.execute(
            """
            SELECT deliverable_id, name, description, sequence_no,
                   status, display_status, expected_date, completed_date,
                   days_late, owner_name
            FROM v_deliverables WHERE project_id = %s ORDER BY sequence_no
            """,
            (project_id,),
        )
        deliverables = cur.fetchall()

        cur.execute(
            """
            SELECT blocked_by_id, blocked_by_name, blocker_status, dependency_type
            FROM v_blocked_projects WHERE project_id = %s
            """,
            (project_id,),
        )
        blockers = cur.fetchall()

        # Deliverable-level dependency chain. Edges are pulled for both
        # directions so a deliverable in another project that waits on this
        # one still shows up.
        cur.execute(
            """
            SELECT * FROM v_deliverable_dependencies
            WHERE project_id = %s OR depends_on_project_id = %s
            ORDER BY deliverable_name
            """,
            (project_id, project_id),
        )
        dependencies = cur.fetchall()

    waits_on: dict[int, list] = {}
    required_by: dict[int, list] = {}
    for edge in dependencies:
        waits_on.setdefault(edge["deliverable_id"], []).append(edge)
        required_by.setdefault(edge["depends_on_id"], []).append(edge)

    for deliverable in deliverables:
        did = deliverable["deliverable_id"]
        deliverable["waits_on"] = waits_on.get(did, [])
        deliverable["required_by"] = required_by.get(did, [])
        deliverable["is_blocked"] = any(
            edge["is_blocking"] for edge in deliverable["waits_on"]
        )

    total_hours = sum(Decimal(str(m["allocated_hours"])) for m in team) if team else Decimal("0")

    return {
        "project": project,
        "team": team,
        "budget": budget,
        "deliverables": deliverables,
        "blockers": blockers,
        "deliverable_dependencies": dependencies,
        "labor": {
            "duration_weeks": weeks,
            "weekly_hours": total_hours,
            "fte_equivalent": round(float(total_hours / STANDARD_WEEKLY_HOURS), 2),
            "hourly_rate": STANDARD_HOURLY_RATE,
            "weekly_labor_cost": sum(
                (m["weekly_cost"] for m in team), Decimal("0")
            ),
            "projected_labor_cost": sum(
                (m["projected_cost"] for m in team), Decimal("0")
            ),
        },
    }


@router.post("", response_model=ProjectDetailResponse, status_code=201)
def create_project(
    payload: ProjectCreateRequest, _: object = Depends(require_admin)
) -> ProjectDetailResponse:
    _validate_status(payload.status)
    _validate_priority(payload.priority)

    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO projects (
                name, description, objective, status, priority,
                start_date, expected_end_date, actual_end_date,
                sponsor_id, lead_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                payload.name,
                payload.description,
                payload.objective,
                payload.status,
                payload.priority,
                payload.start_date,
                payload.expected_end_date,
                payload.actual_end_date,
                payload.sponsor_id,
                payload.lead_id,
            ),
        )
        created = cur.fetchone()

    if not created:
        raise HTTPException(500, "Project creation failed")

    return created


@router.put("/{project_id}", response_model=ProjectDetailResponse)
def update_project(
    project_id: int, payload: ProjectUpdateRequest, _: object = Depends(require_admin)
) -> ProjectDetailResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "At least one field is required for update")

    _validate_status(updates.get("status"))
    _validate_priority(updates.get("priority"))

    allowed_columns = {
        "name",
        "description",
        "objective",
        "status",
        "priority",
        "start_date",
        "expected_end_date",
        "actual_end_date",
        "sponsor_id",
        "lead_id",
    }

    set_clauses = []
    values = []
    for column, value in updates.items():
        if column not in allowed_columns:
            continue
        set_clauses.append(f"{column} = %s")
        values.append(value)

    if not set_clauses:
        raise HTTPException(400, "No valid fields provided for update")

    values.append(project_id)

    with get_cursor() as cur:
        cur.execute(
            f"""
            UPDATE projects
            SET {", ".join(set_clauses)}, updated_at = now()
            WHERE project_id = %s
            RETURNING *
            """,
            values,
        )
        updated = cur.fetchone()

    if not updated:
        raise HTTPException(404, "Project not found")

    return updated


@router.delete("/{project_id}", response_model=OperationResponse)
def delete_project(project_id: int, _: object = Depends(require_admin)) -> OperationResponse:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM projects WHERE project_id = %s RETURNING project_id",
            (project_id,),
        )
        deleted = cur.fetchone()

    if not deleted:
        raise HTTPException(404, "Project not found")

    return OperationResponse(message=f"Project {project_id} deleted")
