package contacts

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/models"
)

// ImportError describes a single CSV row that could not be imported.
type ImportError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

// ImportResult summarises a CSV import run.
type ImportResult struct {
	Created int           `json:"created"`
	Failed  int           `json:"failed"`
	Errors  []ImportError `json:"errors"`
}

// ImportCSV reads a CSV stream and creates one contact per data row. The first
// row is treated as a header; recognised columns (case-insensitive) are name,
// email, phone, company, source, notes, and tags (tags split on , or ;).
// A name or email column is required. Bad rows are collected, not fatal.
func (s *Service) ImportCSV(ctx context.Context, accountID uuid.UUID, r io.Reader) (*ImportResult, error) {
	cr := csv.NewReader(r)
	cr.TrimLeadingSpace = true
	cr.FieldsPerRecord = -1 // tolerate ragged rows

	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("contacts.ImportCSV: %w: empty or invalid CSV", ErrValidation)
	}

	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}
	if _, hasName := col["name"]; !hasName {
		if _, hasEmail := col["email"]; !hasEmail {
			return nil, fmt.Errorf("contacts.ImportCSV: %w: CSV needs a 'name' or 'email' column", ErrValidation)
		}
	}

	get := func(rec []string, key string) string {
		if i, ok := col[key]; ok && i < len(rec) {
			return strings.TrimSpace(rec[i])
		}
		return ""
	}

	result := &ImportResult{Errors: []ImportError{}}
	rowNum := 1 // header is row 1
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Message: "malformed row"})
			continue
		}

		c := &models.Contact{
			Name:    get(rec, "name"),
			Company: optional(get(rec, "company")),
			Email:   optional(get(rec, "email")),
			Phone:   optional(get(rec, "phone")),
			Notes:   optional(get(rec, "notes")),
		}
		if c.Name == "" && c.Email != nil {
			c.Name = *c.Email // fall back to email as the display name
		}
		if src := get(rec, "source"); src != "" {
			c.Source = &src
		} else {
			imported := "import"
			c.Source = &imported
		}
		if tags := get(rec, "tags"); tags != "" {
			c.Tags = splitTags(tags)
		}

		if _, err := s.Create(ctx, accountID, c); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Message: err.Error()})
			continue
		}
		result.Created++
	}

	return result, nil
}

// optional returns nil for an empty string, otherwise a pointer to it.
func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// splitTags splits a tag cell on commas or semicolons and trims each tag.
func splitTags(s string) []string {
	fields := strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ';' })
	tags := make([]string, 0, len(fields))
	for _, f := range fields {
		if t := strings.TrimSpace(f); t != "" {
			tags = append(tags, t)
		}
	}
	return tags
}
