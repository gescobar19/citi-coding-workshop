from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from app.db import get_cursor
from app.models import (
    DeliverableCreateRequest,
    DeliverableDependencyCreateRequest,
    DeliverableDependencyResponse,
    DeliverableResponse,
    DeliverableUpdateRequest,
    DependencyChainResponse,
    OperationResponse,
)
from app.security import require_admin

router = APIRouter(prefix="/deliverables", tags=["deliverables"])

_ALLOWED_STATUSES = {"not_started", "in_progress", "finished", "cancelled"}
_ALLOWED_DEPENDENCY_TYPES = {"finish_to_start", "start_to_start"}

# Walks the dependency graph from a starting deliverable. Direction is chosen
# by the caller: upstream = what this waits on, downstream = what waits on it.
_UPSTREAM_CTE = """
    WITH RECURSIVE chain AS (
        SELECT dd.depends_on_id AS deliverable_id, 1 AS depth,
               ARRAY[dd.deliverable_id, dd.depends_on_id] AS path
        FROM deliverable_dependencies dd
        WHERE dd.deliverable_id = %s
        UNION ALL
        SELECT dd.depends_on_id, c.depth + 1, c.path || dd.depends_on_id
        FROM deliverable_dependencies dd
        JOIN chain c ON dd.deliverable_id = c.deliverable_id
        WHERE NOT dd.depends_on_id = ANY(c.path)   -- stop if the data ever cycles
          AND c.depth < 20
    )
"""

_DOWNSTREAM_CTE = """
    WITH RECURSIVE chain AS (
        SELECT dd.deliverable_id, 1 AS depth,
               ARRAY[dd.depends_on_id, dd.deliverable_id] AS path
        FROM deliverable_dependencies dd
        WHERE dd.depends_on_id = %s
        UNION ALL
        SELECT dd.deliverable_id, c.depth + 1, c.path || dd.deliverable_id
        FROM deliverable_dependencies dd
        JOIN chain c ON dd.depends_on_id = c.deliverable_id
        WHERE NOT dd.deliverable_id = ANY(c.path)
          AND c.depth < 20
    )
"""

_CHAIN_SELECT = """
    SELECT DISTINCT ON (d.deliverable_id)
           d.deliverable_id, d.name, d.project_id, p.name AS project_name,
           d.status, d.expected_date, c.depth, c.path,
           d.status NOT IN ('finished','cancelled') AS is_blocking
    FROM chain c
    JOIN deliverables d ON d.deliverable_id = c.deliverable_id
    JOIN projects p     ON p.project_id     = d.project_id
    ORDER BY d.deliverable_id, c.depth
"""

_SELECT = """
    SELECT deliverable_id, project_id, name, description, sequence_no,
           status, display_status, expected_date, completed_date,
           days_late, owner_name
    FROM v_deliverables
"""


def _validate(status: str | None, completed_date) -> None:
    if status and status not in _ALLOWED_STATUSES:
        allowed = ", ".join(sorted(_ALLOWED_STATUSES))
        raise HTTPException(400, f"Invalid status '{status}'. Allowed values: {allowed}")
    if status == "finished" and not completed_date:
        raise HTTPException(400, "A finished deliverable needs a completed date")


@router.get("")
def list_deliverables(project_id: int | None = Query(None)) -> list[DeliverableResponse]:
    sql = _SELECT
    params: list = []
    if project_id:
        sql += " WHERE project_id = %s"
        params.append(project_id)
    sql += " ORDER BY project_id, sequence_no"

    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.post("", response_model=DeliverableResponse, status_code=201)
def create_deliverable(
    payload: DeliverableCreateRequest, _: object = Depends(require_admin)
) -> DeliverableResponse:
    _validate(payload.status, payload.completed_date)

    try:
        with get_cursor() as cur:
            sequence_no = payload.sequence_no
            if sequence_no is None:
                cur.execute(
                    "SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next FROM deliverables "
                    "WHERE project_id = %s",
                    (payload.project_id,),
                )
                sequence_no = cur.fetchone()["next"]

            cur.execute(
                """
                INSERT INTO deliverables (project_id, name, description, sequence_no,
                                          status, expected_date, completed_date, owner_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING deliverable_id
                """,
                (
                    payload.project_id,
                    payload.name,
                    payload.description,
                    sequence_no,
                    payload.status,
                    payload.expected_date,
                    payload.completed_date,
                    payload.owner_id,
                ),
            )
            deliverable_id = cur.fetchone()["deliverable_id"]
            cur.execute(_SELECT + " WHERE deliverable_id = %s", (deliverable_id,))
            return cur.fetchone()
    except UniqueViolation:
        raise HTTPException(409, "That sequence number is already used on this project")
    except ForeignKeyViolation:
        raise HTTPException(404, "Project or owner not found")


