-- Keep historical book/task records accessible; publish only the eight books in 1017.html.
ALTER TABLE reading_books ADD COLUMN catalog_visible BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE reading_books SET catalog_visible = FALSE WHERE sort_order >= 8;
UPDATE reading_books SET tone = '#f3e48e', accent = '#3b3610' WHERE slug = 'algorithms-to-live-by-v1';
UPDATE reading_books SET tone = '#c7d9ec', accent = '#304e73' WHERE slug = 'life-after-google-v1';
UPDATE reading_books SET tone = '#eee0c5', accent = '#4c4438' WHERE slug = 'ethereum-v1';
UPDATE reading_books SET tone = '#cbe4f0', accent = '#126285' WHERE slug = 'blockchain-revolution-v1';
UPDATE reading_books SET tone = '#f0c7be', accent = '#7a3028' WHERE slug = 'the-formula-v1';
UPDATE reading_books SET tone = '#e4ddb7', accent = '#51451f' WHERE slug = 'superintelligence-v1';
UPDATE reading_books SET tone = '#e9bec5', accent = '#732a3a' WHERE slug = 'black-swan-v1';
UPDATE reading_books SET tone = '#f4e19f', accent = '#59441c' WHERE slug = 'super-nintendo-v1';
