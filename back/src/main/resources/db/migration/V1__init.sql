CREATE TABLE IF NOT EXISTS users (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(64)  NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    nickname     VARCHAR(64),
    role         VARCHAR(32),
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP,
    updated_at   TIMESTAMP
);

-- default admin / admin123  (bcrypt of "admin123")
INSERT INTO users (username, password, nickname, role, enabled, created_at, updated_at)
VALUES ('admin',
        '$2a$10$plTDDc56TcghMTs2Lag6euXqnrxJYoBkaBOztOkrcB7t3ukFbNSee',
        'Admin', 'ADMIN', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
