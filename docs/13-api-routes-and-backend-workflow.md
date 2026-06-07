# 13 — API Routes and Backend Workflow

## Backend principle

Backend mengelola AI, credits, persistence, and validation. Frontend tidak boleh langsung memanggil provider AI.

## MVP API candidates

```txt
POST /projects
GET /projects
GET /projects/:id
POST /projects/:id/story-intake/messages
POST /projects/:id/concepts/generate
POST /projects/:id/story-foundation/lock
POST /projects/:id/outline/generate
POST /chapters/:id/beats/:beatId/generate
POST /chapters/:id/beats/:beatId/accept
POST /chapters/:id/close
GET /chapters/:id/qa
POST /chapters/:id/publish-package/generate
```

## Generation job workflow

```txt
request
→ validate credit/scope
→ load state
→ build context packet
→ call model
→ validate output
→ repair if needed
→ save version
→ return result + QA report
```

## Sprint boundary

Sprint 1: no real API required. Use mock service layer with typed dummy data.

Sprint 2+: replace mock service gradually with real API/persistence.
