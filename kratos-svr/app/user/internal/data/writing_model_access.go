package data

import "kratos-svr/internal/data/model"

const writingModelAccessSQL = "(" + model.TableWritingModels + ".access_scope = 1" +
	" OR EXISTS (SELECT 1 FROM " + model.TableWritingModelEntScopes + " AS model_enterprise_scope" +
	" WHERE model_enterprise_scope.writing_model_id = " + model.TableWritingModels + ".id AND model_enterprise_scope.enterprise_id = ?)" +
	" OR EXISTS (SELECT 1 FROM " + model.TableWritingModelPlanScopes + " AS model_plan_scope" +
	" JOIN " + model.TableSubscriptions + " AS model_subscription ON model_subscription.plan_id = model_plan_scope.plan_id" +
	" WHERE model_plan_scope.writing_model_id = " + model.TableWritingModels + ".id" +
	" AND model_subscription.enterprise_id = ? AND model_subscription.status = 'active'" +
	" AND model_subscription.starts_at <= UTC_TIMESTAMP(6) AND model_subscription.expires_at > UTC_TIMESTAMP(6)" +
	" AND model_subscription.deleted_at IS NULL)" +
	" OR EXISTS (SELECT 1 FROM " + model.TableEnterpriseModelGrants + " AS legacy_model_grant" +
	" WHERE legacy_model_grant.writing_model_id = " + model.TableWritingModels + ".id" +
	" AND legacy_model_grant.enterprise_id = ? AND legacy_model_grant.enabled = TRUE" +
	" AND legacy_model_grant.deleted_at IS NULL))"

func writingModelAccessArgs(enterpriseID uint64) []any {
	return []any{enterpriseID, enterpriseID, enterpriseID}
}
