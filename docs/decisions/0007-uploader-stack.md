# Replace the legacy uploader with Litestar, HTMX, and Kubernetes

## Context and Problem Statement

The old OAM uploader ran for about ten years. That tells you two things: a small,
focused upload tool does the job, and durability matters more than novelty.

Image processing runs on
AWS Lambda, upload state is spread across a few systems, and a single upload
touches the browser, the uploader, S3, Lambda, and the catalogue with no one
place to follow it through. Releases, local testing, and debugging are all harder
than they should be. It also sits apart from the rest of HOT's stack today: one
shared login, STAC and pgstac, Kubernetes with Argo, and OpenTelemetry.

We want the replacement to last the test of time too, so we lean on plain,
well-understood web patterns instead of a big frontend framework.
It needs to:

- Use the shared HOT login.
- Not depend on AWS Lambda, so it runs anywhere, including a laptop.
- Send large files straight to S3 with resumable multipart uploads, and keep
  ownership and status durable.
- Make each processing step visible and recoverable.
- Fit our Python, Postgres, container, Kubernetes, and Helm habits.
- Produce standard STAC items in the existing catalogue.

The first version came out of the UC Berkeley "Code for Good" cohort coding
challenge. This design builds on that work.

## Considered Options

- **Modernise the old uploader in place.** Least disruption up front, but it keeps
  the AWS coupling and the flows that are hard to test, spread across a lot of
  risky upgrades. It never becomes a coherent design, so we passed.
- **A new React SPA.** Nicer UI, and it matches the map frontend. But we'd still
  need the authenticated API, durable state, and processing behind it, and we'd
  re-implement routing, forms, and validation the server already handles. More
  than this tool needs today. Worth revisiting if the UI grows.
- **AWS managed and serverless** (S3 events, Lambda, queues). Scales well, but it
  locks us back into one provider and leaves local debugging painful. Portability
  is the whole reason we're doing this, so no.
- **Django or another full-stack framework.** Solid auth, forms, admin, and
  migrations. But it's more framework than a small API and a few pages need, and
  our lighter service patterns fit shared HOT tooling better. A fair option, just
  heavier than warranted.
- **Litestar + HTMX + Postgres + Kubernetes.** What we chose. A typed async Python
  API, HTML rendered and owned by the server with HTMX for the interactive parts,
  and plain JavaScript only for the file transfer. It matches Field-TM, so we
  already know how to run it. It runs under Compose locally and Helm in
  production, Argo makes the processing steps explicit, and Postgres keeps state
  across restarts.

## Decision Outcome

Build `backend/uploader-api/` as a Litestar + HTMX service.

**Uploads.** The browser uploads straight to S3-compatible storage using
presigned multipart URLs. Postgres keeps ownership and status durable, and an
upload can resume after a page reload.

**Processing.** Finishing an upload starts an Argo Workflow to validate the
image, convert it to a lossless COG, create STAC metadata with
`stactools-hotosm`, and register it through the uploader API. This keeps the
steps visible and keeps database credentials out of workflow pods.

**Auth and UI.** Use the shared HOT login through Hanko and the same header as
the map frontend. HTMX handles interaction, with plain JavaScript reserved for
the multipart transfer.

**Running it.** Use Compose + Talos for local development and Helm for production.

### Consequences

The good: one login, recoverable upload state, visible processing steps, and a
stack that runs anywhere.

The cost: we run Postgres, the API, and Argo ourselves instead of leaning on
managed functions. That's more to operate than the old Lambda setup, so the
durability we're after depends on keeping that surface small.
