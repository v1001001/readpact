CREATE TABLE reading_submissions (
 content_hash VARCHAR(66) PRIMARY KEY,
 wallet VARCHAR(42) NOT NULL,
 challenge_id VARCHAR(20) NOT NULL,
 reading_day INTEGER NOT NULL,
 reflection VARCHAR(1000) NOT NULL,
 signing_message VARCHAR(4000) NOT NULL,
 expires_at BIGINT NOT NULL,
 signature VARCHAR(132)
);
CREATE INDEX idx_reading_wallet ON reading_submissions(wallet, challenge_id, reading_day);
