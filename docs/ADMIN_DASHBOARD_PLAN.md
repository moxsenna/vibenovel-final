# Narraza Admin Dashboard Plan

Status: Proposed Implementation Plan  
Document Purpose: Agent-readable and human-readable implementation plan for building the Narraza Admin Dashboard.  
Product Name: Narraza  
Historical Name References: Some older docs may still say VibeNovel or Novory. Use Narraza in UI copy and new code.

---

## 0. Non-Negotiable Context

Narraza is not a generic AI chatbot and must not be built as a one-click novel generator. Narraza is an AI Serial Fiction Production OS for long-form mobile serial fiction.

The admin dashboard is not only a CRUD panel. It is an operational control room for private beta and public-launch readiness.

The admin dashboard must help the team answer these questions:

```txt
Who is using the product?
Where are users getting stuck?
Which AI tasks fail?
Which AI outputs are accepted or rejected?
Are credits deducted/refunded correctly?
Can admins manually grant credits to testers/users?
Are AI proposals becoming canon only after approval?
Are reveal/continuity validators catching dangerous issues?
Is the system ready for public launch and payment?
```

Core product architecture decisions that this admin dashboard must respect:

```txt
AI is not the source of truth.
Canonical Story State is the source of truth.

Planner may know the future.
Writer must only know the safe present.

Future outline must not enter the writer prompt raw.
Context Packet Builder is the only gateway into AI writing.

AI-generated important facts must be proposals first.
User approval is required before canon changes.

Normal users only see Hemat / Seimbang / Terbaik.
Raw model IDs and providers may appear only in admin/debug views.
```

---

## 1. Placement in Roadmap

Do not build the complete admin dashboard too early. Build it in layers.

Recommended order:

```txt
Task 1.17
→ Sprint 1.5 Legacy Audit + Problem Coverage Matrix
→ Sprint 2 Data Model & Project Foundation
→ Admin Sprint A: Admin Foundation MVP
→ Sprint 3 Intake, Concept, Foundation real flow
→ Admin Sprint B: AI Operations Dashboard
→ Sprint 4–6 Planning, Safe Beat Writer, Validator, Chapter Delta
→ Admin Sprint C: Quality, Context, Reveal Debugger
→ Sprint 7–8 Publish Package + Credit System
→ Admin Sprint D: Launch Readiness, Payment, Analytics, Feature Flags
```

Admin Sprint A should begin after the app has real users, projects, credit balances, and AI proposal infrastructure.

---

## 2. Admin Sprint A — Admin Foundation MVP

### Goal

Create a secure admin panel for private beta operations.

Admin Sprint A must support:

```txt
- Admin-only route protection.
- Admin overview.
- User management.
- Project inspection.
- Manual credit grants.
- Credit ledger visibility.
- AI proposal queue visibility.
- System health visibility.
- Admin audit logs.
```

### Routes

```txt
/admin
/admin/users
/admin/users/:id
/admin/projects
/admin/projects/:id
/admin/credits
/admin/credit-ledger
/admin/proposals
/admin/proposals/:id
/admin/system
/admin/audit-logs
```

---

## 3. Access Control and Roles

### User Roles

Add or confirm support for these roles:

```txt
user
support
admin
super_admin
```

### Role Permissions

| Role | Permissions |
|---|---|
| user | Cannot access admin routes or admin APIs. |
| support | Can view users/projects/support context, cannot grant credits unless explicitly allowed. |
| admin | Can view users/projects, grant credits, adjust user status, inspect attempts, add notes. |
| super_admin | Can do everything admin can do, plus feature flags, model config, force reject proposals, payment reconciliation. |

### Required Server-Side Guard

All admin API endpoints must verify role server-side. Client-side route protection is not enough.

Pseudo-rule:

```ts
requireAdmin(request, { minRole: 'admin' })
requireAdmin(request, { minRole: 'super_admin' })
```

### Acceptance Criteria

