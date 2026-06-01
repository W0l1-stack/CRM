package contacts

import (
	"reflect"
	"testing"
)

func TestSplitTags(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"hot lead;vip", []string{"hot lead", "vip"}},
		{"a, b , c", []string{"a", "b", "c"}},
		{" ; , ", []string{}},
		{"single", []string{"single"}},
	}
	for _, c := range cases {
		got := splitTags(c.in)
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("splitTags(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestOptional(t *testing.T) {
	if optional("") != nil {
		t.Error("optional(\"\") should be nil")
	}
	if v := optional("x"); v == nil || *v != "x" {
		t.Errorf("optional(\"x\") = %v, want pointer to \"x\"", v)
	}
}
