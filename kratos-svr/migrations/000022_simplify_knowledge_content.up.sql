ALTER TABLE kb_documents
  ADD COLUMN category TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER knowledge_base_id,
  ADD COLUMN content LONGTEXT NULL AFTER title,
  ADD KEY idx_kb_document_tenant_category (enterprise_id, category, updated_at);
