from datetime import date
from decimal import Decimal

from fastapi import APIRouter

from app.costing import (
    STANDARD_HOURLY_RATE,
    STANDARD_WEEKLY_HOURS,
    duration_weeks,
    pct,
    projected_cost,
    weekly_cost,
)
from app.db import get_cursor
from app.models import DashboardResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary() -> DashboardResponse:
    """One call that answers the questions the portal exists to answer:
    project health, delivery risk, resource load, dependencies and budget.
    """
    with get_cursor() as cur:
        cur.execute("SELECT * FROM v_project_summary ORDER BY name")
        projects = cur.fetchall()

        cur.execute(
            """
            SELECT p.status, COUNT(*) AS count
            FROM projects p GROUP BY p.status
            """
        )
        by_status = {row["status"]: row["count"] for row in cur.fetchall()}

        cur.execute(
            """
            SELECT d.deliverable_id, d.name, d.display_status, d.expected_date,
                   d.days_late, d.owner_name, p.project_id, p.name AS project_name
            FROM v_deliverables d
            JOIN projects p ON p.project_id = d.project_id
            WHERE d.status NOT IN ('finished','cancelled')
            ORDER BY d.expected_date NULLS LAST
            LIMIT 12
            """
        )
        upcoming = cur.fetchall()

        cur.execute(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status = 'finished') AS finished,
                   COUNT(*) FILTER (WHERE status NOT IN ('finished','cancelled')
                                    AND expected_date < CURRENT_DATE) AS late
            FROM deliverables
            """
        )
        deliverable_stats = cur.fetchone()

        cur.execute("SELECT * FROM v_resource_load ORDER BY allocated_hours DESC")
        resource_load = cur.fetchall()

        cur.execute(
            """
            SELECT b.project_id, p.name AS project_name, b.category,
                   SUM(b.allocated_amount) AS allocated_amount,
                   SUM(b.spent_amount) AS spent_amount
            FROM budgets b
            JOIN projects p ON p.project_id = b.project_id
            GROUP BY b.project_id, p.name, b.category
            ORDER BY p.name, b.category
            """
        )
        budget_rows = cur.fetchall()

        cur.execute("SELECT * FROM v_blocked_projects ORDER BY name")
        blocked = cur.fetchall()

        # Deliverable-to-deliverable chain: what is waiting on what right now.
        # Joined back to v_deliverables so each blocked item carries its own
        # due date and lateness, not just its blocker's.
        cur.execute(
            """
            SELECT bd.*, d.expected_date, d.days_late, d.owner_name
            FROM v_blocked_deliverables bd
            JOIN v_deliverables d ON d.deliverable_id = bd.deliverable_id
            ORDER BY bd.is_cross_project DESC, bd.project_name, bd.deliverable_name
            """
        )
        blocked_deliverables = cur.fetchall()

        cur.execute(
            """
            SELECT a.project_id, a.resource_id, a.allocated_hours,
                   p.start_date, p.expected_end_date
            FROM allocations a
            JOIN projects p ON p.project_id = a.project_id
            """
        )
        allocations = cur.fetchall()

        # Which projects each over-allocated person is spread across, so the
        # dashboard can say where the overage comes from. Same currency filter
        # as v_resource_load, otherwise the hours would not reconcile.
        cur.execute(
            """
            SELECT a.resource_id, p.name AS project_name, a.allocated_hours
            FROM allocations a
            JOIN projects p ON p.project_id = a.project_id
            WHERE a.end_date IS NULL OR a.end_date >= CURRENT_DATE
            ORDER BY a.allocated_hours DESC
            """
        )
        resource_projects: dict[int, list[str]] = {}
        for row in cur.fetchall():
            resource_projects.setdefault(row["resource_id"], []).append(
                row["project_name"]
            )

        # Deliverable progress per project, split the way it needs reading:
        # what is done, what is still open and on time, what has already slipped.
        cur.execute(
            """
            SELECT p.project_id, p.name AS project_name,
                   COUNT(*) FILTER (WHERE d.status = 'finished') AS done_count,
                   COUNT(*) FILTER (WHERE d.status NOT IN ('finished','cancelled')
                                    AND (d.expected_date IS NULL
                                         OR d.expected_date >= CURRENT_DATE)) AS open_count,
                   COUNT(*) FILTER (WHERE d.status NOT IN ('finished','cancelled')
                                    AND d.expected_date < CURRENT_DATE) AS late_count
            FROM projects p
            JOIN deliverables d ON d.project_id = p.project_id
            WHERE p.status NOT IN ('finished','cancelled')
            GROUP BY p.project_id, p.name
            ORDER BY p.name
            """
        )
        delivery_by_project = cur.fetchall()

    # ---- Budget & labour roll-up -------------------------------------
    budget_allocated = sum(
        (Decimal(str(row["allocated_amount"])) for row in budget_rows), Decimal("0")
    )
    budget_spent = sum(
        (Decimal(str(row["spent_amount"])) for row in budget_rows), Decimal("0")
    )

    weekly_hours = sum(
        (Decimal(str(row["allocated_hours"])) for row in allocations), Decimal("0")
    )
    weekly_labor = sum(
        (weekly_cost(row["allocated_hours"]) for row in allocations), Decimal("0")
    )
    projected_labor = sum(
        (
            projected_cost(
                row["allocated_hours"],
                duration_weeks(row["start_date"], row["expected_end_date"]),
            )
            for row in allocations
        ),
        Decimal("0"),
    )

    by_category: dict[str, Decimal] = {}
    for row in budget_rows:
        by_category[row["category"]] = by_category.get(
            row["category"], Decimal("0")
        ) + Decimal(str(row["spent_amount"]))

    # ---- Delivery risk ------------------------------------------------
    today = date.today()
    live = [p for p in projects if p["status"] not in ("finished", "cancelled")]
    signals = {p["project_id"]: _risk_signals(p, blocked, today) for p in live}

    at_risk = [
        {
            "project_id": p["project_id"],
            "name": p["name"],
            "status": p["status"],
            "priority": p["priority"],
            "start_date": p["start_date"],
            "expected_end_date": p["expected_end_date"],
            "lead": p["lead"],
            "deliverables_done": p["deliverables_done"],
            "deliverables_total": p["deliverables_total"],
            "budget_allocated": p["budget_allocated"],
            "budget_spent": p["budget_spent"],
            "reasons": [label for label, _ in signals[p["project_id"]]],
        }
        for p in live
        if signals[p["project_id"]]
    ]

    active = [p for p in projects if p["status"] == "in_progress"]
    over_allocated = [r for r in resource_load if r["is_over_allocated"]]

    attention = _attention(
        live, signals, blocked_deliverables, over_allocated, resource_projects, today
    )
    total_capacity = sum(
        (Decimal(str(r["weekly_hours"])) for r in resource_load), Decimal("0")
    )
    allocated_total = sum(
        (Decimal(str(r["allocated_hours"])) for r in resource_load), Decimal("0")
    )

    return {
        "kpis": {
            "projects_total": len(projects),
            "projects_active": len(active),
            "projects_at_risk": len(at_risk),
            "projects_finished": by_status.get("finished", 0),
            "deliverables_total": deliverable_stats["total"],
            "deliverables_done": deliverable_stats["finished"],
            "deliverables_late": deliverable_stats["late"],
            "deliverables_done_pct": pct(
                deliverable_stats["finished"], deliverable_stats["total"]
            ),
            "resources_total": len(resource_load),
            "resources_over_allocated": len(over_allocated),
            "resources_unassigned": len(
                [r for r in resource_load if Decimal(str(r["allocated_hours"])) == 0]
            ),
            "utilization_pct": pct(allocated_total, total_capacity),
            "budget_allocated": budget_allocated,
            "budget_spent": budget_spent,
            "budget_remaining": budget_allocated - budget_spent,
            "budget_used_pct": pct(budget_spent, budget_allocated),
            "weekly_hours": weekly_hours,
            "weekly_labor_cost": weekly_labor,
            "projected_labor_cost": projected_labor,
            "blocked_projects": len({row["project_id"] for row in blocked}),
            "blocked_deliverables": len(
                {row["deliverable_id"] for row in blocked_deliverables}
            ),
        },
        "status_breakdown": [
            {"status": status, "count": by_status.get(status, 0)}
            for status in ("not_started", "in_progress", "finished", "cancelled")
        ],
        "projects": projects,
        "at_risk": at_risk,
        "attention": attention,
        "delivery_by_project": delivery_by_project,
        "upcoming_deliverables": upcoming,
        "resource_load": resource_load[:10],
        "over_allocated": over_allocated,
        "blocked": blocked,
        "blocked_deliverables": blocked_deliverables,
        "spend_by_category": [
            {"category": category, "amount": amount}
            for category, amount in sorted(
                by_category.items(), key=lambda item: item[1], reverse=True
            )
        ],
        "standard_rate": {
            "hourly_rate": float(STANDARD_HOURLY_RATE),
            "weekly_hours": float(STANDARD_WEEKLY_HOURS),
            "full_time_weekly_cost": float(STANDARD_HOURLY_RATE * STANDARD_WEEKLY_HOURS),
        },
    }


# How much a project's own priority adds on top of its risk signals. A late
# critical project outranks a late low-priority one.
_PRIORITY_WEIGHT = {"critical": 15, "high": 8, "medium": 0, "low": 0}


def _risk_signals(project: dict, blocked: list[dict], today: date) -> list[tuple[str, int]]:
    """Every reason a live project needs attention, each with a severity weight.

    Weights are what let the dashboard rank one problem above another instead of
    dumping an unordered list on the reader.
    """
    signals: list[tuple[str, int]] = []

    end = project["expected_end_date"]
    if end and end < today:
        days = (today - end).days
        signals.append((f"{days}d past end date", 40 + min(days, 30)))

    if project["has_late_deliverables"]:
        signals.append(("Late deliverables", 25))

    allocated = Decimal(str(project["budget_allocated"] or 0))
    spent = Decimal(str(project["budget_spent"] or 0))
    if allocated > 0:
        if spent > allocated:
            signals.append((f"Over budget by {pct(spent - allocated, allocated)}%", 35))
        elif spent / allocated >= Decimal("0.9"):
            signals.append(("Budget 90%+ consumed", 20))

    blockers = [
        row["blocked_by_name"]
        for row in blocked
        if row["project_id"] == project["project_id"]
    ]
    if blockers:
        label = (
            f"Blocked by {blockers[0]}"
            if len(blockers) == 1
            else f"Blocked by {len(blockers)} projects"
        )
        signals.append((label, 20))

    if not project["team_size"]:
        signals.append(("No resources assigned", 15))

    return signals


def _severity(score: int) -> str:
    if score >= 60:
        return "critical"
    if score >= 30:
        return "high"
    return "medium"


def _attention(
    live: list[dict],
    signals: dict[int, list[tuple[str, int]]],
    blocked_deliverables: list[dict],
    over_allocated: list[dict],
    resource_projects: dict[int, list[str]],
    today: date,
) -> list[dict]:
    """One ranked queue of everything that needs a decision.

    Projects, deliverables and people are three different tables but one job for
    whoever is reading: what do I deal with first? Scoring them on a common
    scale is the only way to answer that in one place.
    """
    items: list[dict] = []

    for project in live:
        rows = signals[project["project_id"]]
        if not rows:
            continue
        score = sum(weight for _, weight in rows)
        score += _PRIORITY_WEIGHT.get(project["priority"], 0)
        items.append(
            {
                "key": f"project-{project['project_id']}",
                "kind": "project",
                "title": project["name"],
                "context": f"{project['priority'].title()} priority",
                "reasons": [label for label, _ in rows],
                "owner": project["lead"],
                "due": project["expected_end_date"],
                "project_id": project["project_id"],
                "score": score,
                "severity": _severity(score),
            }
        )

    for row in blocked_deliverables:
        days_late = row["days_late"] or 0
        # A blocked deliverable that is still inside its own project and still
        # on time is normal sequencing, not a problem. Only surface the ones
        # that have slipped or that reach across a project boundary.
        if not days_late and not row["is_cross_project"]:
            continue

        score = 10
        reasons = [f"Waiting on {row['depends_on_name']}"]
        if days_late:
            score += 30 + min(days_late, 30)
            reasons.insert(0, f"{days_late}d late")
        if row["is_cross_project"]:
            score += 15
            reasons.append(f"Owned by {row['depends_on_project_name']}")

        items.append(
            {
                "key": f"deliverable-{row['deliverable_id']}-{row['depends_on_id']}",
                "kind": "deliverable",
                "title": row["deliverable_name"],
                "context": row["project_name"],
                "reasons": reasons,
                "owner": row["owner_name"],
                "due": row["expected_date"],
                "project_id": row["project_id"],
                "score": score,
                "severity": _severity(score),
            }
        )

    for resource in over_allocated:
        capacity = Decimal(str(resource["weekly_hours"]))
        assigned = Decimal(str(resource["allocated_hours"]))
        overage = pct(assigned - capacity, capacity)
        names = resource_projects.get(resource["resource_id"], [])
        reasons = [f"{assigned:g}h assigned vs {capacity:g}h capacity"]
        if names:
            reasons.append(
                names[0] if len(names) == 1 else f"Split across {len(names)} projects"
            )

        score = 10 + min(int(overage), 40)
        items.append(
            {
                "key": f"resource-{resource['resource_id']}",
                "kind": "resource",
                "title": resource["resource_name"],
                "context": resource["department"] or "Unassigned department",
                "reasons": reasons,
                "owner": None,
                "due": None,
                "project_id": None,
                "score": score,
                "severity": _severity(score),
            }
        )

    items.sort(key=lambda item: (-item["score"], item["title"]))
    return items
