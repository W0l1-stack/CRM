package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	anthropicURL     = "https://api.anthropic.com/v1/messages"
	anthropicVersion = "2023-06-01"
	defaultModel     = "claude-sonnet-4-6"
)

// block is one content block in the Messages API (text / tool_use / tool_result).
// Fields are omitempty so the same struct serializes for every block kind.
type block struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   string          `json:"content,omitempty"`
	IsError   bool            `json:"is_error,omitempty"`
}

type message struct {
	Role    string  `json:"role"`
	Content []block `json:"content"`
}

type tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"input_schema"`
}

type messagesRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system,omitempty"`
	Messages  []message `json:"messages"`
	Tools     []tool    `json:"tools,omitempty"`
}

type messagesResponse struct {
	Content    []block `json:"content"`
	StopReason string  `json:"stop_reason"`
	Error      *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

type anthropic struct {
	apiKey string
	model  string
	http   *http.Client
}

func newAnthropic(apiKey, model string) *anthropic {
	if model == "" {
		model = defaultModel
	}
	return &anthropic{apiKey: apiKey, model: model, http: &http.Client{Timeout: 60 * time.Second}}
}

func (a *anthropic) createMessage(ctx context.Context, system string, msgs []message, tools []tool) (*messagesResponse, error) {
	body, err := json.Marshal(messagesRequest{Model: a.model, MaxTokens: 2048, System: system, Messages: msgs, Tools: tools})
	if err != nil {
		return nil, fmt.Errorf("ai.createMessage: encode: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ai.createMessage: %w", err)
	}
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)
	req.Header.Set("content-type", "application/json")

	resp, err := a.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ai.createMessage: request: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	var out messagesResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("ai.createMessage: decode (%d): %w", resp.StatusCode, err)
	}
	if resp.StatusCode >= 400 {
		msg := "request failed"
		if out.Error != nil {
			msg = out.Error.Message
		}
		return nil, fmt.Errorf("ai.createMessage: anthropic %d: %s", resp.StatusCode, msg)
	}
	return &out, nil
}
