UPDATE cnt_questions
SET status = 1,
    version = version + 1,
    updated_at = UTC_TIMESTAMP(6)
WHERE source = 2
  AND status = 2
  AND deleted_at IS NULL;
