CREATE TABLE IF NOT EXISTS widget_configs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  widget_public_key TEXT NOT NULL,
  widget_secret TEXT NOT NULL,
  allowed_origins TEXT[] NOT NULL,
  locale TEXT DEFAULT 'tr-TR',
  theme TEXT DEFAULT 'light',
  kvkk_text TEXT,
  form_defaults JSONB,
  notification_preferences JSONB,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, widget_public_key)
);

CREATE TABLE IF NOT EXISTS widget_reservations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  config_id BIGINT REFERENCES widget_configs(id) ON DELETE CASCADE,
  external_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'widget',
  checkin_date DATE,
  checkout_date DATE,
  baggage_count INT,
  locker_size TEXT,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  notes TEXT,
  kvkk_approved BOOLEAN NOT NULL DEFAULT FALSE,
  origin TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  request_body JSONB NOT NULL,
  signature TEXT,
  status_code INT,
  error TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_widget_reservations_tenant ON widget_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_widget_configs_tenant ON widget_configs(tenant_id);
