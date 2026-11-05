# Architecture

## Services

- **Web** — React and TypeScript single-page application built with Vite. The production image serves the compiled client and proxies API requests to the API service.
- **API** — Express and TypeScript endpoints validate intake and manager actions, persist leads and activity, expose dashboard analytics and health, and coordinate qualification.
- **PostgreSQL** — application data lives in the flowpilot database. n8n uses a separate database and login role.
- **n8n** — runs the imported qualification and workflow-error workflows. The API commits the lead before dispatching a webhook so inference does not block intake.
- **Ollama** — local model inference. The configured model defaults to smollm2:1.7b.
- **Demo Mode** — deterministic local qualification used when the model is unavailable, and as an API fallback when n8n cannot be reached.

## Qualification flow

1. The API validates and persists an inquiry, including duplicate detection based on normalized email.
2. The API dispatches the lead ID to the configured n8n webhook, or runs its local fallback if no webhook is configured.
3. The workflow loads lead data and requests structured qualification from Ollama.
4. The API validates and stores the result, then records an activity event. Workflow failures are recorded in workflow_errors; local fallback keeps the lead available for review.
5. A manager reviews the result and suggested reply. No outbound messaging integration is present.

## Data and local deployment

Docker Compose defines PostgreSQL, API, web, n8n, a one-shot n8n database migration service, an n8n permissions initializer and Ollama. Service ports bind to loopback. PostgreSQL, n8n and model files use named volumes. The PostgreSQL init scripts create the application schema and n8n database role; the migration service handles existing installs separately from first-run initialization.

See the root [docker-compose.yml](../docker-compose.yml), [environment example](../.env.example) and [quick start](../README.md#run-locally) for the concrete setup.
