# FlowPilot

FlowPilot is an independent, local-first portfolio project that turns incoming inquiries into organized business opportunities. It demonstrates an end-to-end lead workflow: validation, normalized-email duplicate tracking, local classification, reviewable suggested replies, status management, and an activity history.

## Local architecture

- **React, TypeScript, Vite** for the dashboard, lead inbox, manual review, integration status, and public demo form.
- **Node.js, Express, TypeScript** for the API, input validation, manager actions, qualification fallback, and workflow callbacks.
- **PostgreSQL 16** keeps application data in `flowpilot` and n8n's internal state in a dedicated `flowpilot_n8n` database owned by its separate login role.
- **n8n 1.76.1** for the imported qualification and centralized error workflows.
- **Ollama 0.5.7** with the adjustable `smollm2:1.7b` model for local inference. The system switches to deterministic Demo Mode when the model is absent or unavailable.
- **Docker Compose** binds published service ports to localhost and persists database, n8n, and model data in named volumes.

No email or message sending integration exists. Suggested replies are drafts for a manager to review and send using their normal process. The bundled 24-lead CRM dataset is synthetic. It uses fictional contacts, reserved `.invalid` addresses, and fictional phone numbers; seeded leads are marked **Synthetic demo** in the interface and activity history.

## Start on Windows

1. Install and start Docker Desktop with its Linux engine available to your Windows account.
2. Run `RUNLOCALLY.bat`. First start generates `.env` secrets, starts PostgreSQL, provisions `flowpilot_n8n`, copies any existing `n8n` schema tables into it transactionally, fixes the n8n settings-file permissions, then starts the app services, imports workflows with stable IDs, and pulls the model if absent.
3. Open [http://localhost:5173](http://localhost:5173). On first visit to n8n at [http://localhost:5678](http://localhost:5678), create its local owner account.
4. Stop with `STOPLOCALLY.bat`. Volumes and leads are preserved. `TESTLOCALLY.bat` runs unit tests, production builds, and Compose configuration validation.

After startup, run `docker compose exec -T api npm run seed` to add 24 synthetic leads across the existing workspace. The seeder is idempotent, preserves conflicting or unrelated records, applies the safe additive analytics migration, and removes only the confirmed placeholder lead when its UUID and all identifying fields match.

## Development without Docker

Install dependencies with `npm install`, ensure a local PostgreSQL database matches `DATABASE_URL`, apply `api/sql/init.sql`, then use `npm run dev`; the API applies the idempotent analytics-column migration before listening. To seed locally, set `DATABASE_URL` and run `npm run seed`. When Ollama is unavailable, qualification uses deterministic local rules and is labeled **Demo Mode** in the interface. Without PostgreSQL, API persistence, dashboard data, and intake cannot function.

## Workflow behavior

The API commits a lead before dispatching a webhook, so long inference does not block the form. The qualification workflow loads lead data, calls Ollama, validates structured output or selects its deterministic fallback, then sends the result to the API for validation and persistence. API-level fallback also runs if n8n is unreachable. The error workflow records failed runs in `workflow_errors`. Import JSON files from `n8n/workflows/` if you prefer to load them manually.

For an existing database, the `n8n-db-migrate` one-shot service runs independently of PostgreSQL initdb scripts. The safe manual sequence is to stop n8n, run `docker compose run --rm --no-deps n8n-db-migrate`, repair the n8n data-volume permissions, then restart only `api` and `n8n`. The old application-database `n8n` schema remains as an admin-owned archive after successful migration.

## Portfolio materials

See [`For Audience/README.md`](For%20Audience/README.md), the English and Ukrainian project copy, and the demonstration video script. Screenshots are included only when captured from a running instance; they are not generated mockups.

## Current verification note

Build, test, compose, service-health, and browser results should be reported from the actual machine running this project. Docker Desktop was installed at the time of implementation, but the Linux engine pipe denied access to the current Windows account, preventing live-container and database verification in that session.
