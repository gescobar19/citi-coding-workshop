-- ============================================================
-- PROJECT MANAGEMENT - USER SEED DATA
-- ============================================================

INSERT INTO pms.users (email, password, role, is_active)
VALUES
  ('admin@acme.com', 'adminpass123', 'admin', true),
  ('j.whitmore@acme.com', 'demopassword', 'executive', true),
  ('executive@acme.com', 'execpass456', 'executive', true)
ON CONFLICT (email) DO NOTHING;
