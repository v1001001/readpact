-- Public presentation state, deliberately separate from signed/chain submissions.
CREATE TABLE reading_demos (
 id VARCHAR(40) PRIMARY KEY,
 book_id VARCHAR(66) NOT NULL,
 current_day INT NOT NULL,
 completed_days VARCHAR(100) NOT NULL,
 reflection VARCHAR(500) NOT NULL DEFAULT '',
 submitted BOOLEAN NOT NULL DEFAULT FALSE,
 witness_one BOOLEAN NOT NULL DEFAULT FALSE,
 witness_two BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO reading_demos (id,book_id,current_day,completed_days)
SELECT 'algorithms',id,21,'1,2,3,5,6,7,8,10,11,12,13,14,16,17,18,19,20'
FROM reading_books WHERE slug='algorithms-to-live-by-v1';
