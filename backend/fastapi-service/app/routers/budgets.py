from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.errors import ForeignKeyViolation

from app.costing import (
    STANDARD_HOURLY_RATE,
    STANDARD_WEEKLY_HOURS,
    duration_weeks,
    pct,
    projected_cost,
    weekly_cost,
)
from app.db import get_cursor
from app.models import (
    BudgetCreateRequest,
    BudgetLineResponse,
    BudgetSummaryResponse,
    BudgetUpdateRequest,
    OperationResponse,
)
from app.security import require_admin

router = APIRouter(prefix="/budgets", tags=["budgets"])

_ALLOWED_CATEGORIES = {
    "personnel",
    "software",
    "hardware",
    "vendor",
    "legal",
    "marketing",
    "training",
    "contingency",
    "other",
}

_SELECT = """
    SELECT b.budget_id, b.project_id, b.category, b.description,
           b.allocated_amount, b.spent_amount, b.currency, b.fiscal_year,
           p.name AS project_name
    FROM budgets b
    JOIN projects p ON p.project_id = b.project_id
"""


def _validate_category(category: str | None) -> None:
    if category and category not in _ALLOWED_CATEGORIES:
        allowed = ", ".join(sorted(_ALLOWED_CATEGORIES))
        raise HTTPException(400, f"Invalid category '{category}'. Allowed values: {allowed}")


@router.get("")
def list_budgets(project_id: int | None = Query(None)) -> list[BudgetLineResponse]:
    sql = _SELECT
    params: list = []
    if project_id:
        sql += " WHERE b.project_id = %s"
        params.append(project_id)
    sql += " ORDER BY p.name, b.category"

    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/summary")
def budget_summary() -> BudgetSummaryResponse:
    """Portfolio budget roll-up.

    Personnel cost is derived from the standard rule (40h week at $100/hour)
    rather than from whatever was typed into the budget line items, so the
    numbers stay consistent with who is actually assigned to the project.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT p.project_id, p.name, p.status, p.priority,
                   p.start_date, p.expected_end_date,
                   COALESCE(b.allocated, 0) AS budget_allocated,
                   COALESCE(b.spent, 0)     AS budget_spent
            FROM projects p
            LEFT JOIN (
                SELECT project_id,
                       SUM(allocated_amount) AS allocated,
                       SUM(spent_amount)     AS spent
                FROM budgets GROUP BY project_id
            ) b ON b.project_id = p.project_id
            ORDER BY p.name
            """
        )
        projects = cur.fetchall()

        cur.execute(
            """
            SELECT a.project_id, a.resource_id, a.allocated_hours,
                   r.first_name || ' ' || r.last_name AS resource_name,
                   r.job_title, r.department
            FROM allocations a
            JOIN resources r ON r.resource_id = a.resource_id
            ORDER BY a.allocated_hours DESC
            """
        )
        allocations = cur.fetchall()

    labor_by_project: dict[int, list[dict]] = {}
    for row in allocations:
        labor_by_project.setdefault(row["project_id"], []).append(row)

    totals = {
        "projects": len(projects),
        "budget_allocated": Decimal("0"),
        "budget_spent": Decimal("0"),
        "weekly_hours": Decimal("0"),
        "weekly_labor_cost": Decimal("0"),
        "projected_labor_cost": Decimal("0"),
    }

    result = []
    for project in projects:
        weeks = duration_weeks(project["start_date"], project["expected_end_date"])
        team = labor_by_project.get(project["project_id"], [])

        labor_lines = [
            {
                "resource_id": member["resource_id"],
                "resource_name": member["resource_name"],
                "job_title": member["job_title"],
                "department": member["department"],
                "allocated_hours": member["allocated_hours"],
                "hourly_rate": STANDARD_HOURLY_RATE,
                "weekly_cost": weekly_cost(member["allocated_hours"]),
                "projected_cost": projected_cost(member["allocated_hours"], weeks),
            }
            for member in team
        ]

        weekly_hours = sum(
            (Decimal(str(m["allocated_hours"])) for m in team), Decimal("0")
        )
        weekly_labor = sum((line["weekly_cost"] for line in labor_lines), Decimal("0"))
        projected_labor = sum(
            (line["projected_cost"] for line in labor_lines), Decimal("0")
        )
        allocated = Decimal(str(project["budget_allocated"]))
        spent = Decimal(str(project["budget_spent"]))

        result.append(
            {
                **project,
                "budget_allocated": allocated,
                "budget_spent": spent,
                "budget_remaining": allocated - spent,
                "utilization_pct": pct(spent, allocated),
                "team_size": len(team),
                "weekly_hours": weekly_hours,
                "fte_equivalent": round(float(weekly_hours / STANDARD_WEEKLY_HOURS), 2),
                "duration_weeks": weeks,
                "weekly_labor_cost": weekly_labor,
                "projected_labor_cost": projected_labor,
                "labor_vs_budget_pct": pct(projected_labor, allocated),
                "over_budget": spent > allocated or projected_labor > allocated,
                "labor": labor_lines,
            }
        )

        totals["budget_allocated"] += allocated
        totals["budget_spent"] += spent
        totals["weekly_hours"] += weekly_hours
        totals["weekly_labor_cost"] += weekly_labor
        totals["projected_labor_cost"] += projected_labor

    totals["budget_remaining"] = totals["budget_allocated"] - totals["budget_spent"]
    totals["utilization_pct"] = pct(totals["budget_spent"], totals["budget_allocated"])
    totals["standard_hourly_rate"] = float(STANDARD_HOURLY_RATE)
    totals["standard_weekly_hours"] = float(STANDARD_WEEKLY_HOURS)

    return {"totals": totals, "projects": result}


@router.post("", response_model=BudgetLineResponse, status_code=201)
def create_budget(
    payload: BudgetCreateRequest, _: object = Depends(require_admin)
) -> BudgetLineResponse:
    _validate_category(payload.category)

    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO budgets (project_id, category, description,
                                     allocated_amount, spent_amount, currency, fiscal_year)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING budget_id
                """,
                (
                    payload.project_id,
                    payload.category,
                    payload.description,
                    payload.allocated_amount,
                    payload.spent_amount,
                    payload.currency,
                    payload.fiscal_year,
                ),
            )
            budget_id = cur.fetchone()["budget_id"]
            cur.execute(_SELECT + " WHERE b.budget_id = %s", (budget_id,))
            return cur.fetchone()
    except ForeignKeyViolation:
        raise HTTPException(404, "Project not found")


@router.put("/{budget_id}", response_model=BudgetLineResponse)
def update_budget(
    budget_id: int, payload: BudgetUpdateRequest, _: object = Depends(require_admin)
) -> BudgetLineResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "At least one field is required for update")
    _validate_category(updates.get("category"))

    set_clauses = [f"{column} = %s" for column in updates]
    values = list(updates.values()) + [budget_id]

    with get_cursor() as cur:
        cur.execute(
            f"UPDATE budgets SET {', '.join(set_clauses)} WHERE budget_id = %s "
            "RETURNING budget_id",
            values,
        )
        if not cur.fetchone():
            raise HTTPException(404, "Budget line not found")
        cur.execute(_SELECT + " WHERE b.budget_id = %s", (budget_id,))
        return cur.fetchone()


@router.delete("/{budget_id}", response_model=OperationResponse)
def delete_budget(budget_id: int, _: object = Depends(require_admin)) -> OperationResponse:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM budgets WHERE budget_id = %s RETURNING budget_id", (budget_id,)
        )
        if not cur.fetchone():
            raise HTTPException(404, "Budget line not found")

    return OperationResponse(message=f"Budget line {budget_id} deleted")
