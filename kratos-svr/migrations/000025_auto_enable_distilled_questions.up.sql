UPDATE cnt_questions
SET status = 2,
    version = version + 1,
    updated_at = UTC_TIMESTAMP(6)
WHERE source = 2
  AND status = 1
  AND deleted_at IS NULL;
