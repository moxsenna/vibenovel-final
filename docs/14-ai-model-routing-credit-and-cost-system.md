# 14 — AI Model Routing, Credit, and Cost System

## No BYOK

User tidak melihat API key, provider, atau raw model ID.

User hanya memilih:

- Hemat
- Seimbang
- Terbaik

## Backend-managed routing

Model mapping harus configurable dari backend/env karena harga/kualitas provider berubah.

## Task-based routing

- Brainstorming: creativity higher.
- Planning: reasoning/structured output.
- Prose: medium temperature, style-safe.
- Validator: low temperature, cheap/structured.
- Repair: cheaper first.

## Credit rule

Charge should optimize cost per accepted output, not cost per raw generation.

## MVP

Sprint 1: show dummy credit UI only.

Later:

- credit estimate before generation,
- ledger entries,
- refund/adjustment on failed generation if needed,
- cost report by feature.
