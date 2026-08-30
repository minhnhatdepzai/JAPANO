---
name: japano-db-erd
description: Audit, simplify, migrate, document, or diagram JAPANO MongoDB, ERD, data retention, and use cases while keeping code, live data, and diagrams aligned.
---

# JAPANO database and ERD

Use this skill for database reviews, schema changes, ERDs, retention plans, and
Draw.io use-case diagrams in this repository.

## Source of truth

Verify the current system before drawing or changing anything. Follow this chain
in order, and treat anything later in the chain as derived, never authoritative:

1. The live MongoDB database and its indexes/validators, when access is available
   (`backend/lib/mongo.js` holds the connection; never print the URI).
2. `backend/lib/mongoCollections.js` — collection constants and write paths.
3. `backend/routes/**` — who actually writes and reads each collection.
4. `scripts/erd_schema.json` — the generated schema export.
5. Draw.io files under `docs/architecture/erd/`.
6. Prose documentation such as `README.md` and `docs/database/**`.

`JAPANO/` in the repository root is a 1.4 GB local source copy that Git does not
track. It is **non-authoritative**: never read schema or code from it.

Never invent a collection or relationship merely to make a diagram look complete.
Every entity on a diagram carries exactly one label:

| Label | Meaning |
|---|---|
| `[THỰC TẾ]` | A physical collection that exists in the live database right now |
| `[SUY LUẬN]` | Inferred from code or API shape, not yet confirmed against live data |
| `[ĐỀ XUẤT]` | Proposed, not implemented anywhere |

An unlabelled entity is a defect in the diagram.

## Safe simplification workflow

- Trace every candidate field or collection through writes, reads, API output,
  Admin UI, mobile UI, reports, and background jobs.
- Classify data as permanent business record, TTL/audit record, aggregate, cache,
  or disposable runtime state.
- Keep anything users, staff, finance, fulfilment, authentication, or compliance
  flows still need. Prefer TTL indexes or aggregates over blind deletion.
- **An empty collection is not evidence that it is unused.** A collection with
  zero documents may simply be a feature nobody exercised yet, a seasonal flow, or
  something the seed data does not cover. Before proposing removal, trace it
  through routes, mobile screens, Admin views, seed scripts, analytics jobs and
  tests; only "no writer and no reader anywhere in source" justifies removal.
- Do not create a second database (in particular, never create a `japano_erd`
  database or any parallel data source for diagramming), silently rename
  collections, or delete live data. Any migration needs a dry run, counts, backup, rollback, and explicit
  authorization before destructive execution.
- Keep media as provider identifiers/URLs plus metadata; do not store raw images,
  video, base64 payloads, model weights, or generated artifacts in MongoDB.
- Recount the live schema every time; do not rely on an old collection count.

## Change and validation contract

For an approved schema change, update the application code, migration, indexes,
validators, tests, seed/demo assumptions, API contracts, documentation, and ERD
together. Validate pre/post counts, representative CRUD flows, unique/TTL
indexes, orphan references, and rollback behavior.

## Diagram contract

Use the `drawio` skill and produce native editable `.drawio` XML. Maintain one
canonical ERD and one canonical use-case diagram instead of creating `FINAL_V2`
copies. Include a legend distinguishing physical MongoDB collections, embedded
documents, logical views, and proposed items. Do not add watermarks; native
Draw.io output does not require watermark removal. Export PNG/PDF only as derived
previews after validating that the source XML opens successfully.
