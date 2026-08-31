-- Add monitor_terminal to geo_monitor_plans to support parallel PC + Mobile monitoring
ALTER TABLE geo_monitor_plans
  ADD COLUMN monitor_terminal TINYINT UNSIGNED NOT NULL DEFAULT 3
  COMMENT '监测终端: 1=电脑端 2=移动端 3=并行(PC+移动端)'
  AFTER schedule_type;
