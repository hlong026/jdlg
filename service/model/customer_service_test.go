package model

import "testing"

func TestNormalizeCustomerLeadStatus(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty defaults to new", input: "", want: CustomerLeadStatusNew},
		{name: "known contacted", input: "contacted", want: CustomerLeadStatusContacted},
		{name: "known converted", input: "converted", want: CustomerLeadStatusConverted},
		{name: "unknown falls back to new", input: "archived", want: CustomerLeadStatusNew},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeCustomerLeadStatus(tt.input); got != tt.want {
				t.Fatalf("NormalizeCustomerLeadStatus(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeCustomerIntentLevel(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "", want: CustomerIntentLevelMedium},
		{input: "high", want: CustomerIntentLevelHigh},
		{input: "low", want: CustomerIntentLevelLow},
		{input: "unknown", want: CustomerIntentLevelMedium},
	}

	for _, tt := range tests {
		if got := NormalizeCustomerIntentLevel(tt.input); got != tt.want {
			t.Fatalf("NormalizeCustomerIntentLevel(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
