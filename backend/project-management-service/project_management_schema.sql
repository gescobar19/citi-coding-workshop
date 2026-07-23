-- ============================================================
-- PROJECT MANAGEMENT SCHEMA
-- PostgreSQL
-- ============================================================

CREATE SCHEMA IF NOT EXISTS pms;
SET search_path TO pms, public;

-- ============================================================
-- 1. RESOURCES (people — FTEs assigned to projects)
-- ============================================================
CREATE TABLE resources (
    resource_id    SERIAL PRIMARY KEY,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    job_title      VARCHAR(100),
    department     VARCHAR(100),
    hourly_rate    NUMERIC(10,2) CHECK (hourly_rate >= 0),
    annual_salary  NUMERIC(14,2) CHECK (annual_salary >= 0),
    weekly_hours   NUMERIC(5,2) NOT NULL DEFAULT 40 CHECK (weekly_hours > 0),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    hire_date      DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 1B. USERS (authentication and role management)
-- ============================================================
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password       VARCHAR(255) NOT NULL,
    role           VARCHAR(50) NOT NULL DEFAULT 'executive'
                   CHECK (role IN ('admin','executive')),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. PROJECTS (e.g. "Roll out new credit card")
-- ============================================================
CREATE TABLE projects (
    project_id     SERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    objective         TEXT,
    status            VARCHAR(50) NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started','in_progress','finished','cancelled')),
    priority          VARCHAR(20) NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high','critical')),
    start_date        DATE,
    expected_end_date DATE,
    actual_end_date   DATE,
    sponsor_id        INT REFERENCES resources(resource_id) ON DELETE SET NULL,
    lead_id           INT REFERENCES resources(resource_id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expected_end_date IS NULL OR start_date IS NULL
           OR expected_end_date >= start_date),
    CHECK (status <> 'finished' OR actual_end_date IS NOT NULL)
);

-- ============================================================
-- 3. PROJECT DEPENDENCIES
--    "New ATMs" depends on "Print new cards"
-- ============================================================
CREATE TABLE project_dependencies (
    project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    depends_on_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    dependency_type VARCHAR(30) NOT NULL DEFAULT 'finish_to_start'
                    CHECK (dependency_type IN ('finish_to_start','start_to_start')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, depends_on_id),
    CHECK (project_id <> depends_on_id)
);

-- ============================================================
-- 4. ALLOCATIONS (resources assigned to projects, in hours)
-- ============================================================
CREATE TABLE allocations (
    allocation_id   SERIAL PRIMARY KEY,
    project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    resource_id     INT NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    role            VARCHAR(100),
    allocated_hours NUMERIC(5,2) NOT NULL CHECK (allocated_hours > 0 AND allocated_hours <= 40),
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, resource_id, start_date),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ============================================================
-- 5. BUDGETS (line items per project)
-- ============================================================
CREATE TABLE budgets (
    budget_id        SERIAL PRIMARY KEY,
    project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    category         VARCHAR(100) NOT NULL
                     CHECK (category IN ('personnel','software','hardware','vendor',
                                         'legal','marketing','training','contingency','other')),
    description      TEXT,
    allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
    spent_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
    currency         CHAR(3) NOT NULL DEFAULT 'USD',
    fiscal_year      INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. DELIVERABLES (ordered milestones within an project)
-- ============================================================
CREATE TABLE deliverables (
    deliverable_id SERIAL PRIMARY KEY,
    project_id  INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    sequence_no    INT NOT NULL CHECK (sequence_no > 0),
    status         VARCHAR(50) NOT NULL DEFAULT 'not_started'
                   CHECK (status IN ('not_started','in_progress','finished','cancelled')),
    expected_date  DATE,
    completed_date DATE,
    owner_id       INT REFERENCES resources(resource_id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, sequence_no),
    CHECK (status <> 'finished' OR completed_date IS NOT NULL)
);

-- ============================================================
-- 6B. DELIVERABLE DEPENDENCIES
--     "Beta Test cannot start until the First Production Run
--     is finished." Dependencies may cross projects.
-- ============================================================
CREATE TABLE deliverable_dependencies (
    deliverable_id  INT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
    depends_on_id   INT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
    dependency_type VARCHAR(30) NOT NULL DEFAULT 'finish_to_start'
                    CHECK (dependency_type IN ('finish_to_start','start_to_start')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (deliverable_id, depends_on_id),
    CHECK (deliverable_id <> depends_on_id)
);

-- ============================================================
-- 7. TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_deliverables_updated_at
    BEFORE UPDATE ON deliverables
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. INDEXES
-- ============================================================
CREATE INDEX idx_projects_status      ON projects(status);
CREATE INDEX idx_projects_lead        ON projects(lead_id);
CREATE INDEX idx_allocations_resource    ON allocations(resource_id);
CREATE INDEX idx_allocations_project  ON allocations(project_id);
CREATE INDEX idx_budgets_project      ON budgets(project_id);
CREATE INDEX idx_deliverables_project ON deliverables(project_id, sequence_no);
CREATE INDEX idx_deliverables_expected   ON deliverables(expected_date)
    WHERE status NOT IN ('finished','cancelled');
CREATE INDEX idx_dependencies_depends    ON project_dependencies(depends_on_id);
CREATE INDEX idx_deliverable_deps_depends ON deliverable_dependencies(depends_on_id);

-- ============================================================
-- 9. VIEWS
-- ============================================================

-- Deliverables with derived 'late' status
CREATE VIEW v_deliverables AS
SELECT d.*,
       CASE
         WHEN d.status = 'finished'  THEN 'finished'
         WHEN d.status = 'cancelled' THEN 'cancelled'
         WHEN d.expected_date IS NOT NULL
              AND d.expected_date < CURRENT_DATE THEN 'late'
         ELSE d.status
       END AS display_status,
       CASE WHEN d.status NOT IN ('finished','cancelled')
                 AND d.expected_date < CURRENT_DATE
            THEN CURRENT_DATE - d.expected_date END AS days_late,
       r.first_name || ' ' || r.last_name AS owner_name
FROM deliverables d
LEFT JOIN resources r ON r.resource_id = d.owner_id;

-- Projects with derived 'late' status
CREATE VIEW v_projects AS
SELECT i.*,
       CASE
         WHEN i.status = 'finished'  THEN 'finished'
         WHEN i.status = 'cancelled' THEN 'cancelled'
         WHEN i.expected_end_date IS NOT NULL
              AND i.expected_end_date < CURRENT_DATE THEN 'late'
         ELSE i.status
       END AS display_status
FROM projects i;

-- Resource workload and over-allocation flag
CREATE VIEW v_resource_load AS
SELECT r.resource_id,
       r.first_name || ' ' || r.last_name AS resource_name,
       r.department,
       r.weekly_hours,
       COALESCE(SUM(a.allocated_hours), 0) AS allocated_hours,
       r.weekly_hours - COALESCE(SUM(a.allocated_hours), 0) AS available_hours,
       COALESCE(SUM(a.allocated_hours), 0) > r.weekly_hours AS is_over_allocated
FROM resources r
LEFT JOIN allocations a
       ON a.resource_id = r.resource_id
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
WHERE r.is_active
GROUP BY r.resource_id, r.first_name, r.last_name, r.department, r.weekly_hours;

-- Landing page: one row per project
CREATE VIEW v_project_summary AS
SELECT i.project_id,
       i.name,
       i.status,
       i.priority,
       i.start_date,
       i.expected_end_date,
       s.first_name || ' ' || s.last_name AS sponsor,
       l.first_name || ' ' || l.last_name AS lead,
       (SELECT COUNT(*) FROM allocations a
         WHERE a.project_id = i.project_id) AS team_size,
       (SELECT COALESCE(SUM(a.allocated_hours),0) FROM allocations a
         WHERE a.project_id = i.project_id) AS total_hours,
       (SELECT COALESCE(SUM(b.allocated_amount),0) FROM budgets b
         WHERE b.project_id = i.project_id) AS budget_allocated,
       (SELECT COALESCE(SUM(b.spent_amount),0) FROM budgets b
         WHERE b.project_id = i.project_id) AS budget_spent,
       (SELECT COUNT(*) FROM deliverables d
         WHERE d.project_id = i.project_id) AS deliverables_total,
       (SELECT COUNT(*) FROM deliverables d
         WHERE d.project_id = i.project_id AND d.status = 'finished') AS deliverables_done,
       EXISTS (SELECT 1 FROM deliverables d
                WHERE d.project_id = i.project_id
                  AND d.status NOT IN ('finished','cancelled')
                  AND d.expected_date < CURRENT_DATE) AS has_late_deliverables
FROM projects i
LEFT JOIN resources s ON s.resource_id = i.sponsor_id
LEFT JOIN resources l ON l.resource_id = i.lead_id;

-- Every deliverable dependency edge, with both ends resolved.
-- is_blocking marks the ones whose predecessor is not finished yet.
CREATE VIEW v_deliverable_dependencies AS
SELECT dd.deliverable_id,
       d.name                AS deliverable_name,
       d.project_id,
       p.name                AS project_name,
       d.status              AS deliverable_status,
       dd.depends_on_id,
       b.name                AS depends_on_name,
       b.project_id          AS depends_on_project_id,
       bp.name               AS depends_on_project_name,
       b.status              AS depends_on_status,
       b.expected_date       AS depends_on_expected_date,
       dd.dependency_type,
       dd.notes,
       b.status NOT IN ('finished','cancelled') AS is_blocking,
       d.project_id <> b.project_id             AS is_cross_project
FROM deliverable_dependencies dd
JOIN deliverables d  ON d.deliverable_id  = dd.deliverable_id
JOIN projects p      ON p.project_id      = d.project_id
JOIN deliverables b  ON b.deliverable_id  = dd.depends_on_id
JOIN projects bp     ON bp.project_id     = b.project_id;

-- Only the edges holding work up right now.
CREATE VIEW v_blocked_deliverables AS
SELECT * FROM v_deliverable_dependencies
WHERE is_blocking
  AND deliverable_status NOT IN ('finished','cancelled');

-- Projects blocked by unfinished dependencies
CREATE VIEW v_blocked_projects AS
SELECT i.project_id,
       i.name,
       dep.project_id AS blocked_by_id,
       dep.name          AS blocked_by_name,
       dep.status        AS blocker_status,
       d.dependency_type
FROM project_dependencies d
JOIN projects i   ON i.project_id = d.project_id
JOIN projects dep ON dep.project_id = d.depends_on_id
WHERE dep.status <> 'finished';