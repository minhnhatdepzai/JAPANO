---
name: japano-mongodb-erd
description: Use when auditing the JAPANO MongoDB Atlas/Compass database, reducing or merging collections, deciding embed vs reference, planning or running a MongoDB migration, syncing or verifying the ERD against the real database, or estimating storage cost. Enforces a read-only-first, backup-before-drop workflow.
---

# JAPANO MongoDB and ERD

This skill governs every change to the JAPANO database and to the diagrams that
claim to describe it. It exists because the expensive mistakes here are silent:
a collection dropped because it looked empty, an ERD that says 29 tables while
Atlas holds 34, a migration that "worked" until the backend restarted.

Read `docs/CODEX_PROJECT_MEMORY.md` first. Pair this skill with
`document-model-advisor` for embed-vs-reference reasoning and with `drawio` for
diagram output.

## Non-negotiables

- Never print a connection URI, username, password or token — not to the
  terminal, not into a document, not into a log. Read them from the environment
  and pass them through; never echo them.
- Never create a second JAPANO database. No `japano_erd`, no `japano_new`, no
  parallel data source for diagramming.
- Never drop a collection before a verified backup exists and every validation
  gate has passed.
- **An empty collection is not evidence that it is unused.** Zero documents may
  mean a seasonal flow, a feature nobody exercised yet, or something seed data
  does not cover.
- Never reset, clean, checkout, restore, stash, switch branches, rebase, commit
  or push. This repository carries uncommitted work from other sessions.
- Fewer collections is not automatically cheaper. Judge cost by `dataSize`,
  `totalIndexSize` and growth rate, not by collection count.

## The nine steps, in order

### 1. Read-only inventory first

Confirm the backend and Compass point at the same cluster host, database name
and collection set before believing anything. Capture, with a timestamp:
database name, collections, document counts, `dataSize`, `storageSize`,
`totalIndexSize`, every index, TTL indexes, validators, newest document time
where determinable, and a field shape with sensitive values stripped.

Write the machine-readable snapshot to
`docs/database/atlas-schema-snapshot-YYYY-MM-DD.json` and the human report to
`docs/database/MONGODB_STORAGE_AUDIT_YYYY-MM-DD.md`.

If Compass cannot actually be driven, say "Compass UI chưa xác minh" and verify
through `mongosh` or the Node driver on the same URI. Do not claim to have
looked at a screen you did not look at.

### 2. Trace reads and writes through source

For each collection find every backend read, backend write, migration, cron or
job, Web Admin view, mobile screen, checkout/payment path, analytics consumer
and ERD generator reference. Search for the runtime field names and API
endpoints too, not only the collection name — a collection reached through a
constant or a helper will not match a naive grep.

### 3. Classify

| Class | Meaning | Default |
|---|---|---|
| A | Core business record | keep |
| B | Financial/audit ledger | keep, always |
| C | Small configuration | may embed into settings |
| D | Strict 1:1 with a parent | consider embedding |
| E | Reliably derivable | need not persist |
| F | AI cache | RAM/disk with TTL, not a collection |
| G | Fast-growing log/event | keep with retention, TTL or aggregation |
| H | Media | store URL + metadata only; bytes live in Cloudinary |
| I | Unused | drop only when source trace *and* data both prove it |

Anything a user or admin can see stays, however small. Anything touching money,
vouchers, orders or entitlement history stays. Ambiguous collections stay and go
into the report as ambiguous.

### 4. Backup and rollback

Stop or quiesce the writer first. Take a gzip backup (mode 0600) of the source
collections, the merge targets, and index/option definitions. Record counts and
a SHA-256 per artifact in a manifest. Write the exact rollback command down
before running anything that writes.

### 5. Dry run

Run the migration in dry-run mode and diff old runtime state against new runtime
state. A dry run that reports "would migrate 0 documents" is a failed dry run
until you understand why.

### 6. Validate through the API, not the shell

After applying: document counts, ID mapping, orphans, duplicates, then the real
endpoints — product catalog, banners, VIP, checkout with a voucher, Admin
save/update, Flagcard grant. Then restart the backend and confirm the data still
reads back the same. A migration that survives only until restart has not
migrated anything.

### 7. Drop last

Drop only the collections actually moved, only after every gate above is green.
If any gate fails: do not drop, roll back the writes, and report the failure
with its evidence. Never drop an extra collection to reach a rounder number.

### 8. Generate the ERD from the database

`JAPANO_ERD_MongoDB.drawio` is the physical ERD and must mirror Atlas exactly
after migration. `docs/architecture/erd/JAPANO_ERD_CORE.drawio` is the
presentation view and must say so on its face.

Generate from the fresh snapshot, never by hand. One Atlas collection maps to
exactly one physical table. Do not draw tables for AI RAM caches, Cloudinary
images, runtime-derived data, frontend state, services/models, or objects that
are now embedded and no longer have a collection. Call MongoDB links
"reference", not "foreign key", unless a real constraint exists. Put embedded
objects inside their parent table. Mark PK, index, unique and TTL explicitly.
Split pages: overview, auth/customer, catalog, commerce/payment, loyalty,
settings/content, and AI/log/retention if any remain.

### 9. Prove the ERD equals the database

Run an automatic validator that parses the `.drawio` XML, extracts the table
set, and compares it with `listCollections` from the snapshot. It must report
missing, extra, duplicate, and relations pointing at non-existent targets.

The gate is set equality:

```
set(collections in Atlas) === set(tables in physical ERD)
```

Then validate the XML, open it in Draw.io Desktop, export PNG/PDF, look at every
page for clipping, unreadable text, crossing connectors and wrong cardinality,
and update `docs/database/ERD_VALIDATION_REPORT.md`.

## Retiring old diagram files

Compare content and find every reference before deleting any `.drawio`. Delete
only genuine duplicates or superseded copies, and only after the official file
validates. Never delete a thesis/defense document or a file with independent
content — archive it instead and say where it went.

## Reporting

State plainly: which file is the physical ERD, which is logical/core, what was
archived or deleted, the Atlas collection count, the physical ERD table count,
and the set-equality result. Report storage saved separately for dropped
collections, merged documents, removed indexes, TTL and media kept out of
MongoDB. If something was not verified, name it as unverified.
