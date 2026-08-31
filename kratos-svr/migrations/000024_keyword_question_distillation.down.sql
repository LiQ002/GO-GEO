DROP TABLE IF EXISTS cnt_keyword_distillation_tasks;

ALTER TABLE cnt_questions
  DROP KEY idx_question_distillation_task,
  DROP COLUMN distillation_task_id,
  DROP COLUMN source,
  DROP COLUMN region;

ALTER TABLE cnt_keywords
  DROP KEY idx_keyword_distillation_status,
  DROP COLUMN distillation_error,
  DROP COLUMN last_distillation_task_id,
  DROP COLUMN distillation_status,
  DROP COLUMN distilled_question_count,
  DROP COLUMN requested_question_count,
  DROP COLUMN region;
