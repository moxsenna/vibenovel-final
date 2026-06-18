-- Narraza Credit System v2 — additive top-up catalog update.
-- Existing product ids remain stable so historical orders keep their FK target.

begin;

insert into public.credit_topup_products (
  slug,
  name,
  description,
  price_idr,
  credits,
  bonus_credits,
  is_active,
  sort_order,
  metadata
)
values
  (
    'starter',
    'Starter',
    'Paket awal untuk mencoba alur menulis dengan AI.',
    49000,
    20000,
    0,
    true,
    10,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'entry',
      'recommended', false
    )
  ),
  (
    'creator',
    'Creator',
    'Paket rekomendasi untuk penulis serial aktif.',
    99000,
    50000,
    5000,
    true,
    20,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'recommended',
      'recommended', true,
      'badge', 'Best Seller'
    )
  ),
  (
    'pro',
    'Pro',
    'Paket untuk produksi bab rutin dan proyek panjang.',
    199000,
    120000,
    10000,
    true,
    30,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'serious_writer',
      'recommended', false
    )
  ),
  (
    'studio',
    'Studio',
    'Paket volume tinggi untuk studio dan penulis produktif.',
    399000,
    270000,
    30000,
    true,
    40,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'best_value',
      'recommended', false,
      'badge', 'Best Value'
    )
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_idr = excluded.price_idr,
  credits = excluded.credits,
  bonus_credits = excluded.bonus_credits,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

commit;
