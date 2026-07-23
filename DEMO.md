# ACME Inc. Portfolio Portal — Demo Reference

Everything needed to run through the application: URLs, accounts, and what each
screen does.

---

## Links

### Deployed (AWS) — use this to present

| What | URL |
|---|---|
| **Application** | https://d4c6hp21gbguk.cloudfront.net |
| **API docs (Swagger)** | https://d4c6hp21gbguk.cloudfront.net/api/fastapi-service/docs |
| API docs (ReDoc) | https://d4c6hp21gbguk.cloudfront.net/api/fastapi-service/redoc |
| API base | https://d4c6hp21gbguk.cloudfront.net/api/fastapi-service |
| Health check | https://d4c6hp21gbguk.cloudfront.net/api/fastapi-service/health |
| Lambda direct | https://dc2h3hcfte65gulcmfywavcw5m0ngmtz.lambda-url.us-east-1.on.aws/ |

Served from CloudFront, backed by AWS Lambda and Aurora PostgreSQL. Reachable
from any machine.

### Local development

| What | URL | Started by |
|---|---|---|
| Frontend | http://localhost:3000 | `./bin/start-dev.sh` |
| API (via CORS proxy) | http://localhost:3001/api/fastapi-service | `./bin/start-dev.sh` |
| Frontend (direct Vite) | http://localhost:5173 | `npm run dev` |
| API (direct uvicorn) | http://localhost:8000 | `uvicorn app.main:app --reload` |
| API docs (local) | http://localhost:8000/docs | as above |

### Source

| What | URL |
|---|---|
| Repository | https://github.com/gescobar19/citi-coding-workshop |

---

## Accounts

| Email | Password | Role | Can do |
|---|---|---|---|
| `admin@acme.com` | `adminpass123` | **Administrator** | Everything — create, edit, delete, manage users |
| `executive@acme.com` | `execpass456` | Executive | Read-only |
| `j.whitmore@acme.com` | `demopassword` | Executive | Read-only |

The login screen asks you to pick a role alongside the credentials. The choice
is a filter, not a grant — the account's own role decides what the portal
allows, and a mismatch is rejected.

**Worth demonstrating:** sign in as the executive and try to edit something.
Write buttons are hidden, and the API refuses the request independently with a
403 — the UI hides what you cannot do, and the server enforces it regardless.

---

## Screens

### Dashboard

The landing page. Six panels, deliberately — an earlier version had fourteen,
most of which repeated a figure shown two panels away or duplicated a page that
already exists in the navigation.

1. **Four exception cards** — projects at risk, late deliverables, people over
   capacity, budget remaining. Each is a number that might need action, not an
   inventory count.
2. **Needs attention** — a single ranked queue merging at-risk projects, blocked
   deliverables and over-allocated people, worst first, each with an owner and
   due date. Severity is scored server-side from days overdue, budget overrun,
   blocking dependencies and priority. Rows click through to the project.
3. **Portfolio at a glance** — status mix, delivery progress, weekly labour cost.
4. **Budget by project** — allocated vs spent, live projects, largest first.
5. **Deliverables by project** — done / open / late, most-slipped first.
6. **Next milestones** — nearest deliverables and who owns them.

*The point to make:* three different tables — projects, deliverables, people —
but one question for whoever is reading: what do I deal with first?

### Projects

Card grid, one per project, showing status, priority, progress and budget.

- **Search** by name, description or ID
- **Filter** by status: all / not started / in progress / late / finished
- **Paginated**, 5–100 per page
- **Create** a project (admin)

"Late" is derived rather than stored — a project counts as late when it has
overdue deliverables, so it is computed client-side from the full set.

### Project detail

Four tabs:

| Tab | Contents |
|---|---|
| **Overview** | Dates, sponsor, lead, status, description, objective |
| **Deliverables** | Milestone timeline in sequence, owners, due dates, dependencies |
| **Resources** | Assigned team, hours per week, role, weekly cost |
| **Budget** | Line items by category, allocated vs spent |

A banner appears at the top when the project is blocked by an unfinished
dependency. Admins can add, edit and delete deliverables, allocations, budget
lines and dependencies from within the tabs.

### Resources

Every employee with their capacity and current load.

- Four headline cards: over-allocated, within capacity, unassigned, total weekly cost
- Per employee: capacity, allocated hours, available hours, weekly cost, project
  count, a utilisation bar, and a status chip
- **Search** by name, department or job title
- **Paginated**
- **Create / edit / delete** employees (admin)

Over-allocation is computed in the database — assigned hours across all projects
exceeding the employee's weekly capacity.

### Budget

Money per project, with a portfolio total row that always reflects everything
rather than just the visible page.

- Allocated, spent, remaining and utilisation per project
- **Expand a row** for the employee-level cost breakdown
- **Search**, **paginated**
- Add and edit budget lines (admin)

Labour is charged at a standard hourly rate on a standard week. Every money
figure derives from one costing module, so the budget page and the dashboard
cannot disagree.

### Administration *(admin only)*

User account management — create accounts, change roles, reset passwords,
delete users. Three cards summarise administrators, executives and total
accounts. Executives never see this page, and the API blocks them from the
endpoints behind it.

---

## Suggested walkthrough

1. Open the CloudFront URL — a real deployment, not localhost
2. Sign in as **admin**
3. **Dashboard** — explain the six panels and why the ranked queue replaced three
   separate lists
4. **Needs attention** — click the top item, land on the project
5. **Project detail** — walk the four tabs; show a cross-project dependency
6. **Resources** — show over-allocation, then search and page through
7. **Create something** — a project or an employee, to prove writes work
8. Sign out, sign in as **executive** — write controls are gone
9. Open `/api/fastapi-service/docs` — live Swagger against the deployed backend
10. `F12` → Network — requests go to CloudFront, not localhost

---

## Architecture in one line

Browser → CloudFront → (S3 for the app, Lambda for `/api/fastapi-service/*`) →
Aurora PostgreSQL. One origin, so no CORS layer. Terraform provisions all of it;
shell scripts deploy it.
