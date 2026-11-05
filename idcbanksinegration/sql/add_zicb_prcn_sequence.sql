-- Apply before deploying when DB_SYNC=false. The application uses Africa/Johannesburg years.
CREATE TABLE IF NOT EXISTS zicb_prcn_sequences (
  year INT NOT NULL PRIMARY KEY,
  last_value INT NOT NULL DEFAULT 0
);