```txt
- Normal user opening /admin gets 403 or redirect.
- Normal user calling /admin API directly gets 403.
- Admin can access admin dashboard.
- All admin mutations create admin_audit_logs rows.
```

---

## 4. Admin Overview

Route:

```txt
/admin
```

### KPI Cards

Admin overview should show:

```txt
Total Users
Active Users 24h
Active Users 7d
Projects Created
Foundation Locked
Outlines Generated
Beats Generated
Prose Accepted
Credits Granted
Credits Spent Today
Credits Refunded
Pending AI Proposals
Failed Generations 24h
```

For Admin Sprint A, not all AI metrics may exist yet. Display available metrics and use clean empty states for unavailable metrics.

### Private Beta Funnel

Target full funnel:

```txt
Registered
→ Created Project
→ Started Intake
→ Concepts Generated
→ Concept Selected
→ Foundation Generated
→ Foundation Locked
→ Outline Generated
→ Beat Generated
→ Prose Accepted
→ Chapter Closed
→ Publish Package Generated
```

Admin Sprint A may start with:

```txt
Registered
→ Created Project
→ Foundation Saved
→ AI Proposal Created
→ Credits Granted/Spent
```

### Alerts Panel

Show operational warnings:

```txt
Users with failed generation
Users with zero or low credits
Projects stuck before foundation lock
Pending high-risk AI proposals
Recent admin credit grants
System health warning
```

### Acceptance Criteria

```txt
- /admin loads only for admin.
- KPI cards are backed by API data, not static mock.
- Empty/loading/error states exist.
- Funnel gracefully handles missing event types.
```

---

## 5. User Management

Routes:

```txt
/admin/users
/admin/users/:id
```

### User List Columns

```txt
Name / Email
Role
Status
Created At
Last Active
Projects Count
Credit Balance
Credits Granted
Credits Spent
Failed Attempts
```

### Filters

```txt
role
status
created date
has project
no project
low credit
failed generation
```

### Search

Search by:

```txt
email
name
user_id
```

### User Detail Sections

```txt
Profile
Credit Balance
Manual Credit Grant Panel
Projects
Recent Generation Attempts
Credit Ledger
AI Proposals
Admin Notes
Audit History
```

### User Actions

```txt
Grant Credits Manually
Adjust Credits
Suspend User
Unsuspend User
Change Role
Add Admin Note
Open User Projects
```

### Acceptance Criteria

```txt
- Admin can search users.
- Admin can open user detail.
- Admin can grant credits manually.
- Manual credit grant writes credit_ledger.
- Manual credit grant updates credit balance atomically.
- Manual credit grant writes admin_audit_logs.
```

---

## 6. Manual Credit Grant Feature

This is a mandatory Admin Sprint A feature.

### Purpose

Admins must be able to manually give credits to users for:

```txt
private beta testing
founder testing
support resolution
bug refund
manual correction
promo/bonus
failed payment reconciliation
```

### User Flow

Admin path:

```txt
/admin/users
→ choose user
→ click Grant Credits
→ enter amount
→ choose reason
→ add internal note
→ confirm
→ system updates credit balance
→ system writes credit ledger
→ system writes admin audit log
→ user detail shows updated balance
```

### UI Requirements

Add a **Grant Credits** button in:

```txt
/admin/users/:id
/admin/credits
```

Grant Credits modal fields:

```txt
User: read-only selected user
Current Balance: read-only
Amount: required positive integer
Reason: required select
Internal Note: optional but recommended
Idempotency Key: hidden generated client-side or server-side
Confirm Button
Cancel Button
```

Reason options:

```txt
private_beta_bonus
founder_test
bug_refund
manual_correction
support_resolution
promo_bonus
payment_reconciliation
other
```

### Validation Rules

```txt
amount must be positive integer
amount must be <= configured admin grant limit unless super_admin
reason is required
normal admin cannot grant credits to self unless super_admin
normal admin cannot grant credits to another admin unless super_admin
internal note is required for amount above threshold
all requests must include idempotency key
```

Recommended limits:

