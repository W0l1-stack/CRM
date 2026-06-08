package conversations

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

// ErrNotFound is returned when no conversation matches within the account.
var ErrNotFound = errors.New("conversation not found")

// Repository owns conversation and message database access, scoped by account_id.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const convColumns = `id, account_id, contact_id, assigned_to, channel, status, subject, last_message_at, created_at, updated_at`

func scanConversation(row pgx.Row) (*models.Conversation, error) {
	var c models.Conversation
	if err := row.Scan(
		&c.ID, &c.AccountID, &c.ContactID, &c.AssignedTo, &c.Channel, &c.Status,
		&c.Subject, &c.LastMessageAt, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &c, nil
}

// ListConversations returns conversations for an account, optionally by status.
func (r *Repository) ListConversations(ctx context.Context, accountID uuid.UUID, status string) ([]models.Conversation, error) {
	query := `SELECT ` + convColumns + ` FROM conversations WHERE account_id = $1`
	args := []interface{}{accountID}
	if status != "" {
		args = append(args, status)
		query += fmt.Sprintf(" AND status = $%d", len(args))
	}
	query += " ORDER BY COALESCE(last_message_at, created_at) DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("conversations.ListConversations: %w", err)
	}
	defer rows.Close()

	out := []models.Conversation{}
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return nil, fmt.Errorf("conversations.ListConversations: scan: %w", err)
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Repository) GetConversation(ctx context.Context, accountID, id uuid.UUID) (*models.Conversation, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+convColumns+` FROM conversations WHERE account_id = $1 AND id = $2`,
		accountID, id,
	)
	c, err := scanConversation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("conversations.GetConversation: %w", err)
	}
	return c, nil
}

func (r *Repository) CreateConversation(ctx context.Context, accountID uuid.UUID, c *models.Conversation) (*models.Conversation, error) {
	row := r.db.QueryRow(ctx,
		`INSERT INTO conversations (account_id, contact_id, assigned_to, channel, status, subject)
		 VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5,''),'open'), $6)
		 RETURNING `+convColumns,
		accountID, c.ContactID, c.AssignedTo, c.Channel, c.Status, c.Subject,
	)
	created, err := scanConversation(row)
	if err != nil {
		return nil, fmt.Errorf("conversations.CreateConversation: %w", err)
	}
	return created, nil
}

// UpdateStatus changes a conversation's status (open, resolved, snoozed).
func (r *Repository) UpdateStatus(ctx context.Context, accountID, id uuid.UUID, status string) (*models.Conversation, error) {
	row := r.db.QueryRow(ctx,
		`UPDATE conversations SET status = $3, updated_at = NOW()
		 WHERE account_id = $1 AND id = $2 RETURNING `+convColumns,
		accountID, id, status,
	)
	c, err := scanConversation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("conversations.UpdateStatus: %w", err)
	}
	return c, nil
}

// DeleteConversation permanently removes a conversation. Its messages are
// removed by the ON DELETE CASCADE on messages.conversation_id.
func (r *Repository) DeleteConversation(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM conversations WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("conversations.DeleteConversation: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

const msgColumns = `id, account_id, conversation_id, sent_by, direction, channel, content, status, external_id, created_at`

func scanMessage(row pgx.Row) (*models.Message, error) {
	var m models.Message
	if err := row.Scan(
		&m.ID, &m.AccountID, &m.ConversationID, &m.SentBy, &m.Direction, &m.Channel,
		&m.Content, &m.Status, &m.ExternalID, &m.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &m, nil
}

// ListMessages returns the messages of a conversation, oldest first. It verifies
// the conversation belongs to the account before returning anything.
func (r *Repository) ListMessages(ctx context.Context, accountID, conversationID uuid.UUID) ([]models.Message, error) {
	if _, err := r.GetConversation(ctx, accountID, conversationID); err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx,
		`SELECT `+msgColumns+` FROM messages WHERE account_id = $1 AND conversation_id = $2 ORDER BY created_at ASC`,
		accountID, conversationID,
	)
	if err != nil {
		return nil, fmt.Errorf("conversations.ListMessages: %w", err)
	}
	defer rows.Close()

	out := []models.Message{}
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, fmt.Errorf("conversations.ListMessages: scan: %w", err)
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

// CreateMessage inserts a message and bumps the conversation's last_message_at,
// both scoped to the account, inside a single transaction.
func (r *Repository) CreateMessage(ctx context.Context, accountID uuid.UUID, m *models.Message) (*models.Message, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("conversations.CreateMessage: begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ensure the conversation exists within this account.
	var exists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM conversations WHERE account_id = $1 AND id = $2)`,
		accountID, m.ConversationID,
	).Scan(&exists); err != nil {
		return nil, fmt.Errorf("conversations.CreateMessage: check conversation: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	row := tx.QueryRow(ctx,
		`INSERT INTO messages (account_id, conversation_id, sent_by, direction, channel, content, status, external_id)
		 VALUES ($1, $2, $3, $4, $5, $6, COALESCE(NULLIF($7,''),'sent'), $8)
		 RETURNING `+msgColumns,
		accountID, m.ConversationID, m.SentBy, m.Direction, m.Channel, m.Content, m.Status, m.ExternalID,
	)
	created, err := scanMessage(row)
	if err != nil {
		return nil, fmt.Errorf("conversations.CreateMessage: insert: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`UPDATE conversations SET last_message_at = $3, updated_at = NOW() WHERE account_id = $1 AND id = $2`,
		accountID, m.ConversationID, created.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("conversations.CreateMessage: bump conversation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("conversations.CreateMessage: commit: %w", err)
	}
	return created, nil
}
