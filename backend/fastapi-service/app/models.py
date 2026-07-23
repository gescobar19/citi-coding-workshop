from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str


class ResourceLoadResponse(BaseModel):
    resource_id: int
    resource_name: str
    department: str | None = None
    weekly_hours: Decimal | float | None = None
    allocated_hours: Decimal | float | None = None
    available_hours: Decimal | float | None = None
    is_over_allocated: bool


class ProjectSummaryResponse(BaseModel):
    project_id: int
    name: str
    status: str
    priority: str
    start_date: date | None = None
    expected_end_date: date | None = None
    sponsor: str | None = None
    lead: str | None = None
    team_size: int | None = None
    total_hours: Decimal | float | None = None
    budget_allocated: Decimal | float | None = None
    budget_spent: Decimal | float | None = None
    deliverables_total: int | None = None
    deliverables_done: int | None = None
    has_late_deliverables: bool | None = None


class ProjectDetailResponse(BaseModel):
    model_config = ConfigDict(extra="allow")


class TeamAllocationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    allocation_id: int
    role: str | None = None
    allocated_hours: Decimal | float
    start_date: date
    end_date: date | None = None
    resource_id: int
    resource_name: str
    job_title: str | None = None
    department: str | None = None


class BudgetResponse(BaseModel):
    budget_id: int
    category: str
    description: str | None = None
    allocated_amount: Decimal | float | None = None
    spent_amount: Decimal | float | None = None
    currency: str | None = None
    fiscal_year: int | None = None


class DeliverableResponse(BaseModel):
    # Extra allowed so project detail can attach blocked_by / waiting_on.
    model_config = ConfigDict(extra="allow")

    deliverable_id: int
    name: str
    description: str | None = None
    sequence_no: int
    status: str
    display_status: str | None = None
    expected_date: date | None = None
    completed_date: date | None = None
    days_late: int | None = None
    owner_name: str | None = None


class BlockerResponse(BaseModel):
    blocked_by_id: int
    blocked_by_name: str
    blocker_status: str
    dependency_type: str


# ------------------------------------------------------------------
# Deliverable dependencies ("Beta Test waits on First Production Run")
# ------------------------------------------------------------------
class DeliverableDependencyCreateRequest(BaseModel):
    depends_on_id: int
    dependency_type: str = "finish_to_start"
    notes: str | None = None


class DeliverableDependencyResponse(BaseModel):
    deliverable_id: int
    deliverable_name: str
    project_id: int
    project_name: str
    deliverable_status: str
    depends_on_id: int
    depends_on_name: str
    depends_on_project_id: int
    depends_on_project_name: str
    depends_on_status: str
    depends_on_expected_date: date | None = None
    dependency_type: str
    notes: str | None = None
    is_blocking: bool
    is_cross_project: bool


class DependencyChainNode(BaseModel):
    deliverable_id: int
    name: str
    project_id: int
    project_name: str
    status: str
    expected_date: date | None = None
    depth: int
    path: list[int] = []
    is_blocking: bool


class DependencyChainResponse(BaseModel):
    deliverable_id: int
    name: str
    upstream: list[DependencyChainNode] = []
    downstream: list[DependencyChainNode] = []
    blocked: bool


class ProjectLaborSummary(BaseModel):
    duration_weeks: int
    weekly_hours: Decimal | float
    fte_equivalent: float
    hourly_rate: Decimal | float
    weekly_labor_cost: Decimal | float
    projected_labor_cost: Decimal | float


class ProjectFullResponse(BaseModel):
    project: ProjectDetailResponse
    team: list[TeamAllocationResponse]
    budget: list[BudgetResponse]
    deliverables: list[DeliverableResponse]
    blockers: list[BlockerResponse]
    deliverable_dependencies: list[DeliverableDependencyResponse] = []
    labor: ProjectLaborSummary | None = None


class ProjectCreateRequest(BaseModel):
    name: str
    description: str | None = None
    objective: str | None = None
    status: str = "not_started"
    priority: str = "medium"
    start_date: date | None = None
    expected_end_date: date | None = None
    actual_end_date: date | None = None
    sponsor_id: int | None = None
    lead_id: int | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    objective: str | None = None
    status: str | None = None
    priority: str | None = None
    start_date: date | None = None
    expected_end_date: date | None = None
    actual_end_date: date | None = None
    sponsor_id: int | None = None
    lead_id: int | None = None


class OperationResponse(BaseModel):
    message: str