```txt
admin max grant per transaction: 500 credits
admin max grant per user per day: 1000 credits
super_admin can override with required note
```

### API Endpoint

```txt
POST /admin/users/:userId/credits/grant
```

Request:

```json
{
  "amount": 100,
  "reason": "private_beta_bonus",
  "note": "Private beta onboarding credits for tester.",
  "idempotencyKey": "grant_2026_06_18_xxxxx"
}
```

Response:

```json
{
  "ok": true,
  "userId": "uuid",
  "amount": 100,
  "balanceAfter": 150,
  "ledgerId": "uuid",
  "auditLogId": "uuid"
}
```

### Required Transaction Behavior

Manual credit grant must be atomic.

In one database transaction or one safe RPC:

```txt
1. Verify actor is admin or super_admin.
2. Validate amount/reason/limits.
3. Check idempotency key has not been used.
4. Lock or atomically update target user's credit balance.
5. Insert credit_ledger row.
6. Insert admin_audit_logs row.
7. Return updated balance.
```

If any step fails, no partial update may remain.

### Required Tables

#### credit_balances

```sql
create table if not exists credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  reserved integer not null default 0,
  spent integer not null default 0,
  refunded integer not null default 0,
  updated_at timestamptz not null default now()
);
```

#### credit_ledger

