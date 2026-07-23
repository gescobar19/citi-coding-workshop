-- ============================================================
-- SEED DATA - Project Management
-- Run AFTER project_management_schema.sql
-- ============================================================

SET search_path TO pms, public;

-- ------------------------------------------------------------
-- 1. RESOURCES
-- ------------------------------------------------------------
INSERT INTO resources (first_name, last_name, email, job_title, department, hourly_rate, annual_salary, weekly_hours, hire_date) VALUES
    ('Sarah',  'Chen',      'sarah.chen@company.com',      'VP Operations',        'Operations',  145.00, 290000.00, 40, '2019-03-15'),
    ('Marcus', 'Johnson',   'marcus.johnson@company.com',  'Program Director',     'Strategy',    120.00, 240000.00, 40, '2020-06-01'),
    ('Priya',  'Patel',     'priya.patel@company.com',     'Finance Manager',      'Finance',      95.00, 190000.00, 40, '2021-01-20'),
    ('David',  'Kim',       'david.kim@company.com',       'Senior Engineer',      'Engineering', 110.00, 220000.00, 40, '2018-09-10'),
    ('Elena',  'Rodriguez', 'elena.rodriguez@company.com', 'Marketing Lead',       'Marketing',    85.00, 170000.00, 40, '2022-02-14'),
    ('James',  'Wright',    'james.wright@company.com',    'Product Manager',      'Product',      90.00, 180000.00, 40, '2020-11-05'),
    ('Aisha',  'Okonkwo',   'aisha.okonkwo@company.com',   'Data Analyst',         'Analytics',    75.00, 150000.00, 40, '2023-04-01'),
    ('Tom',    'Bauer',     'tom.bauer@company.com',       'Operations Analyst',   'Operations',   70.00, 140000.00, 40, '2021-08-22'),
    ('Nina',   'Volkov',    'nina.volkov@company.com',     'Compliance Officer',   'Legal',       105.00, 210000.00, 40, '2019-07-30'),
    ('Raj',    'Mehta',     'raj.mehta@company.com',       'Infrastructure Lead',  'Engineering', 115.00, 230000.00, 40, '2017-05-12');

-- ------------------------------------------------------------
-- 2. PROJECTS
--    Mix of statuses; some dates in the past to trigger 'late'
-- ------------------------------------------------------------
INSERT INTO projects (name, description, objective, status, priority, start_date, expected_end_date, actual_end_date, sponsor_id, lead_id) VALUES
    ('Roll Out New Credit Card',
     'Design, produce and launch the new rewards credit card product.',
     'Issue 100,000 new cards within the first year of launch.',
     'in_progress', 'critical', '2026-01-15', '2026-11-30', NULL, 1, 6),

    ('Print New Cards',
     'Contract card manufacturer and produce physical card stock.',
     'Deliver 150,000 printed cards to distribution centers.',
     'in_progress', 'high', '2026-02-01', '2026-08-31', NULL, 1, 4),

    ('Deploy New ATMs',
     'Install next-generation ATMs supporting the new card chip standard.',
     'Deploy 400 ATMs across priority branches.',
     'not_started', 'high', '2026-09-01', '2027-04-30', NULL, 1, 10),

    ('Change Customer Onboarding',
     'Redesign the end-to-end customer onboarding experience.',
     'Cut average onboarding time from 12 days to 3.',
     'in_progress', 'high', '2025-11-01', '2026-06-30', NULL, 2, 5),

    ('Finance System Consolidation',
     'Consolidate three regional finance systems onto one platform.',
     'Reduce monthly close from 10 days to 4.',
     'not_started', 'medium', '2026-10-01', '2027-06-30', NULL, 3, 3),

    ('Data Warehouse Project',
     'Build a centralized analytics data warehouse.',
     'Enable self-serve reporting across all departments.',
     'finished', 'medium', '2025-04-01', '2025-12-15', '2025-12-10', 1, 7);

-- ------------------------------------------------------------
-- 3. DEPENDENCIES
--    ATMs need cards printed first; card rollout needs printing;
--    onboarding change gates the card rollout launch.
-- ------------------------------------------------------------
INSERT INTO project_dependencies (project_id, depends_on_id, dependency_type, notes) VALUES
    (3, 2, 'finish_to_start', 'ATMs cannot be certified until new card stock exists for testing.'),
    (1, 2, 'finish_to_start', 'Cannot launch the card product before physical cards are printed.'),
    (1, 4, 'start_to_start',  'Onboarding redesign must be underway to support new-card applicants.'),
    (5, 6, 'finish_to_start', 'Finance consolidation depends on the warehouse being live.');