# ------------------------------------------------------------------
# Allocations (resources assigned to a project)
# ------------------------------------------------------------------
class AllocationCreateRequest(BaseModel):
    project_id: int
    resource_id: int
    role: str | None = None
    allocated_hours: Decimal | float = 40
    start_date: date | None = None
    end_date: date | None = None


class AllocationUpdateRequest(BaseModel):
    role: str | None = None
    allocated_hours: Decimal | float | None = None
    start_date: date | None = None
    end_date: date | None = None


class AllocationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    allocation_id: int
    project_id: int
    resource_id: int
    role: str | None = None
    allocated_hours: Decimal | float
    start_date: date
    end_date: date | None = None


# ------------------------------------------------------------------
# Budgets
# ------------------------------------------------------------------
class BudgetCreateRequest(BaseModel):
    project_id: int
    category: str = "other"
    description: str | None = None
    allocated_amount: Decimal | float = 0
    spent_amount: Decimal | float = 0
    currency: str = "USD"
    fiscal_year: int | None = None


class BudgetUpdateRequest(BaseModel):
    category: str | None = None
    description: str | None = None
    allocated_amount: Decimal | float | None = None
    spent_amount: Decimal | float | None = None
    currency: str | None = None
    fiscal_year: int | None = None


class BudgetLineResponse(BudgetResponse):
    project_id: int
    project_name: str | None = None


class LaborLineResponse(BaseModel):
    resource_id: int
    resource_name: str
    job_title: str | None = None
    department: str | None = None
    allocated_hours: Decimal | float
    hourly_rate: Decimal | float
    weekly_cost: Decimal | float
    projected_cost: Decimal | float


class ProjectBudgetResponse(BaseModel):
    project_id: int
    name: str
    status: str
    priority: str
    start_date: date | None = None
    expected_end_date: date | None = None
    budget_allocated: Decimal | float
    budget_spent: Decimal | float
    budget_remaining: Decimal | float
    utilization_pct: float
    team_size: int
    weekly_hours: Decimal | float
    fte_equivalent: float
    duration_weeks: int
    weekly_labor_cost: Decimal | float
    projected_labor_cost: Decimal | float
    labor_vs_budget_pct: float
    over_budget: bool
    labor: list[LaborLineResponse] = []


class BudgetTotalsResponse(BaseModel):
    projects: int
    budget_allocated: Decimal | float
    budget_spent: Decimal | float
    budget_remaining: Decimal | float
    utilization_pct: float
    weekly_hours: Decimal | float
    weekly_labor_cost: Decimal | float
    projected_labor_cost: Decimal | float
    standard_hourly_rate: float
    standard_weekly_hours: float


class BudgetSummaryResponse(BaseModel):
    totals: BudgetTotalsResponse
    projects: list[ProjectBudgetResponse]


# ------------------------------------------------------------------
# Deliverables
# ------------------------------------------------------------------
class DeliverableCreateRequest(BaseModel):
    project_id: int
    name: str
    description: str | None = None
    sequence_no: int | None = None
    status: str = "not_started"
    expected_date: date | None = None
    completed_date: date | None = None
    owner_id: int | None = None


class DeliverableUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    sequence_no: int | None = None
    status: str | None = None
    expected_date: date | None = None
    completed_date: date | None = None
    owner_id: int | None = None


# ------------------------------------------------------------------
# Resources (employee directory)
# ------------------------------------------------------------------
class ResourceResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    resource_id: int
    first_name: str
    last_name: str
    resource_name: str | None = None
    email: str
    job_title: str | None = None
    department: str | None = None
    hourly_rate: Decimal | float | None = None
    weekly_hours: Decimal | float | None = None
    is_active: bool | None = None


class ResourceCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    job_title: str | None = None
    department: str | None = None
    hourly_rate: Decimal | float | None = 100
    annual_salary: Decimal | float | None = None
    weekly_hours: Decimal | float = 40
    hire_date: date | None = None
    is_active: bool = True


class ResourceUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    job_title: str | None = None
    department: str | None = None
    hourly_rate: Decimal | float | None = None
    annual_salary: Decimal | float | None = None
    weekly_hours: Decimal | float | None = None
    hire_date: date | None = None
    is_active: bool | None = None


# ------------------------------------------------------------------
# Users (admin console)
# ------------------------------------------------------------------
class UserResponse(BaseModel):
    user_id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserCreateRequest(BaseModel):
    email: str
    password: str
    role: str = "executive"
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    role: str | None = None
    is_active: bool | None = None


# ------------------------------------------------------------------
# Dashboard
# ------------------------------------------------------------------
class DashboardResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