```sql
create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null,
  generation_attempt_id uuid null,
  event_type text not null,
  amount integer not null,
  balance_before integer not null,
  balance_after integer not null,
  reason text null,
  source text not null,
  idempotency_key text null unique,
  admin_actor_id uuid null references auth.users(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Allowed `event_type` values:

```txt
grant
spend
refund
manual_adjustment
bonus
payment_topup
admin_correction
reservation
release
```

For manual grant, use:

```txt
event_type = grant
source = admin_manual
amount = positive integer
admin_actor_id = current admin user id
```

#### admin_audit_logs

```sql
create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id uuid null,
  before jsonb null,
  after jsonb null,
  metadata jsonb not null default '{}',
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);
```

For manual grant:

```txt
action = grant_credits
target_type = user
target_id = target user id
before = { balance }
after = { balance, grantedAmount, reason }
metadata = { ledgerId, note, idempotencyKey }
```

### Recommended RPC

Prefer a database RPC to avoid double-write bugs.

```sql
create or replace function admin_grant_credits(
  p_actor_admin_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_note text,
  p_idempotency_key text
)
returns table (
  ledger_id uuid,
  audit_log_id uuid,
  balance_before integer,
  balance_after integer
)
language plpgsql
security definer
as $$
declare
  v_balance_before integer;
  v_balance_after integer;
  v_ledger_id uuid;
  v_audit_log_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  if exists (select 1 from credit_ledger where idempotency_key = p_idempotency_key) then
    raise exception 'duplicate_idempotency_key';
  end if;

  insert into credit_balances (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select balance
  into v_balance_before
  from credit_balances
  where user_id = p_user_id
  for update;

  v_balance_after := v_balance_before + p_amount;

  update credit_balances
  set balance = v_balance_after,
      updated_at = now()
  where user_id = p_user_id;

  insert into credit_ledger (
    user_id,
    event_type,
    amount,
    balance_before,
    balance_after,
    reason,
    source,
    idempotency_key,
    admin_actor_id,
    metadata
  ) values (
    p_user_id,
    'grant',
    p_amount,
    v_balance_before,
    v_balance_after,
    p_reason,
    'admin_manual',
    p_idempotency_key,
    p_actor_admin_id,
    jsonb_build_object('note', p_note)
  )
  returning id into v_ledger_id;

  insert into admin_audit_logs (
    actor_admin_id,
    action,
    target_type,
    target_id,
    before,
    after,
    metadata
  ) values (
    p_actor_admin_id,
    'grant_credits',
    'user',
    p_user_id,
    jsonb_build_object('balance', v_balance_before),
    jsonb_build_object('balance', v_balance_after, 'grantedAmount', p_amount, 'reason', p_reason),
    jsonb_build_object('ledgerId', v_ledger_id, 'note', p_note, 'idempotencyKey', p_idempotency_key)
  )
  returning id into v_audit_log_id;

  return query select v_ledger_id, v_audit_log_id, v_balance_before, v_balance_after;
end;
$$;
```

Important: API layer must still check actor role before calling this RPC. Do not rely only on RPC security definer.

### Manual Credit Grant Acceptance Criteria

```txt
- Admin can grant credits from user detail page.
- Admin can grant credits from credit admin page.
- Credit balance updates immediately after success.
- Credit ledger row is created with event_type=grant and source=admin_manual.
- Admin audit log row is created with action=grant_credits.
- Repeating the same idempotency key does not double grant.
- Normal user cannot call the grant endpoint.
- Support role cannot grant unless explicitly configured.
- Amount <= 0 is rejected.
- Large grant requires note or super_admin override.
```

### Manual Credit Grant Test Cases

```txt
1. Admin grants 100 credits to normal user → balance increases by 100.
2. Ledger shows grant event with correct balance_before and balance_after.
3. Audit log shows grant_credits action.
4. Same request repeated with same idempotency key → no double credit.
5. Normal user calls endpoint → 403.
6. Support calls endpoint without permission → 403.
7. Admin grants negative amount → 400.
8. Admin grants amount above limit → 403 or validation error.
9. Super admin grants above limit with note → success.
10. Admin grants to self → blocked unless super_admin.
```

---

## 7. Project Inspector

Routes:

```txt
/admin/projects
/admin/projects/:id
```

### Project List Columns

```txt
Project Title
Owner
Status
Stage
Genre
Target Length
Foundation Readiness
Locked Facts Count
AI Proposals Count
Credits Spent
Last Updated
```

### Project Stages

```txt
draft
intake
concept
foundation
outline
writing
summary
publish
archived
```

### Project Detail Sections

```txt
Project Overview
Owner Info
Foundation
Characters
Facts
Speech Rules
AI Proposals
Credit Usage
Activity Timeline
Admin Notes
```

### Admin Rules

```txt
- Admin can inspect project for debugging.
- Admin must not mutate canon facts directly in Admin Sprint A.
- Any sensitive project inspection should write audit log if required.
```

### Acceptance Criteria

```txt
- Admin can list all projects.
- Admin can inspect project detail.
- Project detail handles incomplete data.
- Admin cannot accidentally mutate story canon.
```

---

## 8. Credit Admin and Ledger

Routes:

```txt
/admin/credits
/admin/credit-ledger
```

### Credit Dashboard Metrics

```txt
Total Credits Granted
Total Credits Spent
Total Credits Refunded
Manual Adjustments
Average Credits Per User
Average Credits Per Project
Top Credit Users
Users with Low Balance
Recent Manual Grants
```

### Ledger Table Columns

```txt
Date
User
Project
Event Type
Amount
Balance Before
Balance After
Source
Reason
Attempt ID
Admin Actor
```

### Filters

```txt
user
project
event_type
source
date range
admin actor
```

### Acceptance Criteria

```txt
- Ledger can be filtered.
- Manual grants are visible.
- Balance before/after are visible.
- Admin can trace a grant to audit log.
```

---

## 9. AI Proposal Queue Admin

Routes:

```txt
/admin/proposals
/admin/proposals/:id
```

### Purpose

Admin must be able to inspect AI proposals because Narraza does not allow important AI-generated facts to become canon automatically.

### Proposal Types

```txt
fact
character
relationship
secret
reveal
speech_rule
timeline_event
foundation_change
chapter_delta
style_rule
```

### Proposal Statuses

```txt
proposed
accepted
rejected
merged
superseded
flagged
```

### Risk Levels

```txt
low
medium
high
critical
```

High-risk categories:

```txt
kehamilan
anak
kematian
hubungan keluarga
masa lalu romantis
rahasia besar
benda penting
status nikah/hukum
```

### Admin Actions

```txt
Flag suspicious
Add internal note
View project
View source attempt
Force reject only for super_admin
```

### Acceptance Criteria

```txt
- Admin can filter pending/high-risk proposals.
- Admin can open proposal detail.
- Admin can flag suspicious proposal.
- Normal admin cannot force mutate canon.
```

---

## 10. System Health

Route:

```txt
/admin/system
```

### Health Cards

```txt
API health
Database connection
Auth status
AI enabled flag
Payment mode
Credit deduction mode
OpenRouter/API provider configured
Queue status
Error rate 24h
Average API latency
Failed jobs
```

### Security Rule

Never display raw secrets.

Display:

```txt
configured: true/false
masked prefix/suffix only if necessary
```

### Acceptance Criteria

```txt
- Admin sees system status.
- Raw secrets are never displayed.
- Failed jobs/errors are visible enough for debugging.
```

---

## 11. Admin Audit Logs

Route:

```txt
/admin/audit-logs
```

### Required Actions to Log

```txt
admin_login
grant_credits
adjust_credits
refund_credits
suspend_user
unsuspend_user
change_role
view_sensitive_project
flag_ai_proposal
force_reject_proposal
change_feature_flag
change_model_config
retry_generation
delete_project
```

### UI Columns

```txt
Date
Actor
Action
Target Type
Target ID
Summary
IP Address
```

### Acceptance Criteria

```txt
- Audit log is read-only.
- Every admin mutation creates an audit log.
- Audit log can be filtered by actor/action/date.
```

---

## 12. Admin Sprint B — AI Operations Dashboard

Build this after Sprint 3 when AI intake/concept/foundation generation starts.

### Routes

```txt
/admin/generation-attempts
/admin/generation-attempts/:id
/admin/model-usage
```

### generation_attempts Table

```sql
create table if not exists generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid null,
  task_type text not null,
  status text not null,
  model_tier text null,
  raw_model_id text null,
  input_snapshot_hash text null,
  output_snapshot_hash text null,
  context_packet_hash text null,
  credits_reserved integer not null default 0,
  credits_spent integer not null default 0,
  credits_refunded integer not null default 0,
  error_code text null,
  error_message text null,
  metadata jsonb not null default '{}',
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now()
);
```

### Attempt Statuses

```txt
pending
running
succeeded
failed
cancelled
refunded
```

### Task Types

```txt
intake_reply
concept_generation
foundation_generation
outline_generation
beat_generation
repair
validation
chapter_delta
publish_package
```

### Required Actions

```txt
View attempt
Retry failed attempt
Refund credits
Mark investigated
Open user
Open project
Open related proposal
```

### Acceptance Criteria

```txt
- Every AI task creates generation_attempt.
- Failed attempts show error code/message.
- Refund attempt writes credit ledger and audit log.
- Retry does not double charge.
```

---

## 13. Admin Sprint C — Quality, Context, Reveal Debugger

Build this after Sprint 5–6.

### Routes

```txt
/admin/quality
/admin/validation-reports
/admin/context-packets/:hash
/admin/reveal-debugger/:projectId
/admin/chapter-deltas/:id
```

### Quality Monitor Metrics

```txt
Validator Fail Rate
Spoiler Warning Count
Character Knowledge Violations
Mobile Readability Warnings
Retention Warnings
Repair Success Rate
Publish Ready Rate
Average Output Readiness
```

### Validator Types

```txt
instruction_compliance
spoiler_reveal
character_knowledge
canon_accuracy
mobile_readability
retention
literary_quality
cost_context_budget
```

### Context Packet Viewer Must Show

```txt
current beat
known facts to reader
POV character knowledge
active character states
speech rules
previous accepted prose summary
allowed breadcrumb
forbidden reveals
word target
stop condition
mobile formatting rules
```

### Reveal Gate Debugger Must Show

```txt
Reveal list
Reveal target chapter
Forbidden before chapter
Allowed breadcrumb chapters
Characters who know
Generation attempts before reveal
Spoiler warnings
```

### Chapter Delta Viewer Must Show

```txt
chapter summary
new facts revealed
character state changes
relationship changes
timeline events
open loops added/resolved
breadcrumbs planted
mini victories
continuity warnings
approval status
```

---

## 14. Admin Sprint D — Launch Readiness

Build this near public/payment launch.

### Routes

```txt
/admin/analytics
/admin/payments
/admin/feature-flags
/admin/model-config
/admin/support
```

### Product Analytics Events

```txt
user_registered
project_created
intake_started
intake_message_sent
concepts_generated
concept_selected
foundation_generated
foundation_locked
outline_generated
beat_generated
prose_accepted
chapter_closed
publish_package_generated
validation_blocking
retention_warning
credits_spent
credits_refunded
payment_created
payment_succeeded
```

### Feature Flags

```txt
public_signup_enabled
ai_generation_enabled
payment_enabled
founder_only_mode
concept_generation_enabled
foundation_generation_enabled
outline_generation_enabled
beat_writer_enabled
publish_package_enabled
credit_deduction_enabled
auto_refund_enabled
validator_strict_mode
manual_credit_grant_enabled
```

### Model Config

Raw model IDs are admin-only.

```txt
writer_economy_model
writer_balanced_model
writer_premium_model
background_extraction_model
validator_model
repair_model
chapter_delta_model
publish_package_model
max_attempts_per_user_per_day
max_credits_per_user_per_day
max_manual_grant_per_admin_per_day
```

---

## 15. Recommended Folder Structure

Frontend:

```txt
apps/web/src/admin/
  components/
    AdminShell.tsx
    AdminSidebar.tsx
    AdminStatCard.tsx
    AdminDataTable.tsx
    AdminFilterBar.tsx
    AdminStatusBadge.tsx
    AdminAuditTimeline.tsx
    GrantCreditsModal.tsx
  pages/
    AdminOverviewPage.tsx
    AdminUsersPage.tsx
    AdminUserDetailPage.tsx
    AdminProjectsPage.tsx
    AdminProjectDetailPage.tsx
    AdminCreditsPage.tsx
    AdminCreditLedgerPage.tsx
    AdminProposalsPage.tsx
    AdminProposalDetailPage.tsx
    AdminSystemPage.tsx
    AdminAuditLogsPage.tsx
    AdminGenerationAttemptsPage.tsx
    AdminGenerationAttemptDetailPage.tsx
    AdminQualityPage.tsx
    AdminFeatureFlagsPage.tsx
  api/
    adminClient.ts
  types/
    adminTypes.ts
