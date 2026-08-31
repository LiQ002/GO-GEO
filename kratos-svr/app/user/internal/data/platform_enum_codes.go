package data

import "kratos-svr/internal/data/model"

func writingModelProviderCode(value int32) string {
	return map[int32]string{
		model.WritingModelProviderQwen:     "qwen",
		model.WritingModelProviderDeepSeek: "deepseek",
		model.WritingModelProviderKimi:     "kimi",
		model.WritingModelProviderOpenAI:   "openai",
		model.WritingModelProviderCustom:   "custom",
	}[value]
}

func writingModelProtocolCode(value int32) string {
	if value == model.WritingModelProtocolOpenAICompatible {
		return "openai_compatible"
	}
	return ""
}

func priceCurrencyCode(value int32) string {
	return map[int32]string{model.PriceCurrencyCNY: "CNY", model.PriceCurrencyUSD: "USD"}[value]
}

func publishCategoryCode(value int32) string {
	return map[int32]string{
		model.PublishChannelCategorySelfMedia:     "self_media",
		model.PublishChannelCategoryOfficialMedia: "official_media",
		model.PublishChannelCategoryKOL:           "kol",
	}[value]
}
