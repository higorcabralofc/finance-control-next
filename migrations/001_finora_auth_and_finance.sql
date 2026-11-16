CREATE TABLE IF NOT EXISTS finora_schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finora_users (
  open_id VARCHAR(191) NOT NULL PRIMARY KEY,
  display_name VARCHAR(160) NOT NULL,
  email VARCHAR(320) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finora_sessions (
  session_id CHAR(36) NOT NULL PRIMARY KEY,
  open_id VARCHAR(191) NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_finora_sessions_open_id (open_id),
  KEY idx_finora_sessions_expires_at (expires_at),
  CONSTRAINT fk_finora_sessions_user FOREIGN KEY (open_id) REFERENCES finora_users (open_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finora_finance_snapshots (
  open_id VARCHAR(191) NOT NULL PRIMARY KEY,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  snapshot JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_finora_snapshots_user FOREIGN KEY (open_id) REFERENCES finora_users (open_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
