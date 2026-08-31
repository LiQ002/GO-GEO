ALTER TABLE kb_documents
  DROP KEY idx_kb_document_tenant_category,
  DROP COLUMN content,
  DROP COLUMN category;