-- ------------------------------------------------------------
-- 4. ALLOCATIONS
--    NOTE: David Kim (4) is deliberately over-allocated:
--    25 + 20 = 45 hours against a 40-hour week.
-- ------------------------------------------------------------
INSERT INTO allocations (project_id, resource_id, role, allocated_hours, start_date, end_date) VALUES
    (1,  6, 'Project Lead',         40.00, '2026-01-15', NULL),
    (1,  5, 'Marketing Lead',       20.00, '2026-02-01', NULL),
    (1,  9, 'Compliance Reviewer',  10.00, '2026-01-15', NULL),
    (2,  4, 'Engineering Lead',     25.00, '2026-02-01', NULL),
    (2,  8, 'Vendor Coordinator',   30.00, '2026-02-01', NULL),
    (3, 10, 'Infrastructure Lead',  35.00, '2026-09-01', NULL),
    (3,  4, 'Systems Engineer',     20.00, '2026-09-01', NULL),
    (4,  5, 'Experience Lead',      20.00, '2025-11-01', NULL),
    (4,  7, 'Data Analyst',         25.00, '2025-11-01', NULL),
    (4,  8, 'Process Analyst',      10.00, '2025-11-01', NULL),
    (5,  3, 'Finance Lead',         30.00, '2026-10-01', NULL),
    (6,  7, 'Lead Analyst',         40.00, '2025-04-01', '2025-12-15');

-- ------------------------------------------------------------
-- 5. BUDGETS
-- ------------------------------------------------------------
INSERT INTO budgets (project_id, category, description, allocated_amount, spent_amount, fiscal_year) VALUES
    (1, 'personnel',   'Product, marketing and compliance staff', 850000.00, 310000.00, 2026),
    (1, 'marketing',   'Launch campaign and creative',            400000.00,  85000.00, 2026),
    (1, 'legal',       'Regulatory review and disclosures',       120000.00,  62000.00, 2026),
    (1, 'contingency', 'Reserve',                                 150000.00,       0.00, 2026),

    (2, 'vendor',      'Card manufacturer contract',              600000.00, 240000.00, 2026),
    (2, 'personnel',   'Engineering and coordination',            180000.00,  70000.00, 2026),
    (2, 'hardware',    'Card stock and secure chips',             320000.00, 145000.00, 2026),

    (3, 'hardware',    '400 ATM units',                          2400000.00,      0.00, 2027),
    (3, 'vendor',      'Installation and certification',          500000.00,      0.00, 2027),
    (3, 'personnel',   'Infrastructure team',                     260000.00,      0.00, 2027),

    (4, 'personnel',   'Design and analytics staff',              340000.00, 195000.00, 2026),
    (4, 'software',    'Onboarding platform licenses',            110000.00,  78000.00, 2026),
    (4, 'training',    'Staff training on new process',            45000.00,  12000.00, 2026),

    (5, 'software',    'Finance platform licensing',              300000.00,      0.00, 2027),
    (5, 'vendor',      'Implementation partner',                  250000.00,      0.00, 2027),

    (6, 'personnel',   'Analytics team',                          180000.00, 178000.00, 2025),
    (6, 'software',    'Warehouse and BI tooling',                120000.00, 115000.00, 2025);

