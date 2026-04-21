package model

import "testing"

func TestMembershipWeightPrefersLifetimeAndActive(t *testing.T) {
	normal := &UserMembership{Status: "active", TemplateDownloadEnabled: true}
	lifetime := &UserMembership{Status: "active", PlanCode: DefaultRechargePermanentPlanCode, TemplateDownloadEnabled: true}
	if membershipWeight(lifetime) <= membershipWeight(normal) {
		t.Fatalf("expected lifetime membership weight to be greater")
	}
}