```

Backend:

```txt
apps/api/src/routes/admin/
  index.ts
  users.ts
  projects.ts
  credits.ts
  proposals.ts
  system.ts
  auditLogs.ts
  attempts.ts
  quality.ts
  featureFlags.ts
  modelConfig.ts
```

Services:

```txt
apps/api/src/services/admin/
  adminAuth.ts
  adminAudit.ts
  adminCreditService.ts
  adminUserService.ts
  adminProjectService.ts
  adminAttemptService.ts
  adminSystemService.ts
```

---

## 16. API Endpoint Plan

### Overview

```txt
GET /admin/overview
```

### Users

```txt
GET /admin/users
GET /admin/users/:id
PATCH /admin/users/:id/status
PATCH /admin/users/:id/role
POST /admin/users/:id/credits/grant
POST /admin/users/:id/notes
```

### Projects

```txt
GET /admin/projects
GET /admin/projects/:id
POST /admin/projects/:id/notes
```

### Credits

```txt
GET /admin/credits/summary
GET /admin/credit-ledger
POST /admin/credits/adjust
POST /admin/credits/refund-attempt
```

### Proposals

```txt
GET /admin/proposals
GET /admin/proposals/:id
POST /admin/proposals/:id/flag
POST /admin/proposals/:id/force-reject
```

### Attempts

```txt
GET /admin/generation-attempts
GET /admin/generation-attempts/:id
POST /admin/generation-attempts/:id/retry
POST /admin/generation-attempts/:id/refund
POST /admin/generation-attempts/:id/mark-investigated
```

### System

```txt
GET /admin/system/health
GET /admin/audit-logs
GET /admin/feature-flags
PATCH /admin/feature-flags/:key
```

---

## 17. Global Acceptance Criteria

Admin dashboard is acceptable only if:

```txt
1. Admin routes are protected server-side and client-side.
2. Normal users cannot access admin API.
3. All admin mutations write admin_audit_logs.
4. Manual credit grant works and is atomic.
5. Credit grants write credit_ledger.
6. Credit grants cannot be duplicated by refresh/retry due to idempotency key.
7. Admin list pages have search/filter/loading/empty/error states.
8. Raw model/provider IDs appear only in admin views.
9. Raw secrets never appear in admin views.
10. Admin cannot directly mutate story canon in Admin Sprint A.
11. Build and typecheck pass.
12. docs/admin-dashboard.md is created or updated.
```

---

## 18. Prompt for AI Coding Agent — Admin Sprint A

Copy this prompt into any coding agent after Sprint 2 data model is ready.

```txt
Build Admin Sprint A — Admin Foundation MVP for Narraza.

