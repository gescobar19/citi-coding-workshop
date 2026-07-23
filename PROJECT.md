# ACME Inc. — Project Portfolio Portal

A project and team management portal for ACME Inc. It answers the questions a
portfolio administrator has to act on: which projects are slipping, who is over
capacity, what is blocked behind something else, and where the budget has gone.

React + Material UI on the front, FastAPI on AWS Lambda behind it, PostgreSQL
underneath.

> Workshop scaffolding, setup guides and the exercise brief live in
> [README.md](./README.md) and [docs/](./docs/). This file documents the
> application built on top of them.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Running it locally](#running-it-locally)
- [Deploying](#deploying)
- [Testing](#testing)
- [API](#api)
- [Design decisions](#design-decisions)
- [Known gaps](#known-gaps)

---

## What it does

| Area | Capability |
|---|---|
| **Projects** | Full CRUD, status and priority, sponsor and lead, start/end dates, cross-project dependencies |
| **Deliverables** | Ordered milestones per project, owners, expected vs completed dates, deliverable-to-deliverable dependencies that may cross project boundaries |
| **Resources** | Employees, departments, weekly capacity, allocation to projects in hours, over-allocation detection |
| **Budgets** | Line items per project by category, allocated vs spent, roll-ups per project and portfolio |
| **Dashboard** | Portfolio health in one view — see [below](#the-dashboard) |
| **Administration** | User accounts and role assignment, admin-only |
| **Access control** | Two roles: administrators write, executives are read-only. Enforced server-side on every mutating endpoint |

### The dashboard

The landing page is deliberately short. An earlier version carried fourteen
panels; most either repeated a number shown two panels away or duplicated a
page that already exists in the navigation. It is now six:

1. **Four exception cards** — projects at risk, late deliverables, people over
   capacity, budget remaining. Each is a number you might have to act on, not
   an inventory count.
2. **Needs attention** — one ranked queue merging at-risk projects, blocked
   deliverables and over-allocated people, worst first, each with an owner and
   a due date. Three different tables, but one job for the reader: *what do I
   deal with first?*
3. **Portfolio at a glance** — status mix, delivery progress, labour run rate.
4. **Budget by project** — allocated vs spent, live projects, largest first.
5. **Deliverables by project** — done / open / late, most-slipped first.
6. **Next milestones** — nearest deliverables and who owns them.

---

## Architecture

```
Browser
   │
   ├── CloudFront ──► S3 (static React build)
   │
   └── /api/fastapi-service/* ──► Lambda (FastAPI + Mangum) ──► PostgreSQL
                                                                (Aurora in cloud)
```

Locally the same Lambda runs under LocalStack, with a small CORS proxy on
`:3001` standing in for CloudFront's path routing.

### Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Material UI 7, Recharts, React Router, React Responsive, Vite |
| Backend | Python 3.13, FastAPI, Mangum (Lambda adapter), psycopg 3 |
| Database | PostgreSQL 17 / Aurora Serverless v2 |
| Infrastructure | Terraform — Lambda, S3, CloudFront, RDS, SQS dead-letter queues |
| Local cloud | LocalStack |

### Layout

```
backend/fastapi-service/
  app/
    main.py          FastAPI app and router registration
    db.py            Connection pool; switches SSL mode on IS_LOCAL
    security.py      Role checks (require_admin dependency)
    costing.py       Labour costing rules, shared by every money figure
    models.py        Pydantic request/response models
    routers/         One module per resource
  tests/             29 pytest tests
  function.py        Lambda entrypoint

backend/project-management-service/
  *.sql              Schema, views, seed data

frontend/src/
  pages/             One per route (7)
  components/        Shared UI (23)
  services/          API client, auth context, theme, formatters

infra/               Terraform
bin/                 Deploy and dev scripts
```

---

## Running it locally

Two modes. The first is faster for iteration; the second exercises the real
Lambda packaging.

### Direct (recommended while developing)

```bash
# Backend — http://localhost:8000
cd backend/fastapi-service
python3.13 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend — http://localhost:5173
cd frontend
npm install && npm run dev
```

### Full stack on LocalStack

```bash
./bin/start-dev.sh
```

Brings up PostgreSQL, LocalStack, deploys the Lambda, starts the CORS proxy on
`:3001` and the frontend on `:3000`.

### Database

```bash
python3 init_database.py     # schema, views, seed data
python3 verify_database.py   # row counts and sanity checks
```

Both target the `postgres` database — the same one the Lambda reads, so local
work and the deployed function never diverge.

### Sign in

| Email | Password | Role |
|---|---|---|
| `admin@acme.com` | `adminpass123` | Administrator |
| `executive@acme.com` | `execpass456` | Executive (read-only) |

---

## Deploying

```bash
./bin/deploy-backend.sh aws     # Lambda + Aurora
./bin/generate-env.sh           # writes frontend/.env.local from Terraform outputs
./bin/deploy-frontend.sh aws    # build + sync to S3, invalidate CloudFront
```

Terraform installs Python dependencies from `requirements.txt` at package time,
so the vendored packages `start-dev.sh` drops into the service folder are build
artefacts — git-ignored, never committed.

In the cloud, CloudFront routes `/api/fastapi-service*` to the Lambda, so the
frontend calls its own origin and there is no CORS layer to configure.

---

## Testing

```bash
cd backend/fastapi-service
.venv/bin/python -m pytest tests/ -q     # 29 tests
```

Covers CRUD across every resource, dashboard aggregation, validation failures,
and role enforcement on mutating endpoints.

```bash
cd frontend && npm run build             # compile check
```

---

## API

40 endpoints. Interactive documentation is generated by FastAPI:

- Swagger UI — `/docs`
- ReDoc — `/redoc`
- OpenAPI schema — `/openapi.json`

| Resource | Endpoints |
|---|---|
| `/projects` | 5 |
| `/deliverables` | 9 |
| `/resources` | 6 |
| `/budgets` | 5 |
| `/allocations` | 4 |
| `/users` | 4 |
| `/dashboard/summary` | 1 |
| `/auth/login` | 1 |
| `/health` | 1 |

`current-api-reference.txt` holds a fuller written reference.

---

## Design decisions

**Derived state lives in SQL views, not application code.** Seven views
(`v_project_summary`, `v_resource_load`, `v_blocked_deliverables` and others)
compute lateness, load and blocking. Keeping them in the database means the
dashboard, the project pages and the budget page cannot disagree about whether
a deliverable is late — there is one definition and every caller reads it.

**One costing module.** Labour is charged at a standard hourly rate on a
standard week. Every money figure in the API derives from `app/costing.py`, and
the frontend mirrors the same constants in `services/format.js`, so the budget
page and the dashboard always agree.

**The dashboard ranks rather than lists.** Problems arrive from three tables —
projects, deliverables, people. Rather than three panels the reader has to
triage, the API scores each signal (days overdue, budget overrun, blocking
dependencies, priority) and returns a single ordered queue. Severity weighting
lives in the backend, next to the data it is computed from.

**Cross-project dependencies are first-class.** A deliverable may depend on one
in another project. `v_blocked_deliverables` resolves both ends, flags the
cross-project cases, and the UI surfaces which team owns the blocker — usually
the thing you need to know to unblock it.

**Read-heavy by design.** The dashboard is one endpoint, not eight. It answers
in a single round trip rather than making the browser assemble a portfolio view
from parts.

**One database across environments.** Local development and the deployed Lambda
read the same database name, and `db.py` switches only SSL mode via `IS_LOCAL`
(Aurora requires encryption; the local server offers no certificate). An earlier
split meant a change applied locally was invisible to the deployed function.

---

## Known gaps

Stated plainly rather than left to be discovered:

- **No token layer.** Login returns the user row and the client echoes identity
  back via `X-User-Id` / `X-User-Role`. Authorization is enforced server-side,
  but authentication is not cryptographic — a crafted request can assert a role.
  JWT and password hashing were scoped out of this exercise; both would be the
  first work in a follow-up.
- **Passwords are stored in plaintext.** Same scope decision.
- **No frontend test suite.** Backend logic is covered; React components are
  not. Vitest with React Testing Library would be the route.
- **Aurora seeding is manual.** The cloud database is not publicly reachable, so
  loading schema and seed data needs a path from inside the VPC.
- **Single JS bundle**, ~1.1 MB before gzip. Route-level code splitting would
  cut first paint.
