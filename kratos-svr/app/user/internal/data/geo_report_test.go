package data

import "testing"

func TestMetricsFromAggregateCalculatesRates(t *testing.T) {
	metrics := metricsFromAggregate(metricAggregateRow{
		TotalAnswers: 10, ValidAnswers: 8, MentionedAnswers: 6, CitedAnswers: 4,
		AverageVisibilityScore: 72.5,
	})
	if metrics.QuestionCoverageRate != 0.8 || metrics.BrandMentionRate != 0.75 || metrics.CitationRate != 0.5 {
		t.Fatalf("unexpected rates: %+v", metrics)
	}
	if metrics.AverageVisibilityScore != 72.5 {
		t.Fatalf("average visibility = %v", metrics.AverageVisibilityScore)
	}
}

func TestMetricsFromAggregateAvoidsDivisionByZero(t *testing.T) {
	metrics := metricsFromAggregate(metricAggregateRow{})
	if metrics.QuestionCoverageRate != 0 || metrics.BrandMentionRate != 0 || metrics.CitationRate != 0 {
		t.Fatalf("unexpected empty rates: %+v", metrics)
	}
}
