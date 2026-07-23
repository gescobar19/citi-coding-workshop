-- ============================================================
-- PROJECT MANAGEMENT - USER SEED DATA
-- ============================================================

INSERT INTO pms.users (email, password, role, is_active)
VALUES
  ('admin@vantagebank.com', 'adminpass123', 'admin', true),
  ('j.whitmore@vantagebank.com', 'demopassword', 'executive', true),
  ('executive@vantagebank.com', 'execpass456', 'executive', true)
ON CONFLICT (email) DO NOTHING;
