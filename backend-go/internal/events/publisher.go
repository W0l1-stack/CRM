// Package events publishes domain events and automation triggers to Redis.
// The Node service relays UI events to Socket.io rooms and runs automation
// steps off the trigger channel.
package events

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// TriggerChannel is the single Redis channel the Node automation engine listens
// on. Each message carries its own account_id, so one channel serves all tenants.
const TriggerChannel = "lydia:triggers"

// OutboundChannel carries outbound message send requests. Node resolves the
// recipient and enqueues the actual email/SMS send onto BullMQ.
const OutboundChannel = "lydia:outbound"

// CampaignChannel carries campaign-send requests. Node resolves the recipient
// list and enqueues one email per contact.
const CampaignChannel = "lydia:campaigns"

// Publisher publishes to Redis. A nil *Publisher is a valid no-op, so callers
// don't have to branch when Redis isn't configured.
type Publisher struct {
	rdb *redis.Client
}

// NewPublisher connects to Redis using a standard redis:// URL.
func NewPublisher(redisURL string) (*Publisher, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("events.NewPublisher: %w", err)
	}
	return &Publisher{rdb: redis.NewClient(opt)}, nil
}

// PublishUIEvent sends a realtime event to one account's channel.
func (p *Publisher) PublishUIEvent(ctx context.Context, accountID uuid.UUID, eventType string, data interface{}) error {
	if p == nil {
		return nil
	}
	payload, err := json.Marshal(map[string]interface{}{"type": eventType, "data": data})
	if err != nil {
		return fmt.Errorf("events.PublishUIEvent: %w", err)
	}
	channel := fmt.Sprintf("lydia:events:%s", accountID)
	if err := p.rdb.Publish(ctx, channel, payload).Err(); err != nil {
		return fmt.Errorf("events.PublishUIEvent: %w", err)
	}
	return nil
}

// PublishTrigger emits an automation trigger for the engine to evaluate.
func (p *Publisher) PublishTrigger(ctx context.Context, accountID uuid.UUID, triggerType string, payload interface{}) error {
	if p == nil {
		return nil
	}
	body, err := json.Marshal(map[string]interface{}{
		"account_id":   accountID,
		"trigger_type": triggerType,
		"payload":      payload,
	})
	if err != nil {
		return fmt.Errorf("events.PublishTrigger: %w", err)
	}
	if err := p.rdb.Publish(ctx, TriggerChannel, body).Err(); err != nil {
		return fmt.Errorf("events.PublishTrigger: %w", err)
	}
	return nil
}

// PublishOutbound asks the Node service to send a stored outbound message.
func (p *Publisher) PublishOutbound(ctx context.Context, accountID, messageID uuid.UUID) error {
	if p == nil {
		return nil
	}
	body, err := json.Marshal(map[string]interface{}{"account_id": accountID, "message_id": messageID})
	if err != nil {
		return fmt.Errorf("events.PublishOutbound: %w", err)
	}
	if err := p.rdb.Publish(ctx, OutboundChannel, body).Err(); err != nil {
		return fmt.Errorf("events.PublishOutbound: %w", err)
	}
	return nil
}

// PublishCampaignSend asks the Node service to send a campaign to its
// recipients. delayMs > 0 schedules the send for later (BullMQ delayed job).
func (p *Publisher) PublishCampaignSend(ctx context.Context, accountID, campaignID uuid.UUID, delayMs int64) error {
	if p == nil {
		return nil
	}
	body, err := json.Marshal(map[string]interface{}{"account_id": accountID, "campaign_id": campaignID, "delay_ms": delayMs})
	if err != nil {
		return fmt.Errorf("events.PublishCampaignSend: %w", err)
	}
	if err := p.rdb.Publish(ctx, CampaignChannel, body).Err(); err != nil {
		return fmt.Errorf("events.PublishCampaignSend: %w", err)
	}
	return nil
}

// Close releases the Redis connection.
func (p *Publisher) Close() error {
	if p == nil {
		return nil
	}
	return p.rdb.Close()
}