@router.put("/{deliverable_id}", response_model=DeliverableResponse)
def update_deliverable(
    deliverable_id: int,
    payload: DeliverableUpdateRequest,
    _: object = Depends(require_admin),
) -> DeliverableResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "At least one field is required for update")

    with get_cursor() as cur:
        cur.execute(
            "SELECT status, completed_date FROM deliverables WHERE deliverable_id = %s",
            (deliverable_id,),
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(404, "Deliverable not found")

        status = updates.get("status", existing["status"])
        completed = updates.get("completed_date", existing["completed_date"])
        _validate(updates.get("status"), completed)

        # Clear the completion date when a deliverable is reopened.
        if status != "finished" and "status" in updates:
            updates["completed_date"] = None

        set_clauses = [f"{column} = %s" for column in updates]
        values = list(updates.values()) + [deliverable_id]

        cur.execute(
            f"UPDATE deliverables SET {', '.join(set_clauses)}, updated_at = now() "
            "WHERE deliverable_id = %s RETURNING deliverable_id",
            values,
        )
        cur.execute(_SELECT + " WHERE deliverable_id = %s", (deliverable_id,))
        return cur.fetchone()


@router.delete("/{deliverable_id}", response_model=OperationResponse)
def delete_deliverable(
    deliverable_id: int, _: object = Depends(require_admin)
) -> OperationResponse:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM deliverables WHERE deliverable_id = %s RETURNING deliverable_id",
            (deliverable_id,),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Deliverable not found")

    return OperationResponse(message=f"Deliverable {deliverable_id} deleted")


# ============================================================
# Dependency chain between deliverables
# ============================================================


@router.get("/dependencies")
def list_dependencies(
    project_id: int | None = Query(None),
    blocking_only: bool = Query(False),
) -> list[DeliverableDependencyResponse]:
    """Every "X waits on Y" edge, optionally narrowed to one project."""
    sql = "SELECT * FROM v_deliverable_dependencies"
    clauses = []
    params: list = []

    if project_id:
        # Include edges where either end belongs to the project so a
        # cross-project blocker still shows up on both sides.
        clauses.append("(project_id = %s OR depends_on_project_id = %s)")
        params.extend([project_id, project_id])
    if blocking_only:
        clauses.append("is_blocking AND deliverable_status NOT IN ('finished','cancelled')")

    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY project_name, deliverable_name"

    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/blocked")
def blocked_deliverables() -> list[DeliverableDependencyResponse]:
    """Deliverables that cannot start because a predecessor is unfinished."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM v_blocked_deliverables ORDER BY project_name, deliverable_name"
        )
        return cur.fetchall()


@router.get("/{deliverable_id}/chain")
def dependency_chain(deliverable_id: int) -> DependencyChainResponse:
    """The full chain around one deliverable: everything it transitively
    waits on, and everything transitively waiting on it."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT deliverable_id, name FROM deliverables WHERE deliverable_id = %s",
            (deliverable_id,),
        )
        deliverable = cur.fetchone()
        if not deliverable:
            raise HTTPException(404, "Deliverable not found")

        cur.execute(_UPSTREAM_CTE + _CHAIN_SELECT, (deliverable_id,))
        upstream = cur.fetchall()

        cur.execute(_DOWNSTREAM_CTE + _CHAIN_SELECT, (deliverable_id,))
        downstream = cur.fetchall()

    return {
        "deliverable_id": deliverable["deliverable_id"],
        "name": deliverable["name"],
        "upstream": upstream,
        "downstream": downstream,
        "blocked": any(node["is_blocking"] for node in upstream),
    }


@router.post("/{deliverable_id}/dependencies", status_code=201)
def add_dependency(
    deliverable_id: int,
    payload: DeliverableDependencyCreateRequest,
    _: object = Depends(require_admin),
) -> DeliverableDependencyResponse:
    """Record that this deliverable waits on another one."""
    if payload.dependency_type not in _ALLOWED_DEPENDENCY_TYPES:
        allowed = ", ".join(sorted(_ALLOWED_DEPENDENCY_TYPES))
        raise HTTPException(400, f"Invalid dependency type. Allowed values: {allowed}")

    if payload.depends_on_id == deliverable_id:
        raise HTTPException(400, "A deliverable cannot depend on itself")

    with get_cursor() as cur:
        # Adding "A waits on B" is a cycle when B already waits on A,
        # directly or through any number of steps.
        cur.execute(
            _UPSTREAM_CTE + "SELECT 1 FROM chain WHERE deliverable_id = %s LIMIT 1",
            (payload.depends_on_id, deliverable_id),
        )
        if cur.fetchone():
            raise HTTPException(
                400, "That would create a circular dependency between deliverables"
            )

        try:
            cur.execute(
                """
                INSERT INTO deliverable_dependencies
                    (deliverable_id, depends_on_id, dependency_type, notes)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    deliverable_id,
                    payload.depends_on_id,
                    payload.dependency_type,
                    payload.notes,
                ),
            )
        except UniqueViolation:
            raise HTTPException(409, "That dependency already exists")
        except ForeignKeyViolation:
            raise HTTPException(404, "Deliverable not found")

        cur.execute(
            "SELECT * FROM v_deliverable_dependencies "
            "WHERE deliverable_id = %s AND depends_on_id = %s",
            (deliverable_id, payload.depends_on_id),
        )
        return cur.fetchone()


@router.delete("/{deliverable_id}/dependencies/{depends_on_id}")
def remove_dependency(
    deliverable_id: int, depends_on_id: int, _: object = Depends(require_admin)
) -> OperationResponse:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM deliverable_dependencies "
            "WHERE deliverable_id = %s AND depends_on_id = %s RETURNING deliverable_id",
            (deliverable_id, depends_on_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Dependency not found")

    return OperationResponse(message="Dependency removed")
