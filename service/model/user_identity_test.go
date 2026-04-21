package model

import "testing"

func TestNormalizeIdentityKeyPhone(t *testing.T) {
	got := normalizeIdentityKey(UserIdentityTypePhone, "+86 138-0013-8000")
	want := "13800138000"
	if got != want {
		t.Fatalf("normalizeIdentityKey(phone) = %q, want %q", got, want)
	}
}

func TestNormalizeIdentityKeyUsername(t *testing.T) {
	got := normalizeIdentityKey(UserIdentityTypeUsername, "  Test_User ")
	want := "test_user"
	if got != want {
		t.Fatalf("normalizeIdentityKey(username) = %q, want %q", got, want)
	}
}

func TestNormalizeIdentityKeyWechatPreservesCase(t *testing.T) {
	got := normalizeIdentityKey(UserIdentityTypeWechatUnionID, "  oAbCdEf123 ")
	want := "oAbCdEf123"
	if got != want {
		t.Fatalf("normalizeIdentityKey(wechat) = %q, want %q", got, want)
	}
}
