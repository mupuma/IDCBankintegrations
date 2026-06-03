ALTER TABLE payment_queue_requests
ADD COLUMN source_bank VARCHAR(100) NULL AFTER bank_code;