Context:
- Product name is Narraza.
- Historical docs may still say VibeNovel, but UI copy should use Narraza.
- Narraza is an AI Serial Fiction Production OS, not a generic AI chatbot.
- Do not build AI production.
- Do not build payment production.
- Do not expose raw model/provider to normal users.
- Admin dashboard is for private beta operations.

Scope:
1. Add admin role support using existing profiles table.
2. Add protected /admin route group.
3. Build AdminShell + AdminSidebar.
4. Build pages:
   - /admin overview
   - /admin/users
   - /admin/users/:id
   - /admin/projects
   - /admin/projects/:id
   - /admin/credits
   - /admin/credit-ledger
   - /admin/proposals
   - /admin/system
   - /admin/audit-logs
5. Add Grant Credits modal and manual credit grant workflow.
6. Add backend admin API endpoints with server-side role guard.
7. Add or update migrations:
   - admin_audit_logs
   - admin_notes
   - credit_balances
   - credit_ledger
8. Implement POST /admin/users/:userId/credits/grant.
9. Make manual grant atomic and idempotent.
10. Make every admin mutation write admin_audit_logs.
11. Add loading, empty, and error states.
12. Add docs/admin-dashboard.md.

Hard rules:
- Normal user must never access /admin or /admin API.
- Admin must not directly mutate canon facts in Sprint A.
- Credit grants/adjustments must always write credit ledger.
- Manual credit grant must use idempotency key.
- No raw secrets displayed.
- No AI generation added in this sprint.

