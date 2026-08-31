package biz

import "testing"

func TestValidateArticleTypeConfig(t *testing.T) {
	t.Parallel()

	valid := func() *ArticleTypeConfig {
		return &ArticleTypeConfig{
			ContentGoal:           "生成专业文章",
			Sections:              []ArticleTypeSection{{Title: "引言", Required: true}},
			InputFields:           []ArticleTypeInputField{{Key: "topic", Label: "主题", InputType: 1, Required: true}},
			SystemPrompt:          "你是专业作者",
			UserPromptTemplate:    "请围绕 {{.topic}} 为 {{.brand_name}} 写作",
			OutputFormat:          1,
			WritingModelIDs:       []uint64{1, 2},
			DefaultWritingModelID: 1,
		}
	}

	tests := []struct {
		name    string
		mutate  func(*ArticleTypeConfig)
		wantErr bool
	}{
		{name: "valid"},
		{name: "unknown template variable", mutate: func(config *ArticleTypeConfig) {
			config.UserPromptTemplate = "{{.missing}}"
		}, wantErr: true},
		{name: "default model outside allowed models", mutate: func(config *ArticleTypeConfig) {
			config.DefaultWritingModelID = 3
		}, wantErr: true},
		{name: "duplicate input key", mutate: func(config *ArticleTypeConfig) {
			config.InputFields = append(config.InputFields, config.InputFields[0])
		}, wantErr: true},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			config := valid()
			if test.mutate != nil {
				test.mutate(config)
			}
			err := validateArticleTypeConfig(config)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateArticleTypeConfig() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}
