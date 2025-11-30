CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_documents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(3072),
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_documents_tenant ON ai_documents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_documents_embed ON ai_documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
