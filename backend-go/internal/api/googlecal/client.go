package googlecal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Google OAuth + Calendar REST endpoints. We call these directly with the
// stdlib http client to avoid pulling in the full Google API SDK.
const (
	authEndpoint     = "https://accounts.google.com/o/oauth2/v2/auth"
	tokenEndpoint    = "https://oauth2.googleapis.com/token"
	userinfoEndpoint = "https://www.googleapis.com/oauth2/v2/userinfo"
	calendarBase     = "https://www.googleapis.com/calendar/v3"
	scope            = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email"
)

var httpClient = &http.Client{Timeout: 15 * time.Second}

// Interval is a busy window on the connected calendar.
type Interval struct {
	Start time.Time
	End   time.Time
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

// buildAuthURL builds the consent screen URL. offline access + consent prompt
// ensures we receive a refresh token.
func buildAuthURL(clientID, redirectURL, state string) string {
	q := url.Values{}
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURL)
	q.Set("response_type", "code")
	q.Set("scope", scope)
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")
	q.Set("state", state)
	return authEndpoint + "?" + q.Encode()
}

// exchangeCode swaps an authorization code for access + refresh tokens.
func exchangeCode(ctx context.Context, clientID, clientSecret, redirectURL, code string) (*tokenResponse, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("redirect_uri", redirectURL)
	form.Set("grant_type", "authorization_code")
	return postToken(ctx, form)
}

// refreshAccessToken obtains a fresh access token from a stored refresh token.
func refreshAccessToken(ctx context.Context, clientID, clientSecret, refreshToken string) (*tokenResponse, error) {
	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("refresh_token", refreshToken)
	form.Set("grant_type", "refresh_token")
	return postToken(ctx, form)
}

func postToken(ctx context.Context, form url.Values) (*tokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("googlecal.postToken: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("googlecal.postToken: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return nil, fmt.Errorf("googlecal.postToken: decode: %w", err)
	}
	if tr.Error != "" {
		return nil, fmt.Errorf("googlecal.postToken: %s: %s", tr.Error, tr.ErrorDesc)
	}
	return &tr, nil
}

// fetchUserEmail returns the connected Google account's email address.
func fetchUserEmail(ctx context.Context, accessToken string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, userinfoEndpoint, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("googlecal.fetchUserEmail: %w", err)
	}
	defer resp.Body.Close()
	var info struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", fmt.Errorf("googlecal.fetchUserEmail: decode: %w", err)
	}
	return info.Email, nil
}

// fetchFreeBusy returns busy intervals on a calendar between two times.
func fetchFreeBusy(ctx context.Context, accessToken, calendarID string, from, to time.Time) ([]Interval, error) {
	payload := map[string]interface{}{
		"timeMin": from.UTC().Format(time.RFC3339),
		"timeMax": to.UTC().Format(time.RFC3339),
		"items":   []map[string]string{{"id": calendarID}},
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, calendarBase+"/freeBusy", strings.NewReader(string(body)))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("googlecal.fetchFreeBusy: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("googlecal.fetchFreeBusy: status %d: %s", resp.StatusCode, string(b))
	}
	var out struct {
		Calendars map[string]struct {
			Busy []struct {
				Start time.Time `json:"start"`
				End   time.Time `json:"end"`
			} `json:"busy"`
		} `json:"calendars"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("googlecal.fetchFreeBusy: decode: %w", err)
	}
	intervals := []Interval{}
	if cal, ok := out.Calendars[calendarID]; ok {
		for _, b := range cal.Busy {
			intervals = append(intervals, Interval{Start: b.Start, End: b.End})
		}
	}
	return intervals, nil
}

// insertEvent creates a calendar event and returns its id.
func insertEvent(ctx context.Context, accessToken, calendarID, summary, description string, start, end time.Time, attendeeEmail string) (string, error) {
	event := map[string]interface{}{
		"summary":     summary,
		"description": description,
		"start":       map[string]string{"dateTime": start.UTC().Format(time.RFC3339)},
		"end":         map[string]string{"dateTime": end.UTC().Format(time.RFC3339)},
	}
	if attendeeEmail != "" {
		event["attendees"] = []map[string]string{{"email": attendeeEmail}}
	}
	body, _ := json.Marshal(event)
	endpoint := fmt.Sprintf("%s/calendars/%s/events", calendarBase, url.PathEscape(calendarID))
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("googlecal.insertEvent: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("googlecal.insertEvent: status %d: %s", resp.StatusCode, string(b))
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		return "", fmt.Errorf("googlecal.insertEvent: decode: %w", err)
	}
	return created.ID, nil
}
