## ⚠️ Konteks & urgensi

Karena akun AWS sudah ditutup dan semua instance dihapus, **`api.narraza.web.id` kemungkinan besar sudah OFFLINE sekarang** (dulu di EC2 + Caddy). Frontend (`narraza.web.id`, `app.narraza.web.id`) tetap jalan di Cloudflare Pages, tapi **dashboard akan error saat memanggil API** sampai API berdiri lagi.

Konsekuensi penting: **tidak ada lagi rollback ke AWS**. Jadi urutannya wajib **"dirikan dulu API di Cloudflare Workers → baru bersihkan file"**, bukan sebaliknya.

> Catatan: "Cloudflare **Pages**" hanya untuk situs statis/SPA — tidak bisa menjalankan server API Hono ini. Padanan yang benar untuk API adalah **Cloudflare Workers**. Kabar baiknya, staging Worker (`vibenovel-api-staging`) sudah jalan, jadi jalur Workers sudah terbukti kompatibel.
>

---

## 🎯 Arsitektur target

| Komponen | Domain | Platform | Status |
| --- | --- | --- | --- |
| Homepage | `narraza.web.id` | CF Pages `narraza-homepage-production` | ✅ tetap |
| Web dashboard | `app.narraza.web.id` | CF Pages `narraza-web-production` | ✅ tetap |
| **API** | `api.narraza.web.id` | **CF Workers `vibenovel-api` (env production, baru)** | 🔧 dibuat |
| Staging Worker/Pages | `*.pages.dev` / staging | CF Workers + Pages | ⏸️ disimpan dulu |

---

## 🚀 FASE 1 — Dirikan API production di Workers (PRIORITAS, time-sensitive)

**1.1 Tambahkan blok `[env.production]` di `apps/api/wrangler.toml`**

Saat ini hanya ada base + `[env.staging]`. Tambahkan environment production untuk domain production dan provider live:

```toml
[env.production]
name = "vibenovel-api"

[[env.production.routes]]
pattern = "api.narraza.web.id"
custom_domain = true

[env.production.vars]
APP_ENV = "production"
ALLOWED_ORIGINS = "https://narraza.web.id,https://www.narraza.web.id,https://app.narraza.web.id"

# OpenRouter live
AI_GENERATION_ENABLED = "true"
AI_PROVIDER_MOCK = "false"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
AI_MODEL_HEMAT = "google/gemini-2.5-flash"

# Duitku live
CREDIT_TOPUP_ENABLED = "true"
PAYMENT_PROVIDER = "duitku"
PAYMENT_PROVIDER_MOCK = "false"
DUITKU_ENV = "production"
DUITKU_CALLBACK_URL = "https://api.narraza.web.id/api/payments/duitku/callback"
DUITKU_RETURN_URL = "https://app.narraza.web.id/credits/topup/return"
```

Keputusan sekarang: **langsung live OpenRouter + live Duitku**. Jangan deploy production live payment jika `DUITKU_MERCHANT_CODE` / `DUITKU_MERCHANT_KEY` production belum tersedia. Jangan memakai `.env.staging.duitku` untuk production kecuali secara sadar ingin sandbox di domain production.

**1.2 Pasang secrets production** (jangan taruh di file yang committed — pakai secret store Workers):

```bash
cd apps/api
wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_ANON_KEY --env production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
wrangler secret put OPENROUTER_API_KEY --env production
wrangler secret put DUITKU_MERCHANT_CODE --env production
wrangler secret put DUITKU_MERCHANT_KEY --env production
```

Atau gunakan operator script dari repo root:

```bash
npm run operator:production:worker-secrets -- -RequireLiveDuitku
```

Script ini membaca `.env.production`, menolak staging Supabase ref, menolak live Duitku tanpa credential production, upload secret ke Worker production, deploy, lalu health smoke. Secret values tidak dicetak.

**1.3 Deploy & uji di URL `*.workers.dev` dulu** (sebelum mengandalkan domain):

```bash
npm run deploy:api:production
# uji health:
curl https://vibenovel-api.<akun>.workers.dev/api/health
```

**1.4 Verifikasi kompatibilitas Workers**

- Pastikan `compatibility_flags = ["nodejs_compat"]` ada (jalur Worker memakai `src/index.ts` → `export default createApp()`, factory bersih di `app.ts`).
- `node-server.ts` (yang impor `ws` & `@hono/node-server`) **tidak ikut** di jalur Worker, jadi bukan blocker.

---

## 🔀 FASE 2 — Cutover domain `api.narraza.web.id`

1. Di dashboard Cloudflare → Worker `vibenovel-api` → **Custom Domains** → tambahkan `api.narraza.web.id` (atau via route di wrangler.toml).
2. Pastikan record DNS lama yang menunjuk ke IP EC2 sudah dihapus/diganti (karena EC2 sudah mati, record itu kini menunjuk ke ketiadaan). **Custom Domain Worker akan gagal attach jika `api.narraza.web.id` masih punya A/CNAME eksternal.** Jalankan penghapusan record lama hanya setelah secret live lengkap dan dry-run lulus.
3. Smoke test end-to-end:
    - `curl https://api.narraza.web.id/api/health`
    - Buka `app.narraza.web.id`, cek login/flow utama, pastikan CORS lolos (origin sudah di-allow).
