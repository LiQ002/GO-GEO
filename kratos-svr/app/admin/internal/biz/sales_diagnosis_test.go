package biz

import (
	"strings"
	"testing"
	"time"
)

func TestNormalizeDiagnosisQuestions(t *testing.T) {
	t.Parallel()

	got := normalizeDiagnosisQuestions([]string{"  如何选择供应商？ ", "", "如何选择供应商？", "HOW TO CHOOSE?", "how to choose?"})
	if len(got) != 2 || got[0] != "如何选择供应商？" || got[1] != "HOW TO CHOOSE?" {
		t.Fatalf("normalizeDiagnosisQuestions() = %#v", got)
	}
}

func TestNormalizeDiagnosisModelIDs(t *testing.T) {
	t.Parallel()

	got := normalizeDiagnosisModelIDs([]uint64{3, 0, 2, 3, 2})
	if len(got) != 2 || got[0] != 3 || got[1] != 2 {
		t.Fatalf("normalizeDiagnosisModelIDs() = %#v", got)
	}
}

func TestValidDiagnosisSubject(t *testing.T) {
	t.Parallel()

	if !validDiagnosisSubject(SalesDiagnosisSubjectOpportunity, 10, 0, "", "") {
		t.Fatal("opportunity subject should be valid")
	}
	if !validDiagnosisSubject(SalesDiagnosisSubjectEnterprise, 0, 20, "", "") {
		t.Fatal("enterprise subject should be valid")
	}
	if !validDiagnosisSubject(SalesDiagnosisSubjectQuickBrand, 0, 0, "星河科技", "星河") {
		t.Fatal("quick brand subject should be valid")
	}
	for _, test := range []struct {
		subjectType                 int32
		opportunityID, enterpriseID uint64
	}{
		{0, 0, 0},
		{SalesDiagnosisSubjectOpportunity, 10, 20},
		{SalesDiagnosisSubjectEnterprise, 10, 20},
		{SalesDiagnosisSubjectEnterprise, 0, 0},
	} {
		if validDiagnosisSubject(test.subjectType, test.opportunityID, test.enterpriseID, "", "") {
			t.Fatalf("validDiagnosisSubject(%d, %d, %d) = true", test.subjectType, test.opportunityID, test.enterpriseID)
		}
	}
}

func TestNewSalesDiagnosisCode(t *testing.T) {
	t.Parallel()

	code, err := newSalesDiagnosisCode(time.Date(2026, time.August, 21, 10, 11, 12, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(code, "DX-20260821-101112-") || len(code) != len("DX-20260821-101112-")+8 {
		t.Fatalf("newSalesDiagnosisCode() = %q", code)
	}
}