Manual Credit Grant Requirements:
- Admin can grant credits to a selected user.
- Fields: amount, reason, internal note.
- Reasons: private_beta_bonus, founder_test, bug_refund, manual_correction, support_resolution, promo_bonus, payment_reconciliation, other.
- amount must be positive integer.
- normal admin cannot exceed configured grant limit.
- grant creates credit_ledger row.
- grant updates credit_balances.
- grant creates admin_audit_logs row.
- duplicate idempotency key must not double grant.

Acceptance:
- npm run typecheck PASS
- npm run build:web PASS
- API health still PASS
- Admin user can view dashboard
- Normal user gets blocked from admin
- Admin can grant credits
- Credit ledger updates correctly
- Audit logs are written for grant credit, status change, role change, and notes
```

---

## 19. Nearest Implementation Priority

Recommended near-term order:

```txt
1. Admin role + protected admin shell
2. Users list + user detail
3. Manual credit grant
4. Credit ledger
5. Project inspector
6. AI proposal queue
7. System health
8. Audit logs
9. Generation attempts
10. Quality monitor
11. Context packet / reveal debugger
12. Feature flags + model config
13. Payment + analytics
```

The highest priority feature added by this document is:

```txt
Admin can manually grant credits to users safely, atomically, auditable, and idempotently.
```
