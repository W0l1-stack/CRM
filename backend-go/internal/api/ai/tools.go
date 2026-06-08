package ai

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"crm-go-api/internal/models"
)

func obj(m map[string]interface{}) map[string]interface{} { return m }

// toolDefs are the tools exposed to Claude. Schemas are permissive; the CRM
// services validate on execution and any error is fed back so Claude can fix it.
func toolDefs() []tool {
	str := obj(map[string]interface{}{"type": "string"})
	return []tool{
		{
			Name:        "create_automation",
			Description: "Create a workflow automation (saved paused for review).",
			InputSchema: obj(map[string]interface{}{
				"type": "object",
				"properties": obj(map[string]interface{}{
					"name":          str,
					"trigger_types": obj(map[string]interface{}{"type": "array", "items": obj(map[string]interface{}{"type": "string", "enum": []string{"contact_created", "deal_moved", "form_submitted", "appointment_booked"}})}),
					"actions":       obj(map[string]interface{}{"type": "array", "items": obj(map[string]interface{}{"type": "object"})}),
				}),
				"required": []string{"name", "trigger_types", "actions"},
			}),
		},
		{
			Name:        "create_campaign",
			Description: "Draft an email or SMS campaign to a tagged audience (saved as draft).",
			InputSchema: obj(map[string]interface{}{
				"type": "object",
				"properties": obj(map[string]interface{}{
					"name":         str,
					"channel":      obj(map[string]interface{}{"type": "string", "enum": []string{"email", "sms"}}),
					"subject":      str,
					"message":      obj(map[string]interface{}{"type": "string", "description": "Email HTML/text or SMS body. Supports {{name}}."}),
					"audience_tag": obj(map[string]interface{}{"type": "string", "description": "Contact tag to target; blank = all."}),
				}),
				"required": []string{"name", "channel", "message"},
			}),
		},
		{
			Name:        "create_form",
			Description: "Create a lead-capture form.",
			InputSchema: obj(map[string]interface{}{
				"type": "object",
				"properties": obj(map[string]interface{}{
					"name":              str,
					"fields":            obj(map[string]interface{}{"type": "array", "items": obj(map[string]interface{}{"type": "object", "properties": obj(map[string]interface{}{"type": str, "label": str, "required": obj(map[string]interface{}{"type": "boolean"})})})}),
					"thank_you_message": str,
				}),
				"required": []string{"name", "fields"},
			}),
		},
		{
			Name:        "get_pipeline_summary",
			Description: "Read deal counts and value per pipeline stage.",
			InputSchema: obj(map[string]interface{}{"type": "object", "properties": obj(map[string]interface{}{})}),
		},
		{
			Name:        "list_contacts",
			Description: "List recent contacts, optionally filtered by tag.",
			InputSchema: obj(map[string]interface{}{
				"type": "object",
				"properties": obj(map[string]interface{}{
					"tag":   str,
					"limit": obj(map[string]interface{}{"type": "integer"}),
				}),
			}),
		},
	}
}

// execTool runs one tool call and returns (result text, isError, created?).
func (s *Service) execTool(ctx context.Context, accountID uuid.UUID, userID *uuid.UUID, name string, input json.RawMessage) (string, bool, *Created) {
	switch name {
	case "create_automation":
		var in struct {
			Name         string                    `json:"name"`
			TriggerTypes []string                  `json:"trigger_types"`
			Actions      []models.AutomationAction `json:"actions"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return "invalid input: " + err.Error(), true, nil
		}
		a, err := s.auto.Create(ctx, accountID, &models.Automation{Name: in.Name, TriggerTypes: in.TriggerTypes, IsActive: false, Actions: in.Actions})
		if err != nil {
			return "could not create automation: " + err.Error(), true, nil
		}
		return fmt.Sprintf(`{"id":"%s","status":"paused"}`, a.ID), false, &Created{Type: "automation", ID: a.ID, Name: a.Name}

	case "create_campaign":
		var in struct {
			Name, Channel, Subject, Message, AudienceTag string
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return "invalid input: " + err.Error(), true, nil
		}
		filter := map[string]interface{}{}
		if in.AudienceTag != "" {
			filter["tag"] = in.AudienceTag
		}
		c, err := s.camp.Create(ctx, accountID, userID, &models.Campaign{
			Name: in.Name, Channel: in.Channel, Subject: in.Subject, BodyHTML: in.Message, RecipientFilter: filter,
		})
		if err != nil {
			return "could not create campaign: " + err.Error(), true, nil
		}
		return fmt.Sprintf(`{"id":"%s","status":"draft"}`, c.ID), false, &Created{Type: "campaign", ID: c.ID, Name: c.Name}

	case "create_form":
		var in struct {
			Name     string             `json:"name"`
			Fields   []models.FormField `json:"fields"`
			ThankYou string             `json:"thank_you_message"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return "invalid input: " + err.Error(), true, nil
		}
		settings := map[string]interface{}{}
		if in.ThankYou != "" {
			settings["thank_you_message"] = in.ThankYou
		}
		f, err := s.form.Create(ctx, accountID, &models.Form{Name: in.Name, Fields: in.Fields, Settings: settings})
		if err != nil {
			return "could not create form: " + err.Error(), true, nil
		}
		return fmt.Sprintf(`{"id":"%s"}`, f.ID), false, &Created{Type: "form", ID: f.ID, Name: f.Name}

	case "get_pipeline_summary":
		return s.pipelineSummary(ctx, accountID), false, nil

	case "list_contacts":
		var in struct {
			Tag   string `json:"tag"`
			Limit int    `json:"limit"`
		}
		_ = json.Unmarshal(input, &in)
		return s.listContacts(ctx, accountID, in.Tag, in.Limit), false, nil

	default:
		return "unknown tool", true, nil
	}
}

func (s *Service) pipelineSummary(ctx context.Context, accountID uuid.UUID) string {
	rows, err := s.pool.Query(ctx,
		`SELECT p.name, d.stage_id, COUNT(*), COALESCE(SUM(d.value),0)
		   FROM deals d JOIN pipelines p ON p.id = d.pipeline_id
		  WHERE d.account_id = $1 GROUP BY p.name, d.stage_id ORDER BY p.name`, accountID)
	if err != nil {
		return "could not read pipeline: " + err.Error()
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var pipeline, stage string
		var cnt int
		var total float64
		if err := rows.Scan(&pipeline, &stage, &cnt, &total); err == nil {
			out = append(out, map[string]interface{}{"pipeline": pipeline, "stage_id": stage, "deals": cnt, "value": total})
		}
	}
	b, _ := json.Marshal(out)
	return string(b)
}

func (s *Service) listContacts(ctx context.Context, accountID uuid.UUID, tag string, limit int) string {
	if limit <= 0 || limit > 50 {
		limit = 25
	}
	q := `SELECT id, name, COALESCE(email,''), COALESCE(phone,''), tags FROM contacts WHERE account_id = $1`
	args := []interface{}{accountID}
	if tag != "" {
		args = append(args, tag)
		q += fmt.Sprintf(" AND $%d = ANY(tags)", len(args))
	}
	args = append(args, limit)
	q += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", len(args))

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return "could not read contacts: " + err.Error()
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var id uuid.UUID
		var name, email, phone string
		var tags []string
		if err := rows.Scan(&id, &name, &email, &phone, &tags); err == nil {
			out = append(out, map[string]interface{}{"id": id, "name": name, "email": email, "phone": phone, "tags": tags})
		}
	}
	b, _ := json.Marshal(out)
	return string(b)
}
