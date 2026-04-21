package model

import "testing"

func TestPhoneVerificationRedisKeyNormalizesPhone(t *testing.T) {
	got := phoneCodeKey(PhoneVerificationSceneLogin, "+86 138-0013-8000")
	want := "phone_code:login:13800138000"
	if got != want {
		t.Fatalf("phoneCodeKey = %q, want %q", got, want)
	}
}
