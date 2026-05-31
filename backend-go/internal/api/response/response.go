// Package response writes the standard Lydia API envelope:
// {"data": ..., "error": null, "meta": {...}}
package response

import (
	"encoding/json"
	"net/http"
)

type envelope struct {
	Data  interface{} `json:"data"`
	Error interface{} `json:"error"`
	Meta  interface{} `json:"meta"`
}

// APIError is the shape placed in the "error" field on failures.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// JSON writes a success envelope with the given status code and optional meta.
func JSON(w http.ResponseWriter, status int, data interface{}, meta interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Data: data, Error: nil, Meta: meta})
}

// Error writes an error envelope with the given status code.
func Error(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{
		Data:  nil,
		Error: APIError{Code: code, Message: message},
		Meta:  nil,
	})
}
