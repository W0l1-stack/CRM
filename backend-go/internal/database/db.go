package database

import (
	"database/sql"
	"fmt"
	"os"

	_ "modernc.org/sqlite"
)

func Connect() (*sql.DB, error) {
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "crm.db"
	}

	// Changed "sqlite3" to "sqlite"
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

func Migrate(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS contacts (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		email TEXT,
		phone TEXT,
		name TEXT NOT NULL,
		company TEXT,
		notes TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS deals (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		contact_id TEXT NOT NULL,
		name TEXT NOT NULL,
		value REAL,
		stage TEXT NOT NULL,
		probability INTEGER DEFAULT 50,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id),
		FOREIGN KEY(contact_id) REFERENCES contacts(id)
	);

	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		contact_id TEXT NOT NULL,
		type TEXT,
		content TEXT NOT NULL,
		status TEXT DEFAULT 'sent',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id),
		FOREIGN KEY(contact_id) REFERENCES contacts(id)
	);

	CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
	CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
	CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
	`

	_, err := db.Exec(schema)
	return err
}
