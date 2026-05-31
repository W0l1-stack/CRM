package models

import (
	"time"

	"github.com/google/uuid"
)

// Account is one paying customer / business (a GHL-style sub-account).
type Account struct {
	ID                   uuid.UUID  `json:"id"`
	Name                 string     `json:"name"`
	Plan                 string     `json:"plan"`
	TrialEndsAt          *time.Time `json:"trial_ends_at"`
	StripeCustomerID     *string    `json:"stripe_customer_id"`
	StripeSubscriptionID *string    `json:"stripe_subscription_id"`
	Timezone             string     `json:"timezone"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}
