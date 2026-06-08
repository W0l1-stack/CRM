package ai

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/api/automations"
	"crm-go-api/internal/api/campaigns"
	"crm-go-api/internal/api/forms"
	"crm-go-api/internal/api/integrations"
)

// ErrNotConnected indicates the account hasn't connected an Anthropic key.
var ErrNotConnected = errors.New("anthropic not connected")

// ChatMessage is one turn of the user-facing conversation.
type ChatMessage struct {
	Role string `json:"role"` // user | assistant
	Text string `json:"text"`
}

// Created is a resource the assistant created during a turn.
type Created struct {
	Type string    `json:"type"`
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type Service struct {
	intg *integrations.Repository
	auto *automations.Service
	camp *campaigns.Service
	form *forms.Service
	pool *pgxpool.Pool
}

func NewService(intg *integrations.Repository, auto *automations.Service, camp *campaigns.Service, form *forms.Service, pool *pgxpool.Pool) *Service {
	return &Service{intg: intg, auto: auto, camp: camp, form: form, pool: pool}
}

const systemPrompt = `You are the AI assistant inside Lydia CRM. You help the user build and analyze their CRM by calling tools.

You can:
- create_automation: build a "when X happens, do Y" workflow.
- create_campaign: draft an email or SMS campaign.
- create_form: build a lead-capture form.
- get_pipeline_summary / list_contacts: read data to answer questions and decide audiences.

Automation actions (each is {"type":..., "config":{...}}):
- send_email  config: {subject, body}
- send_sms    config: {body}
- add_tag     config: {tag}
- wait        config: {days}
- branch      config: {cases:[{label, field, op, value, actions:[...]}], default:[...]}  (op: has_tag|equals|not_equals|contains|not_empty|empty)
- wait_event  config: {event:"replied"|"clicked", timeout_days, on_event:[...], on_timeout:[...]}
Use {{name}}, {{email}}, {{company_name}} for personalization. trigger_types: contact_created, deal_moved, form_submitted, appointment_booked.

Created automations and campaigns are saved as drafts/paused so the user can review and activate them. After creating something, tell the user what you made and that it's ready to review. Be concise.`

// Assist runs one assistant turn: it calls Claude with tools, executes any tool
// calls against the CRM, and returns the final text plus anything it created.
func (s *Service) Assist(ctx context.Context, accountID uuid.UUID, userID *uuid.UUID, history []ChatMessage) (string, []Created, error) {
	it, err := s.intg.GetByKind(ctx, accountID, "ai")
	if errors.Is(err, integrations.ErrNotFound) {
		return "", nil, ErrNotConnected
	}
	if err != nil {
		return "", nil, err
	}
	apiKey := it.Config["api_key"]
	if apiKey == "" {
		return "", nil, ErrNotConnected
	}
	client := newAnthropic(apiKey, it.From)

	msgs := make([]message, 0, len(history))
	for _, h := range history {
		role := "user"
		if h.Role == "assistant" {
			role = "assistant"
		}
		msgs = append(msgs, message{Role: role, Content: []block{{Type: "text", Text: h.Text}}})
	}

	created := []Created{}
	for turn := 0; turn < 6; turn++ {
		resp, err := client.createMessage(ctx, systemPrompt, msgs, toolDefs())
		if err != nil {
			return "", created, err
		}
		msgs = append(msgs, message{Role: "assistant", Content: resp.Content})

		if resp.StopReason != "tool_use" {
			return finalText(resp.Content), created, nil
		}

		var results []block
		for _, b := range resp.Content {
			if b.Type != "tool_use" {
				continue
			}
			out, isErr, c := s.execTool(ctx, accountID, userID, b.Name, b.Input)
			if c != nil {
				created = append(created, *c)
			}
			results = append(results, block{Type: "tool_result", ToolUseID: b.ID, Content: out, IsError: isErr})
		}
		msgs = append(msgs, message{Role: "user", Content: results})
	}
	return "I wasn't able to finish that — please try rephrasing.", created, nil
}

func finalText(blocks []block) string {
	var sb strings.Builder
	for _, b := range blocks {
		if b.Type == "text" {
			sb.WriteString(b.Text)
		}
	}
	return strings.TrimSpace(sb.String())
}
