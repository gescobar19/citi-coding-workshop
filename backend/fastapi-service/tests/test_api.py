from contextlib import contextmanager
from datetime import date
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

# Writes are administrator-only; reads need no headers.
ADMIN = {"X-User-Id": "1", "X-User-Role": "admin"}
EXECUTIVE = {"X-User-Id": "2", "X-User-Role": "executive"}


class FakeCursor:
    def __init__(self, fetchone_value=None, fetchall_values=None):
        self.fetchone_value = fetchone_value
        self.fetchall_values = list(fetchall_values or [])

    def execute(self, _sql, _params=None):
        return None

    def fetchone(self):
        return self.fetchone_value

    def fetchall(self):
        if not self.fetchall_values:
            return []
        return self.fetchall_values.pop(0)


@contextmanager
def cursor_context(cursor):
    yield cursor


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_projects_returns_data(monkeypatch):
    data = [
        {
            "project_id": 1,
            "name": "Roll Out New Credit Card",
            "status": "in_progress",
            "priority": "critical",
            "start_date": "2026-01-15",
            "expected_end_date": "2026-11-30",
            "sponsor": "Sarah Chen",
            "lead": "James Wright",
            "team_size": 3,
            "total_hours": 70.0,
            "budget_allocated": 1520000.0,
            "budget_spent": 457000.0,
            "deliverables_total": 4,
            "deliverables_done": 2,
            "has_late_deliverables": False,
        }
    ]
    cursor = FakeCursor(fetchall_values=[data])

    monkeypatch.setattr(
        "app.routers.projects.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.get("/projects")

    assert response.status_code == 200
    assert response.json()[0]["project_id"] == 1


def test_list_projects_invalid_status_returns_400():
    client = TestClient(app)
    response = client.get("/projects?status=bad")

    assert response.status_code == 400
    assert "Invalid status" in response.json()["detail"]


def test_get_project_not_found_returns_404(monkeypatch):
    cursor = FakeCursor(fetchone_value=None)

    monkeypatch.setattr(
        "app.routers.projects.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.get("/projects/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_list_resources_returns_data(monkeypatch):
    data = [
        {
            "resource_id": 4,
            "resource_name": "David Kim",
            "department": "Engineering",
            "weekly_hours": 40.0,
            "allocated_hours": 45.0,
            "available_hours": -5.0,
            "is_over_allocated": True,
        }
    ]
    cursor = FakeCursor(fetchall_values=[data])

    monkeypatch.setattr(
        "app.routers.resources.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.get("/resources")

    assert response.status_code == 200
    assert response.json()[0]["resource_name"] == "David Kim"


def test_over_allocated_returns_data(monkeypatch):
    data = [
        {
            "resource_id": 4,
            "resource_name": "David Kim",
            "department": "Engineering",
            "weekly_hours": 40.0,
            "allocated_hours": 45.0,
            "available_hours": -5.0,
            "is_over_allocated": True,
        }
    ]
    cursor = FakeCursor(fetchall_values=[data])

    monkeypatch.setattr(
        "app.routers.resources.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.get("/resources/over-allocated")

    assert response.status_code == 200
    assert response.json()[0]["is_over_allocated"] is True


def test_create_project_returns_201(monkeypatch):
    created = {
        "project_id": 7,
        "name": "New Project",
        "status": "not_started",
        "priority": "medium",
    }
    cursor = FakeCursor(fetchone_value=created)

    monkeypatch.setattr(
        "app.routers.projects.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.post(
        "/projects",
        json={
            "name": "New Project",
            "status": "not_started",
            "priority": "medium",
        },
        headers=ADMIN,
    )

    assert response.status_code == 201
    assert response.json()["project_id"] == 7


def test_update_project_returns_200(monkeypatch):
    updated = {
        "project_id": 1,
        "name": "Renamed Project",
        "status": "in_progress",
        "priority": "high",
    }
    cursor = FakeCursor(fetchone_value=updated)

    monkeypatch.setattr(
        "app.routers.projects.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.put(
        "/projects/1",
        json={"name": "Renamed Project", "priority": "high"},
        headers=ADMIN,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Project"


def test_update_project_without_fields_returns_400():
    client = TestClient(app)
    response = client.put("/projects/1", json={}, headers=ADMIN)

    assert response.status_code == 400
    assert "At least one field" in response.json()["detail"]


def test_delete_project_returns_200(monkeypatch):
    cursor = FakeCursor(fetchone_value={"project_id": 1})

    monkeypatch.setattr(
        "app.routers.projects.get_cursor",
        lambda: cursor_context(cursor),
    )

    client = TestClient(app)
    response = client.delete("/projects/1", headers=ADMIN)

    assert response.status_code == 200
    assert response.json()["message"] == "Project 1 deleted"


# ============================================================
# Role-based access control
# ============================================================


def test_executive_cannot_create_project():
    client = TestClient(app)
    response = client.post("/projects", json={"name": "Nope"}, headers=EXECUTIVE)

    assert response.status_code == 403
    assert "Administrator role required" in response.json()["detail"]


def test_missing_role_header_is_treated_as_read_only():
    client = TestClient(app)
    response = client.delete("/projects/1")

    assert response.status_code == 403


def test_executive_cannot_list_users():
    client = TestClient(app)
    response = client.get("/users", headers=EXECUTIVE)

    assert response.status_code == 403


def test_admin_can_list_users(monkeypatch):
    users = [
        {
            "user_id": 1,
            "email": "admin@acme.com",
            "role": "admin",
            "is_active": True,
            "created_at": None,
            "updated_at": None,
        }
    ]
    cursor = FakeCursor(fetchall_values=[users])

    monkeypatch.setattr("app.routers.users.get_cursor", lambda: cursor_context(cursor))

    client = TestClient(app)
    response = client.get("/users", headers=ADMIN)

    assert response.status_code == 200
    assert response.json()[0]["role"] == "admin"


def test_admin_cannot_delete_own_account():
    client = TestClient(app)
    response = client.delete("/users/1", headers=ADMIN)

    assert response.status_code == 400
    assert "your own account" in response.json()["detail"]


# ============================================================
# Allocations (employees assigned to projects)
# ============================================================


def test_allocation_hours_are_capped_at_a_full_week():
    client = TestClient(app)
    response = client.post(
        "/allocations",
        json={"project_id": 1, "resource_id": 1, "allocated_hours": 60},
        headers=ADMIN,
    )

    assert response.status_code == 400
    assert "between 1 and 40" in response.json()["detail"]


def test_list_allocations_includes_standard_rate_and_weekly_cost(monkeypatch):
    rows = [
        {
            "allocation_id": 1,
            "project_id": 1,
            "resource_id": 4,
            "role": "Engineer",
            "allocated_hours": 40,
            "start_date": "2026-01-01",
            "end_date": None,
            "project_name": "Roll Out New Credit Card",
            "resource_name": "David Kim",
            "job_title": "Senior Engineer",
            "department": "Engineering",
        }
    ]
    cursor = FakeCursor(fetchall_values=[rows])

    monkeypatch.setattr(
        "app.routers.allocations.get_cursor", lambda: cursor_context(cursor)
    )

    client = TestClient(app)
    response = client.get("/allocations?project_id=1")
    body = response.json()[0]

    assert response.status_code == 200
    # 40 hours at the standard $100/hour rate.
    assert float(body["hourly_rate"]) == 100.0
    assert float(body["weekly_cost"]) == 4000.0


# ============================================================
# Budget costing rules
# ============================================================


def test_costing_helpers_use_the_standard_rate():
    from app.costing import duration_weeks, projected_cost, weekly_cost

    assert float(weekly_cost(40)) == 4000.0
    assert float(weekly_cost(20)) == 2000.0

    weeks = duration_weeks(date(2026, 1, 1), date(2026, 3, 26))
    assert weeks == 12
    assert float(projected_cost(40, weeks)) == 48000.0


def test_duration_weeks_handles_missing_or_inverted_dates():
    from app.costing import duration_weeks

    assert duration_weeks(None, date(2026, 3, 1)) == 0
    assert duration_weeks(date(2026, 3, 1), None) == 0
    assert duration_weeks(date(2026, 3, 1), date(2026, 1, 1)) == 0


def test_budget_summary_projects_labour_over_the_project_duration(monkeypatch):
    projects = [
        {
            "project_id": 1,
            "name": "Roll Out New Credit Card",
            "status": "in_progress",
            "priority": "critical",
            "start_date": date(2026, 1, 1),
            "expected_end_date": date(2026, 3, 26),  # 12 weeks
            "budget_allocated": 500000,
            "budget_spent": 100000,
        }
    ]
    allocations = [
        {
            "project_id": 1,
            "resource_id": 4,
            "allocated_hours": 40,
            "resource_name": "David Kim",
            "job_title": "Senior Engineer",
            "department": "Engineering",
        }
    ]
    cursor = FakeCursor(fetchall_values=[projects, allocations])

    monkeypatch.setattr("app.routers.budgets.get_cursor", lambda: cursor_context(cursor))

    client = TestClient(app)
    response = client.get("/budgets/summary")
    body = response.json()
    project = body["projects"][0]

    assert response.status_code == 200
    assert project["duration_weeks"] == 12
    assert project["fte_equivalent"] == 1.0
    assert float(project["weekly_labor_cost"]) == 4000.0
    assert float(project["projected_labor_cost"]) == 48000.0
    assert float(project["budget_remaining"]) == 400000.0
    assert body["totals"]["standard_hourly_rate"] == 100.0
    assert body["totals"]["standard_weekly_hours"] == 40.0


def test_invalid_budget_category_is_rejected():
    client = TestClient(app)
    response = client.post(
        "/budgets",
        json={"project_id": 1, "category": "snacks", "allocated_amount": 10},
        headers=ADMIN,
    )

    assert response.status_code == 400
    assert "Invalid category" in response.json()["detail"]


# ============================================================
# Deliverables
# ============================================================


def test_finished_deliverable_requires_a_completed_date():
    client = TestClient(app)
    response = client.post(
        "/deliverables",
        json={"project_id": 1, "name": "Go live", "status": "finished"},
        headers=ADMIN,
    )

    assert response.status_code == 400
    assert "completed date" in response.json()["detail"]


# ============================================================
# Dashboard
# ============================================================


def test_dashboard_summary_reports_portfolio_kpis(monkeypatch):
    project_summary = [
        {
            "project_id": 1,
            "name": "Roll Out New Credit Card",
            "status": "in_progress",
            "priority": "critical",
            "start_date": date(2026, 1, 1),
            "expected_end_date": date(2026, 3, 26),
            "sponsor": None,
            "lead": None,
            "team_size": 1,
            "total_hours": 40,
            "budget_allocated": 500000,
            "budget_spent": 100000,
            "deliverables_total": 2,
            "deliverables_done": 1,
            "has_late_deliverables": True,
        }
    ]
    status_counts = [{"status": "in_progress", "count": 1}]
    upcoming = []
    resource_load = [
        {
            "resource_id": 4,
            "resource_name": "David Kim",
            "department": "Engineering",
            "weekly_hours": 40,
            "allocated_hours": 45,
            "available_hours": -5,
            "is_over_allocated": True,
        }
    ]
    budget_rows = [
        {
            "project_id": 1,
            "project_name": "Roll Out New Credit Card",
            "category": "personnel",
            "allocated_amount": 500000,
            "spent_amount": 100000,
        }
    ]
    blocked = []
    allocations = [
        {
            "project_id": 1,
            "resource_id": 4,
            "allocated_hours": 40,
            "start_date": date(2026, 1, 1),
            "expected_end_date": date(2026, 3, 26),
        }
    ]

    cursor = FakeCursor(
        fetchone_value={"total": 2, "finished": 1, "late": 1},
        fetchall_values=[
            project_summary,
            status_counts,
            upcoming,
            resource_load,
            budget_rows,
            blocked,
            [],  # v_blocked_deliverables
            allocations,
        ],
    )

    monkeypatch.setattr(
        "app.routers.dashboard.get_cursor", lambda: cursor_context(cursor)
    )

    client = TestClient(app)
    response = client.get("/dashboard/summary")
    kpis = response.json()["kpis"]

    assert response.status_code == 200
    assert kpis["projects_active"] == 1
    assert kpis["projects_at_risk"] == 1
    assert kpis["resources_over_allocated"] == 1
    assert float(kpis["weekly_labor_cost"]) == 4000.0
    assert float(kpis["projected_labor_cost"]) == 48000.0
    assert kpis["budget_used_pct"] == 20.0


# ============================================================
# Dependency chain between deliverables
# ============================================================


def test_deliverable_cannot_depend_on_itself():
    client = TestClient(app)
    response = client.post(
        "/deliverables/3/dependencies", json={"depends_on_id": 3}, headers=ADMIN
    )

    assert response.status_code == 400
    assert "cannot depend on itself" in response.json()["detail"]


def test_invalid_dependency_type_is_rejected():
    client = TestClient(app)
    response = client.post(
        "/deliverables/3/dependencies",
        json={"depends_on_id": 6, "dependency_type": "whenever"},
        headers=ADMIN,
    )

    assert response.status_code == 400
    assert "Invalid dependency type" in response.json()["detail"]


def test_executive_cannot_add_a_dependency():
    client = TestClient(app)
    response = client.post(
        "/deliverables/3/dependencies", json={"depends_on_id": 6}, headers=EXECUTIVE
    )

    assert response.status_code == 403


def test_circular_dependency_is_refused(monkeypatch):
    # The cycle probe finds the target deliverable upstream of the proposed
    # predecessor, so the edge would close a loop.
    cursor = FakeCursor(fetchone_value={"exists": 1})

    monkeypatch.setattr(
        "app.routers.deliverables.get_cursor", lambda: cursor_context(cursor)
    )

    client = TestClient(app)
    response = client.post(
        "/deliverables/6/dependencies", json={"depends_on_id": 3}, headers=ADMIN
    )

    assert response.status_code == 400
    assert "circular dependency" in response.json()["detail"]


def test_list_blocked_deliverables(monkeypatch):
    rows = [
        {
            "deliverable_id": 3,
            "deliverable_name": "Beta Test",
            "project_id": 1,
            "project_name": "Roll Out New Credit Card",
            "deliverable_status": "in_progress",
            "depends_on_id": 6,
            "depends_on_name": "First Production Run",
            "depends_on_project_id": 2,
            "depends_on_project_name": "Print New Cards",
            "depends_on_status": "in_progress",
            "depends_on_expected_date": None,
            "dependency_type": "finish_to_start",
            "notes": None,
            "is_blocking": True,
            "is_cross_project": True,
        }
    ]
    cursor = FakeCursor(fetchall_values=[rows])

    monkeypatch.setattr(
        "app.routers.deliverables.get_cursor", lambda: cursor_context(cursor)
    )

    client = TestClient(app)
    response = client.get("/deliverables/blocked")
    body = response.json()[0]

    assert response.status_code == 200
    assert body["deliverable_name"] == "Beta Test"
    assert body["depends_on_name"] == "First Production Run"
    assert body["is_cross_project"] is True


def test_dependency_chain_reports_upstream_and_downstream(monkeypatch):
    upstream = [
        {
            "deliverable_id": 6,
            "name": "First Production Run",
            "project_id": 2,
            "project_name": "Print New Cards",
            "status": "in_progress",
            "expected_date": None,
            "depth": 1,
            "path": [3, 6],
            "is_blocking": True,
        }
    ]
    downstream = [
        {
            "deliverable_id": 4,
            "name": "Public Launch",
            "project_id": 1,
            "project_name": "Roll Out New Credit Card",
            "status": "not_started",
            "expected_date": None,
            "depth": 1,
            "path": [3, 4],
            "is_blocking": True,
        }
    ]
    cursor = FakeCursor(
        fetchone_value={"deliverable_id": 3, "name": "Beta Test"},
        fetchall_values=[upstream, downstream],
    )

    monkeypatch.setattr(
        "app.routers.deliverables.get_cursor", lambda: cursor_context(cursor)
    )

    client = TestClient(app)
    response = client.get("/deliverables/3/chain")
    body = response.json()

    assert response.status_code == 200
    assert body["name"] == "Beta Test"
    assert body["blocked"] is True
    assert body["upstream"][0]["name"] == "First Production Run"
    assert body["downstream"][0]["name"] == "Public Launch"
