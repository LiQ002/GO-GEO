ALTER TABLE ent_plans
  DROP KEY idx_ent_plans_series;

ALTER TABLE ent_plans
  DROP COLUMN granted_points,
  DROP COLUMN series_code,
  DROP COLUMN sort_order,
  DROP COLUMN visible_to_enterprise,
  DROP COLUMN billing_cycle,
  DROP COLUMN currency,
  DROP COLUMN yearly_price_minor_units,
  DROP COLUMN monthly_price_minor_units,
  DROP COLUMN description;
