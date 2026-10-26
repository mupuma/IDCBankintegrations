-- Portal MySQL only. Do not execute on Sage SQL Server.
CREATE TABLE IF NOT EXISTS bank_integrations (
  bank_code VARCHAR(20) NOT NULL PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  adapter VARCHAR(32) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
-- Missing built-in registrations are inserted by the portal without updating
-- existing rows. Deactivated registrations stay deactivated across restarts.
