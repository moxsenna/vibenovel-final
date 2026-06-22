# REMINDER — Uji Admin Dashboard (Sprint A + B)

**Untuk:** Founder / operator  
**Kapan:** Setelah `supabase start`, `npm run dev:api`, `npm run dev:web` jalan.

## 1. Jadikan akun admin

Di Supabase SQL atau Table Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'email-kamu@...';
```

## 2. Smoke API (PowerShell, repo root)

```bash
npm run smoke:api:admin
```

Harapan: writer → `FORBIDDEN`, admin → list users OK, grant → `NOT_IMPLEMENTED`.

## 3. UI manual

| Langkah | Harapan |
|---------|---------|
| Login writer, buka `/admin` | Redirect ke `/dashboard` |
| Login admin, buka `/admin` | Overview KPI angka (bukan semua 0 jika ada data) |
| `/admin/users` → detail | Profil + saldo/ledger |
| Grant kredit submit | Pesan *Fitur dalam pengembangan oleh Codex.* |
| `/admin/projects`, `/admin/proposals`, `/admin/generation-attempts` | Tabel data atau empty state |
| `/admin/system` | Flag env (AI enabled, dll.) |
| `/admin/audit-logs` | Baris dari `audit_logs` |

## 4. Perintah cepat

```bash
node apps/api/scripts/test-admin-guard.mjs
npm run typecheck
```

---

*Dibuat otomatis saat penyelesaian Admin Sprint B — hapus atau centang setelah uji selesai.*