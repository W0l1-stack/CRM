package contacts

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// TimelineEvent is one entry in a contact's activity timeline. It is an
// aggregate view (not a table) combining messages, deals, and appointments.
type TimelineEvent struct {
	Type      string    `json:"type"`      // message, deal, appointment
	Subtype   string    `json:"subtype"`   // message: email/sms/note; deal: created; appointment: status
	Timestamp time.Time `json:"timestamp"`
	Detail    string    `json:"detail"`
	RefID     uuid.UUID `json:"ref_id"`
}

// Timeline returns the most recent activity for a contact, newest first,
// scoped to the account. Messages are linked through their conversation.
func (r *Repository) Timeline(ctx context.Context, accountID, contactID uuid.UUID, limit int) ([]TimelineEvent, error) {
	rows, err := r.db.Query(ctx,
		`SELECT 'message' AS type, m.channel AS subtype, m.created_at AS ts, m.content AS detail, m.id AS ref_id
		   FROM messages m
		   JOIN conversations c ON c.id = m.conversation_id
		  WHERE m.account_id = $1 AND c.contact_id = $2
		 UNION ALL
		 SELECT 'deal', 'created', d.created_at, d.name, d.id
		   FROM deals d
		  WHERE d.account_id = $1 AND d.contact_id = $2
		 UNION ALL
		 SELECT 'appointment', a.status, a.starts_at, COALESCE(a.notes, ''), a.id
		   FROM appointments a
		  WHERE a.account_id = $1 AND a.contact_id = $2
		 ORDER BY ts DESC
		 LIMIT $3`,
		accountID, contactID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("contacts.Timeline: %w", err)
	}
	defer rows.Close()

	events := []TimelineEvent{}
	for rows.Next() {
		var e TimelineEvent
		if err := rows.Scan(&e.Type, &e.Subtype, &e.Timestamp, &e.Detail, &e.RefID); err != nil {
			return nil, fmt.Errorf("contacts.Timeline: scan: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
