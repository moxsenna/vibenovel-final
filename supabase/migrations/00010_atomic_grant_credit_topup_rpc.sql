-- =============================================================================
-- Sprint 10 Task 10.16 — Atomic credit topup grant RPC
-- Single-transaction grant: order paid + ledger + balance
-- HMAC/signature validation remains API responsibility
-- =============================================================================

-- One topup ledger row per order (race-safe idempotency backstop)
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_topup_order_id_unique_idx
  ON public.credit_ledger ((metadata->>'orderId'))
  WHERE direction = 'credit'::public.credit_ledger_direction
    AND reason = 'credit_topup';

-- -----------------------------------------------------------------------------
-- grant_paid_credit_topup_atomic
-- Returns jsonb:
--   granted, already_granted, order_id, user_id, credits,
--   previous_balance, new_balance, ledger_id, reason
-- Soft failures use reason (no grant); duplicate returns already_granted=true
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_paid_credit_topup_atomic(
  p_order_id uuid,
  p_provider text DEFAULT NULL,
  p_provider_invoice_id text DEFAULT NULL,
  p_provider_transaction_id text DEFAULT NULL,
  p_amount_idr integer DEFAULT NULL,
  p_webhook_event_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.credit_topup_orders%ROWTYPE;
  v_existing_ledger_id uuid;
  v_existing_balance_after integer;
  v_balance integer;
  v_new_balance integer;
  v_ledger_id uuid;
  v_metadata jsonb;
  v_now timestamptz := now();
BEGIN
  SELECT *
  INTO v_order
  FROM public.credit_topup_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', false,
      'reason', 'unknown_order'
    );
  END IF;

  IF p_provider IS NOT NULL AND v_order.provider IS DISTINCT FROM p_provider THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', false,
      'order_id', v_order.id,
      'user_id', v_order.user_id,
      'reason', 'provider_mismatch'
    );
  END IF;

  IF p_amount_idr IS NOT NULL AND v_order.amount_idr IS DISTINCT FROM p_amount_idr THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', false,
      'order_id', v_order.id,
      'user_id', v_order.user_id,
      'reason', 'amount_mismatch'
    );
  END IF;

  SELECT cl.id, cl.balance_after
  INTO v_existing_ledger_id, v_existing_balance_after
  FROM public.credit_ledger cl
  WHERE cl.user_id = v_order.user_id
    AND cl.direction = 'credit'::public.credit_ledger_direction
    AND cl.reason = 'credit_topup'
    AND cl.metadata->>'orderId' = v_order.id::text
  LIMIT 1;

  IF v_existing_ledger_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'order_id', v_order.id,
      'user_id', v_order.user_id,
      'credits', v_order.credits_to_grant,
      'previous_balance', NULL,
      'new_balance', v_existing_balance_after,
      'ledger_id', v_existing_ledger_id,
      'reason', 'already_granted'
    );
  END IF;

  IF v_order.status = 'paid'::public.credit_topup_order_status THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', false,
      'order_id', v_order.id,
      'user_id', v_order.user_id,
      'reason', 'paid_without_ledger'
    );
  END IF;

  IF v_order.status IS DISTINCT FROM 'pending'::public.credit_topup_order_status THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', false,
      'order_id', v_order.id,
      'user_id', v_order.user_id,
      'reason', 'invalid_status'
    );
  END IF;

  IF v_order.credits_to_grant IS NULL OR v_order.credits_to_grant <= 0 THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', false,
      'order_id', v_order.id,
      'user_id', v_order.user_id,
      'reason', 'invalid_credits'
    );
  END IF;

  INSERT INTO public.credit_balances (user_id, balance, monthly_quota, monthly_used, source)
  VALUES (v_order.user_id, 0, 0, 0, 'ledger'::public.credit_balance_source)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT cb.balance
  INTO v_balance
  FROM public.credit_balances cb
  WHERE cb.user_id = v_order.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing_user_balance_row' USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_balance + v_order.credits_to_grant;

  v_metadata := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'orderId', v_order.id,
    'productId', v_order.product_id,
    'provider', v_order.provider,
    'providerInvoiceId', COALESCE(p_provider_invoice_id, v_order.provider_invoice_id),
    'providerTransactionId', COALESCE(p_provider_transaction_id, v_order.provider_transaction_id),
    'webhookEventId', p_webhook_event_id
  );

  BEGIN
    INSERT INTO public.credit_ledger (
      user_id,
      project_id,
      attempt_id,
      amount,
      direction,
      reason,
      balance_after,
      metadata
    )
    VALUES (
      v_order.user_id,
      NULL,
      NULL,
      v_order.credits_to_grant,
      'credit'::public.credit_ledger_direction,
      'credit_topup',
      v_new_balance,
      v_metadata
    )
    RETURNING id INTO v_ledger_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT cl.id, cl.balance_after
      INTO v_ledger_id, v_existing_balance_after
      FROM public.credit_ledger cl
      WHERE cl.user_id = v_order.user_id
        AND cl.metadata->>'orderId' = v_order.id::text
        AND cl.reason = 'credit_topup'
      LIMIT 1;

      RETURN jsonb_build_object(
        'granted', false,
        'already_granted', true,
        'order_id', v_order.id,
        'user_id', v_order.user_id,
        'credits', v_order.credits_to_grant,
        'new_balance', v_existing_balance_after,
        'ledger_id', v_ledger_id,
        'reason', 'already_granted'
      );
  END;

  UPDATE public.credit_balances
  SET
    balance = v_new_balance,
    source = 'ledger'::public.credit_balance_source,
    updated_at = v_now
  WHERE user_id = v_order.user_id;

  UPDATE public.credit_topup_orders
  SET
    status = 'paid'::public.credit_topup_order_status,
    paid_at = v_now,
    updated_at = v_now,
    provider_invoice_id = COALESCE(v_order.provider_invoice_id, p_provider_invoice_id),
    provider_transaction_id = COALESCE(v_order.provider_transaction_id, p_provider_transaction_id)
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'granted', true,
    'already_granted', false,
    'order_id', v_order.id,
    'user_id', v_order.user_id,
    'credits', v_order.credits_to_grant,
    'previous_balance', v_balance,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id,
    'reason', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_paid_credit_topup_atomic(
  uuid, text, text, text, integer, uuid, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.grant_paid_credit_topup_atomic(
  uuid, text, text, text, integer, uuid, jsonb
) TO service_role;

-- =============================================================================
-- Task 10.16 guardrails:
--   • Does not verify Duitku/Mayar signatures — API only
--   • Idempotent duplicate callbacks return already_granted without error
--   • Unique index on ledger metadata orderId prevents double grant races
-- =============================================================================