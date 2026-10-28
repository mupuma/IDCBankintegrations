-- Portal MySQL only. Never run against Sage SQL Server.
CREATE TABLE IF NOT EXISTS bank_agent_profiles (
  bank_code VARCHAR(20) NOT NULL PRIMARY KEY,
  agent_url VARCHAR(2048) NOT NULL,
  manifest_json LONGTEXT NOT NULL,
  encrypted_token LONGTEXT NOT NULL,
  encrypted_configuration LONGTEXT NULL,
  revision INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
