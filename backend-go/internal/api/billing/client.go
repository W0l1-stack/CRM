package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const stripeAPIBase = "https://api.stripe.com"

// stripeClient is a thin wrapper over the Stripe REST API (no SDK dependency).
type stripeClient struct {
	secretKey  string
	webhookKey string
	http       *http.Client
}

func newStripeClient(secretKey, webhookKey string) *stripeClient {
	return &stripeClient{secretKey: secretKey, webhookKey: webhookKey, http: &http.Client{Timeout: 20 * time.Second}}
}

func (c *stripeClient) post(ctx context.Context, path string, form url.Values, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, stripeAPIBase+path, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("stripe.post: %w", err)
	}
	req.SetBasicAuth(c.secretKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("stripe.post %s: %w", path, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("stripe.post %s: status %d: %s", path, resp.StatusCode, string(body))
	}
	if out != nil {
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("stripe.post %s: decode: %w", path, err)
		}
	}
	return nil
}

// CreateCheckoutSession opens a subscription Checkout Session and returns its URL.
func (c *stripeClient) CreateCheckoutSession(ctx context.Context, priceID, accountID, plan, customerEmail, successURL, cancelURL string) (string, error) {
	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("line_items[0][price]", priceID)
	form.Set("line_items[0][quantity]", "1")
	form.Set("success_url", successURL)
	form.Set("cancel_url", cancelURL)
	form.Set("client_reference_id", accountID)
	form.Set("metadata[account_id]", accountID)
	form.Set("metadata[plan]", plan)
	form.Set("subscription_data[metadata][account_id]", accountID)
	form.Set("subscription_data[metadata][plan]", plan)
	if customerEmail != "" {
		form.Set("customer_email", customerEmail)
	}

	var out struct {
		URL string `json:"url"`
	}
	if err := c.post(ctx, "/v1/checkout/sessions", form, &out); err != nil {
		return "", err
	}
	return out.URL, nil
}

// CreatePortalSession opens a billing portal session for an existing customer.
func (c *stripeClient) CreatePortalSession(ctx context.Context, customerID, returnURL string) (string, error) {
	form := url.Values{}
	form.Set("customer", customerID)
	form.Set("return_url", returnURL)
	var out struct {
		URL string `json:"url"`
	}
	if err := c.post(ctx, "/v1/billing_portal/sessions", form, &out); err != nil {
		return "", err
	}
	return out.URL, nil
}

// stripeEvent is the minimal shape we need from a webhook event.
type stripeEvent struct {
	Type string `json:"type"`
	Data struct {
		Object json.RawMessage `json:"object"`
	} `json:"data"`
}

// VerifyAndParseWebhook checks the Stripe-Signature header (HMAC-SHA256 over
// "timestamp.payload") and returns the parsed event.
func (c *stripeClient) VerifyAndParseWebhook(payload []byte, sigHeader string) (*stripeEvent, error) {
	var timestamp string
	var signatures []string
	for _, part := range strings.Split(sigHeader, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signatures = append(signatures, kv[1])
		}
	}
	if timestamp == "" || len(signatures) == 0 {
		return nil, fmt.Errorf("stripe webhook: malformed signature header")
	}

	mac := hmac.New(sha256.New, []byte(c.webhookKey))
	mac.Write([]byte(timestamp + "." + string(payload)))
	expected := hex.EncodeToString(mac.Sum(nil))

	ok := false
	for _, sig := range signatures {
		if hmac.Equal([]byte(sig), []byte(expected)) {
			ok = true
			break
		}
	}
	if !ok {
		return nil, fmt.Errorf("stripe webhook: signature mismatch")
	}

	// Reject events older than 5 minutes (replay protection).
	if ts, err := strconv.ParseInt(timestamp, 10, 64); err == nil {
		if time.Since(time.Unix(ts, 0)) > 5*time.Minute {
			return nil, fmt.Errorf("stripe webhook: timestamp too old")
		}
	}

	var evt stripeEvent
	if err := json.Unmarshal(payload, &evt); err != nil {
		return nil, fmt.Errorf("stripe webhook: decode: %w", err)
	}
	return &evt, nil
}