4. Pantau log: `wrangler tail --env production`.
5. Health expected:
    - `appEnv=production`
    - `aiGenerationEnabled=true`
    - `aiProviderMock=false`
    - `hasOpenRouterApiKey=true`
    - `creditTopupEnabled=true`
    - `paymentProvider=duitku`
    - `paymentProviderMock=false`
    - `hasDuitkuMerchantCode=true`
    - `hasDuitkuMerchantKey=true`
    - `duitkuEnv=production`

---

## 🧹 FASE 3 — Bersihkan file AWS (production + staging AWS) SEKARANG

Lakukan **setelah Fase 1–2 hijau**. Berikut inventaris pastinya:

### 🗑️ HAPUS (artefak AWS/EC2/Docker/Caddy — production & staging AWS)

- `apps/api/Dockerfile`
- `docker-compose.production.yml`
- `docker-compose.staging.yml`
- `.dockerignore`
- `deploy/ec2/bootstrap-ubuntu.sh`
- `deploy/ec2/deploy-app.sh`
- `deploy/ec2/deploy-app-production.sh`
- `deploy/caddy/` (seluruh folder)
- `.env.staging.example`
- `.env.staging.duitku.example`
- Script operator AWS di `scripts/`:
    - `operator-aws-ec2-staging-smoke.ps1`
    - `operator-aws-https-web-gate.ps1`
    - `operator-aws-duitku-mode-b.ps1`
    - `operator-production-ec2-provision.ps1`
    - `operator-production-aws-deploy.ps1`

### ✏️ EDIT

- **`package.json`** — hapus baris script yang menunjuk file di atas:
    - `operator:aws:staging:smoke`, `operator:aws:https:gate`, `operator:aws:duitku:gate`, `operator:production:ec2:provision`, `operator:production:aws:deploy`
    - Tinjau juga (apakah masih kepakai tanpa AWS): `operator:production:api-web:deploy`, `operator:production:infra:unblock`, `operator:production:sync-env`
    - Tambahkan script baru: `"deploy:api:production": "cd apps/api && wrangler deploy --env production"`
- **`.env.production.example`** — buang catatan "EC2 + Caddy", ganti komentar domain API jadi "Cloudflare Workers". `PORT=8787` tidak relevan untuk Workers (boleh ditandai "Node lokal saja").
- **`.github/` workflows** (jika ada step deploy ke AWS/SSH/Docker) — hapus/ganti ke `wrangler deploy --env production`.
- **`docs/`** — perbarui dokumen arsitektur/deploy: API kini di Workers, bukan EC2.

### ✅ SIMPAN

- Semua di `apps/web`, `apps/homepage`, `apps/api/src/**`, `packages/**`.
- Script CF: `deploy:web:production`, `deploy:homepage:production`, `deploy:web:staging`, `deploy:api:staging`.
- **Seluruh konfigurasi staging Cloudflare**: `[env.staging]` di wrangler.toml, `vibenovel-web-staging`, `operator-staging-worker-secrets.ps1` → **disimpan sesuai keputusan Anda**.

> Catatan soal `node-server.ts`, `node-bindings.ts`, dan dependency `ws` / `@hono/node-server`: **jangan dihapus** kecuali Anda yakin tak butuh menjalankan API secara lokal via Node. Ini tidak terkait AWS, hanya jalur runtime lokal. Aman dibiarkan.
>

---

## ⏸️ FASE 4 — Staging Cloudflare (nanti)

Sesuai pilihan Anda, staging Cloudflare **dipertahankan** sebagai tempat uji pra-production. Setelah production Worker terbukti stabil (mis. 1–2 minggu tanpa insiden), baru pertimbangkan menghapus: `[env.staging]`, project `vibenovel-web-staging`, `deploy:*:staging`, dan `operator-staging-worker-secrets.ps1`. Saya bisa buatkan rencana terpisah saat itu.

---

## ✔️ Checklist verifikasi akhir

- [ ]  `curl https://api.narraza.web.id/api/health` → 200 dan flags live sesuai Fase 2
- [ ]  Login & flow utama di `app.narraza.web.id` jalan (tanpa error CORS)
- [ ]  OpenRouter smoke minimal: satu flow AI authenticated berhasil dan kredit tercatat
- [ ]  Duitku smoke minimal: checkout membuat invoice live Duitku; callback URL public; jangan grant kredit tanpa callback valid
- [ ]  `wrangler tail --env production` bersih dari error
- [ ]  `npm run build` / typecheck tetap hijau setelah file dihapus
- [ ]  Tidak ada referensi tersisa ke file yang dihapus (cek `package.json`, workflow, docs)
