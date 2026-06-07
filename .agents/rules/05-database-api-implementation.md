# VibeNovel Agent Rule — Database and API Implementation

Do not store important story structure only as raw text blobs.

Important entities must be queryable:

- projects,
- story foundations,
- characters,
- facts,
- reveals,
- character knowledge,
- chapters,
- beats,
- prose versions,
- QA reports,
- chapter deltas.

API rules:

- Frontend must not call AI provider directly.
- Backend owns model routing and credit logic.
- Generation endpoint must load state, build context packet, validate output, save version.
- User acceptance must be explicit before prose becomes accepted/canon.

Sprint 1 exception:

- Use typed mock data only.
- Do not build production schema unless explicitly instructed.
