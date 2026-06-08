-- =============================================================================
-- VibeNovel Sprint 10 — Payment topup data model (Task 10.1)
-- Additive only: credit_topup_products, credit_topup_orders, payment_webhook_events
-- Enums align @vibenovel/shared | Mayar integration schema only — no HTTP/webhook
-- credit_ledger_direction unchanged — topup grant uses direction=credit (Task 10.3)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums (align packages/shared/src/enums.ts — Sprint 10 section)
-- -----------------------------------------------------------------------------
CREATE TYPE public.credit_topup_order_status AS ENUM (
  'pending',
  'paid',
  'expired',
  'failed',
  'cancelled'
);

CREATE TYPE public.payment_webhook_processing_status AS ENUM (
  'received',
  'processed',
  'ignored',
  'failed'
);

-- -----------------------------------------------------------------------------
-- Audit enum extension (Sprint 10 — payment topup lifecycle)
-- Writers deferred to Task 10.2/10.3
-- -----------------------------------------------------------------------------
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'credit_topup_product';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'credit_topup_order';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'payment_webhook_event';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'credit_topup_checkout_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_invoice_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_webhook_received';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_webhook_processed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_webhook_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'credit_topup_granted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'credit_topup_grant_failed';

-- -----------------------------------------------------------------------------
-- credit_topup_products (server-authoritative catalog — proposal pricing in seed)
-- -----------------------------------------------------------------------------
CREATE TABLE public.credit_topup_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_idr integer NOT NULL CHECK (price_idr > 0),
  credits integer NOT NULL CHECK (credits > 0),
  bonus_credits integer NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_topup_products_is_active_sort_order_idx
  ON public.credit_topup_products (is_active, sort_order);

CREATE TRIGGER credit_topup_products_set_updated_at
  BEFORE UPDATE ON public.credit_topup_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- credit_topup_orders (checkout session — mutations via service_role API only)
-- provider_payload_safe: sanitized Mayar response — no API keys
-- -----------------------------------------------------------------------------
CREATE TABLE public.credit_topup_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.credit_topup_products (id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'mayar',
  provider_invoice_id text,
  provider_transaction_id text,
  payment_url text,
  amount_idr integer NOT NULL CHECK (amount_idr > 0),
  credits_to_grant integer NOT NULL CHECK (credits_to_grant > 0),
  status public.credit_topup_order_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  provider_payload_safe jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_topup_orders_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX credit_topup_orders_user_id_created_at_idx
  ON public.credit_topup_orders (user_id, created_at DESC);

CREATE INDEX credit_topup_orders_status_idx
  ON public.credit_topup_orders (status);

CREATE UNIQUE INDEX credit_topup_orders_provider_invoice_id_unique_idx
  ON public.credit_topup_orders (provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX credit_topup_orders_provider_transaction_id_unique_idx
  ON public.credit_topup_orders (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX credit_topup_orders_provider_invoice_id_idx
  ON public.credit_topup_orders (provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;

CREATE INDEX credit_topup_orders_provider_transaction_id_idx
  ON public.credit_topup_orders (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE TRIGGER credit_topup_orders_set_updated_at
  BEFORE UPDATE ON public.credit_topup_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- payment_webhook_events (operational log — service_role only, append-only)
-- payload_safe_json: redacted webhook body — no secrets
-- -----------------------------------------------------------------------------
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mayar',
  provider_event_id text,
  provider_transaction_id text,
  provider_invoice_id text,
  event_type text,
  payload_hash text NOT NULL,
  payload_safe_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processing_status public.payment_webhook_processing_status NOT NULL DEFAULT 'received',
  error_message_safe text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_events_provider_payload_hash_unique
    UNIQUE (provider, payload_hash)
);

CREATE INDEX payment_webhook_events_provider_event_id_idx
  ON public.payment_webhook_events (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX payment_webhook_events_provider_transaction_id_idx
  ON public.payment_webhook_events (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX payment_webhook_events_provider_invoice_id_idx
  ON public.payment_webhook_events (provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;

CREATE INDEX payment_webhook_events_processing_status_idx
  ON public.payment_webhook_events (processing_status);

CREATE INDEX payment_webhook_events_created_at_idx
  ON public.payment_webhook_events (created_at DESC);

-- -----------------------------------------------------------------------------
-- Seed credit packages (proposal pricing — metadata.proposalPricing=true)
-- credits_to_grant at checkout = credits + bonus_credits (computed by API Task 10.2)
-- -----------------------------------------------------------------------------
INSERT INTO public.credit_topup_products (
  slug,
  name,
  description,
  price_idr,
  credits,
  bonus_credits,
  is_active,
  sort_order,
  metadata
) VALUES
  (
    'starter',
    'Paket Starter',
    '100 kredit untuk mulai menulis — harga proposal early adopter.',
    39000,
    100,
    0,
    true,
    10,
    '{"proposalPricing": true, "recommended": false}'::jsonb
  ),
  (
    'creator',
    'Paket Creator',
    '300 kredit + 20 bonus — paket yang direkomendasikan untuk penulis serial.',
    99000,
    300,
    20,
    true,
    20,
    '{"proposalPricing": true, "recommended": true}'::jsonb
  ),
  (
    'pro',
    'Paket Pro',
    '700 kredit + 50 bonus — untuk produksi bab rutin.',
    199000,
    700,
    50,
    true,
    30,
    '{"proposalPricing": true, "recommended": false}'::jsonb
  ),
  (
    'studio',
    'Paket Studio',
    '1500 kredit + 150 bonus — volume tinggi untuk studio/KBM aktif.',
    399000,
    1500,
    150,
    true,
    40,
    '{"proposalPricing": true, "recommended": false}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_idr = EXCLUDED.price_idr,
  credits = EXCLUDED.credits,
  bonus_credits = EXCLUDED.bonus_credits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.credit_topup_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_topup_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Products: authenticated read active catalog only
CREATE POLICY credit_topup_products_select_active ON public.credit_topup_products
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Orders: owner read only — no direct client INSERT/UPDATE/DELETE
CREATE POLICY credit_topup_orders_select_own ON public.credit_topup_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Webhook events: operational — no authenticated access
-- (service_role bypasses RLS)

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.credit_topup_products TO authenticated;
GRANT SELECT ON public.credit_topup_products TO anon;
GRANT ALL ON public.credit_topup_products TO service_role;

GRANT SELECT ON public.credit_topup_orders TO authenticated;
GRANT ALL ON public.credit_topup_orders TO service_role;

GRANT ALL ON public.payment_webhook_events TO service_role;

-- =============================================================================
-- Sprint 10 guardrails (Task 10.1 — schema only):
--   • No checkout API, webhook endpoint, or credit grant in this migration
--   • credit_ledger direction=credit + reason=credit_topup deferred to Task 10.3
--   • provider_payload_safe / payload_safe_json must not store API keys or secrets
--   • Client must not mutate orders or balances directly — API service_role only
--   • payment_webhook_events not exposed to authenticated users
-- =============================================================================