-- ------------------------------------------------------------
-- 6. DELIVERABLES (ordered milestones)
--    Several past-due rows exercise the derived 'late' status.
-- ------------------------------------------------------------
INSERT INTO deliverables (project_id, name, description, sequence_no, status, expected_date, completed_date, owner_id) VALUES
    -- Roll Out New Credit Card
    (1, 'Product Design Approved',   'Card design, rewards structure and pricing signed off.', 1, 'finished',    '2026-03-31', '2026-03-25', 6),
    (1, 'Regulatory Filing',         'Submit product disclosures to regulator.',               2, 'finished',    '2026-05-31', '2026-05-28', 9),
    (1, 'Beta Test',                 'Limited issue to 500 internal cardholders.',             3, 'in_progress', '2026-06-30', NULL,         6),
    (1, 'Public Launch',             'Full market availability.',                              4, 'not_started', '2026-11-30', NULL,         5),

    -- Print New Cards
    (2, 'Vendor Contract Signed',    'Manufacturer selected and contracted.',                  1, 'finished',    '2026-03-15', '2026-03-12', 8),
    (2, 'First Production Run',      'Initial 20,000 cards produced and QA passed.',           2, 'in_progress', '2026-06-15', NULL,         4),
    (2, 'Full Volume Delivery',      '150,000 cards delivered to distribution.',               3, 'not_started', '2026-08-31', NULL,         4),

    -- Deploy New ATMs
    (3, 'Site Survey',               'Assess 400 branch locations for installation.',          1, 'not_started', '2026-10-31', NULL,        10),
    (3, 'Pilot Deployment',          'Install and certify 20 ATMs.',                           2, 'not_started', '2027-01-31', NULL,        10),
    (3, 'Full Rollout',              'Remaining 380 units deployed.',                          3, 'not_started', '2027-04-30', NULL,        10),

    -- Change Customer Onboarding
    (4, 'Update Training Guide',     'Rewrite staff onboarding documentation.',                1, 'finished',    '2026-01-31', '2026-01-28', 8),
    (4, 'Process Redesign Sign-off', 'New onboarding flow approved by Operations.',            2, 'in_progress', '2026-04-30', NULL,         5),
    (4, 'Go Live',                   'Roll out new onboarding to production.',                 3, 'not_started', '2026-06-30', NULL,         5),

    -- Finance System Consolidation
    (5, 'Vendor Selection',          'Choose finance platform vendor.',                        1, 'not_started', '2026-12-31', NULL,         3),
    (5, 'Migration Complete',        'All three regions on the single platform.',              2, 'not_started', '2027-06-30', NULL,         3),

    -- Data Warehouse Project (finished)
    (6, 'Warehouse Go-Live',         'Production data warehouse deployed.',                    1, 'finished',    '2025-11-30', '2025-11-28', 7),
    (6, 'Self-Serve Dashboards',     'Department-level BI dashboards released.',               2, 'finished',    '2025-12-15', '2025-12-12', 7);

-- ------------------------------------------------------------
-- 3B. DELIVERABLE DEPENDENCIES
--     Sequential chains inside each project, plus cross-project
--     links (beta test needs printed cards, ATMs need cards, ...).
--     NOTE: this block must run after section 7 (DELIVERABLES);
--     it is appended at the end of this file.
-- ------------------------------------------------------------

-- Sequential chains inside each project, plus the cross-project links that
-- mirror the project-level dependencies at deliverable granularity.
INSERT INTO deliverable_dependencies (deliverable_id, depends_on_id, dependency_type, notes) VALUES
    -- Roll Out New Credit Card
    (2,  1,  'finish_to_start', 'Regulatory filing needs the approved product design.'),
    (3,  2,  'finish_to_start', 'Beta test cannot start before the regulator signs off.'),
    (3,  6,  'finish_to_start', 'Beta test needs physical cards from the first production run.'),
    (4,  3,  'finish_to_start', 'Public launch follows a successful beta.'),
    (4,  7,  'finish_to_start', 'Launch needs full card volume delivered.'),
    (4,  13, 'finish_to_start', 'New onboarding must be live to handle card applicants.'),
    -- Print New Cards
    (6,  5,  'finish_to_start', 'Production cannot start before the vendor contract is signed.'),
    (7,  6,  'finish_to_start', 'Full volume follows the first production run.'),
    -- Deploy New ATMs
    (9,  8,  'finish_to_start', 'Pilot sites are chosen from the site survey.'),
    (9,  6,  'finish_to_start', 'ATM pilot needs new chip cards to certify against.'),
    (10, 9,  'finish_to_start', 'Full rollout follows a successful pilot.'),
    -- Change Customer Onboarding
    (12, 11, 'finish_to_start', 'Process redesign builds on the updated training guide.'),
    (13, 12, 'finish_to_start', 'Go live requires the redesign sign-off.'),
    -- Finance System Consolidation
    (14, 16, 'finish_to_start', 'Vendor selection depends on warehouse reporting being live.'),
    (15, 14, 'finish_to_start', 'Migration starts once the vendor is selected.'),
    -- Data Warehouse Project
    (17, 16, 'finish_to_start', 'Dashboards are built on the live warehouse.')
ON CONFLICT (deliverable_id, depends_on_id) DO NOTHING;
