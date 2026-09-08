ALTER TABLE payment_queue_requests
ADD COLUMN locked_by VARCHAR(100) NULL AFTER response_payload,
ADD COLUMN locked_at DATETIME NULL AFTER locked_by,
ADD COLUMN claimed_at DATETIME NULL AFTER locked_at;

CREATE INDEX idx_payment_queue_bank_status_created
ON payment_queue_requests (bank_code, status, created_at);
