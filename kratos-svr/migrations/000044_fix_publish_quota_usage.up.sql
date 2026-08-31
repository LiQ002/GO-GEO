-- Fix publish_tasks quota used_value to match actual succeeded task count
-- This migration corrects the quota usage for publish_tasks metric by recalculating
-- used_value based on the actual number of succeeded publish tasks.

UPDATE ent_quota_limits ql
INNER JOIN (
    SELECT enterprise_id, COUNT(*) AS succeeded_count
    FROM pub_tasks
    WHERE status = 'succeeded'
    GROUP BY enterprise_id
) t ON ql.enterprise_id = t.enterprise_id AND ql.metric = 'publish_tasks'
SET ql.used_value = t.succeeded_count,
    ql.reserved_value = 0;

-- Also reset any remaining reserved_value for publish_tasks (leftover from the bug)
UPDATE ent_quota_limits
SET reserved_value = 0
WHERE metric = 'publish_tasks' AND reserved_value > 0;
