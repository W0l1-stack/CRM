package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"crm-go-api/internal/models"
)

var (
	ErrValidation   = errors.New("validation failed")
	ErrNotConfigured = errors.New("billing is not configured")
	ErrNoCustomer   = errors.New("no billing customer for account")
)

type Service struct {
	repo          *Repository
	stripe        *stripeClient
	priceStarter  string
	pricePro      string
	frontendURL   string
	configured    bool
}

func NewService(repo *Repository, secretKey, webhookKey, priceStarter, pricePro, frontendURL string) *Service {
	return &Service{
		repo:         repo,
		stripe:       newStripeClient(secretKey, webhookKey),
		priceStarter: priceStarter,
		pricePro:     pricePro,
		frontendURL:  frontendURL,
		configured:   secretKey != "",
	}
}

func (s *Service) priceFor(plan string) (string, error) {
	switch plan {
	case "starter":
		return s.priceStarter, nil
	case "pro":
		return s.pricePro, nil
	default:
		return "", fmt.Errorf("billing.priceFor: %w: plan must be 'starter' or 'pro'", ErrValidation)
	}
}

func (s *Service) GetAccount(ctx context.Context, accountID uuid.UUID) (*models.Account, error) {
	return s.repo.GetAccount(ctx, accountID)
}

// Checkout creates a Stripe Checkout Session URL for the chosen plan.
func (s *Service) Checkout(ctx context.Context, accountID uuid.UUID, plan string) (string, error) {
	if !s.configured {
		return "", ErrNotConfigured
	}
	priceID, err := s.priceFor(plan)
	if err != nil {
		return "", err
	}
	if priceID == "" {
		return "", ErrNotConfigured
	}
	success := s.frontendURL + "/billing?status=success"
	cancel := s.frontendURL + "/billing?status=cancel"
	return s.stripe.CreateCheckoutSession(ctx, priceID, accountID.String(), plan, "", success, cancel)
}

// Portal creates a Stripe billing portal URL for managing the subscription.
func (s *Service) Portal(ctx context.Context, accountID uuid.UUID) (string, error) {
	if !s.configured {
		return "", ErrNotConfigured
	}
	acc, err := s.repo.GetAccount(ctx, accountID)
	if err != nil {
		return "", err
	}
	if acc.StripeCustomerID == nil || *acc.StripeCustomerID == "" {
		return "", ErrNoCustomer
	}
	return s.stripe.CreatePortalSession(ctx, *acc.StripeCustomerID, s.frontendURL+"/billing")
}

// HandleWebhook verifies and processes a Stripe webhook payload.
func (s *Service) HandleWebhook(ctx context.Context, payload []byte, sigHeader string) error {
	evt, err := s.stripe.VerifyAndParseWebhook(payload, sigHeader)
	if err != nil {
		return err
	}

	switch evt.Type {
	case "checkout.session.completed":
		var obj struct {
			ClientReferenceID string `json:"client_reference_id"`
			Customer          string `json:"customer"`
			Subscription      string `json:"subscription"`
			Metadata          struct {
				AccountID string `json:"account_id"`
				Plan      string `json:"plan"`
			} `json:"metadata"`
		}
		if err := json.Unmarshal(evt.Data.Object, &obj); err != nil {
			return fmt.Errorf("billing.HandleWebhook: decode session: %w", err)
		}
		accountIDStr := obj.ClientReferenceID
		if accountIDStr == "" {
			accountIDStr = obj.Metadata.AccountID
		}
		accountID, err := uuid.Parse(accountIDStr)
		if err != nil {
			return fmt.Errorf("billing.HandleWebhook: bad account id: %w", err)
		}
		plan := obj.Metadata.Plan
		if plan == "" {
			plan = "starter"
		}
		return s.repo.ActivateSubscription(ctx, accountID, obj.Customer, obj.Subscription, plan)

	case "customer.subscription.deleted":
		var obj struct {
			Customer string `json:"customer"`
		}
		if err := json.Unmarshal(evt.Data.Object, &obj); err != nil {
			return fmt.Errorf("billing.HandleWebhook: decode subscription: %w", err)
		}
		if obj.Customer != "" {
			return s.repo.DowngradeByCustomer(ctx, obj.Customer, "trial")
		}
	}

	return nil // unhandled event types are acknowledged
}
