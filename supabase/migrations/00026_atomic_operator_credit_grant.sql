-- Long-fiction hardening: atomic operator credit grant RPC.
-- The grant-credits-operator.ps1 script previously bumped credit_balances and
-- then POSTed credit_ledger as two separate PostgREST calls; if the ledger
-- write failed after the balance update, the idempotency check found no ledger
-- row and a rerun double-granted credits. This RPC performs the idempotency
-- check, balance upsert, and ledger insert in a single transaction, mirroring
-- grant_paid_credit_topup_atomic (00010) but for manual admin/welcome grants
-- that are not tied to a paid topup order.

-- Race-safe idempotency backstop: one operator-grant ledger row per
-- (user, idempotencyKey).
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_operator_grant_idem_unique_idx
  ON public.credit_ledger (user_id, (metadata->>'idempotencyKey'))
  WHERE direction = 'credit'::public.credit_ledger_direction
    AND metadata->>'idempotencyKey' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_operator_credit_atomic(
  p_user_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_reason text DEFAULT 'welcome_bonus',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_ledger_id uuid;
  v_existing_balance_after integer;
  v_balance integer;
  v_new_balance integer;
  v_ledger_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL
     OR p_amount IS NULL OR p_amount <= 0
     OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: a prior grant with this key already happened.
  SELECT cl.id, cl.balance_after
  INTO v_existing_ledger_id, v_existing_balance_after
  FROM public.credit_ledger cl
  WHERE cl.user_id = p_user_id
    AND cl.direction = 'credit'::public.credit_ledger_direction
    AND cl.metadata->>'idempotencyKey' = p_idempotency_key
  LIMIT 1;

  IF v_existing_ledger_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'already_granted', true,
      'user_id', p_user_id,
      'new_balance', v_existing_balance_after,
      'ledger_id', v_existing_ledger_id,
      'reason', 'already_granted'
    );
  END IF;

  INSERT INTO public.credit_balances (user_id, balance, monthly_quota, monthly_used, source)
  VALUES (p_user_id, 0, 0, 0, 'ledger'::public.credit_balance_source)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT cb.balance
  INTO v_balance
  FROM public.credit_balances cb
  WHERE cb.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing_user_balance_row' USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_balance + p_amount;

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
      p_user_id,
      NULL,
      NULL,
      p_amount,
      'credit'::public.credit_ledger_direction,
      p_reason,
      v_new_balance,
      jsonb_build_object(
        'idempotencyKey', p_idempotency_key,
        'note', p_note,
        'grantedBy', 'grant-credits-operator.ps1'
      )
    )
    RETURNING id INTO v_ledger_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Concurrent grant with the same key won the race; report it as already
      -- granted without touching the balance again.
      SELECT cl.id, cl.balance_after
      INTO v_ledger_id, v_existing_balance_after
      FROM public.credit_ledger cl
      WHERE cl.user_id = p_user_id
        AND cl.direction = 'credit'::public.credit_ledger_direction
        AND cl.metadata->>'idempotencyKey' = p_idempotency_key
      LIMIT 1;

      RETURN jsonb_build_object(
        'granted', false,
        'already_granted', true,
        'user_id', p_user_id,
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
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'granted', true,
    'already_granted', false,
    'user_id', p_user_id,
    'previous_balance', v_balance,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id,
    'reason', p_reason
  );
END;
$$;

-- Operator-only: never reachable by anon/authenticated PostgREST callers; only
-- the service role (used by the operator script) may execute it.
REVOKE ALL ON FUNCTION public.grant_operator_credit_atomic(
  uuid, integer, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.grant_operator_credit_atomic(
  uuid, integer, text, text, text
) TO service_role;
