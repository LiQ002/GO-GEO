package biz

import "encoding/json"

// defaultUnitCostsJSON 与 migrations/000040_billing_seed.up.sql 中的种子数据保持一致。
// ResetUnitCosts 调用时写回此默认值。
const defaultUnitCostsJSON = `{
  "ai_distill": {"title": "AI蒸馏(次)", "points": 1, "unit": "次", "charge_type": "both", "quota_metric": "ai_distills"},
  "article_generation": {"title": "创作文章(篇)", "points": 1, "unit": "篇", "charge_type": "both", "quota_metric": "article_generations"},
  "article_publish": {"title": "投稿文章(篇)", "points": 0, "unit": "篇", "charge_type": "quota_only", "quota_metric": "publish_tasks"},
  "article_replicate": {"title": "复刻爆文(篇)", "points": 2, "unit": "篇", "charge_type": "both", "quota_metric": "article_generations"},
  "article_with_knowledge": {"title": "创作文章附带知识库(篇)", "points": 1, "unit": "篇", "charge_type": "both", "quota_metric": "article_generations"},
  "inclusion_query": {"title": "查询收录(问题/次)", "points": 0, "unit": "问题/次", "charge_type": "open", "quota_metric": ""},
  "online_inclusion_query": {"title": "联网查收录(每次)", "points": 0, "unit": "次", "charge_type": "open", "quota_metric": ""},
  "index_query": {"title": "指数查询/次", "points": 10, "unit": "次", "charge_type": "points_only", "quota_metric": ""},
  "seo_publish": {"title": "seo发布/篇", "points": 1, "unit": "篇", "charge_type": "both", "quota_metric": "publish_tasks"},
  "screenshot_inclusion_query": {"title": "带截图查收录(元/次)", "points": 0, "unit": "元/次", "charge_type": "open", "quota_metric": ""},
  "ai_diagnosis": {"title": "AI诊断(元/次)", "points": 10, "unit": "次", "charge_type": "points_only", "quota_metric": ""},
  "ai_diagnosis_with_suggestion": {"title": "AI诊断+优化建议(元/次)", "points": 2, "unit": "次", "charge_type": "points_only", "quota_metric": ""}
}`

// unitCostValue 是 JSON 反序列化的中间结构（key=action）。
type unitCostValue struct {
	Title       string  `json:"title"`
	Points      float64 `json:"points"`
	Unit        string  `json:"unit"`
	ChargeType  string  `json:"charge_type"`
	QuotaMetric string  `json:"quota_metric"`
}

// actionRegistryValue 是 action_registry JSON 反序列化的中间结构。
type actionRegistryValue struct {
	Implemented bool   `json:"implemented"`
	BizEntry    string `json:"biz_entry"`
	Status      string `json:"status"`
}

// parseUnitCosts 将 cfg_system_settings.value_json 解析为有序列表。
func parseUnitCosts(jsonStr string) ([]*UnitCost, error) {
	raw := map[string]unitCostValue{}
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return nil, err
	}
	out := make([]*UnitCost, 0, len(raw))
	for action, v := range raw {
		out = append(out, &UnitCost{
			Action: action, Title: v.Title, Points: v.Points,
			Unit: v.Unit, ChargeType: v.ChargeType, QuotaMetric: v.QuotaMetric,
		})
	}
	return out, nil
}

// serializeUnitCosts 将 UnitCost 列表序列化为 {action: {...}} 格式 JSON。
func serializeUnitCosts(costs []*UnitCost) ([]byte, error) {
	m := make(map[string]unitCostValue, len(costs))
	for _, c := range costs {
		m[c.Action] = unitCostValue{
			Title: c.Title, Points: c.Points, Unit: c.Unit,
			ChargeType: c.ChargeType, QuotaMetric: c.QuotaMetric,
		}
	}
	return json.Marshal(m)
}

// parseActionRegistry 将 cfg_system_settings.value_json 解析为注册表列表。
func parseActionRegistry(jsonStr string) ([]*ActionRegistryEntry, error) {
	raw := map[string]actionRegistryValue{}
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return nil, err
	}
	out := make([]*ActionRegistryEntry, 0, len(raw))
	for action, v := range raw {
		out = append(out, &ActionRegistryEntry{
			Action: action, Implemented: v.Implemented, BizEntry: v.BizEntry, Status: v.Status,
		})
	}
	return out, nil
}
