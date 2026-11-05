# FlowPilot — local-first lead qualification

FlowPilot is an independent portfolio project for capturing inquiries, qualifying them with local AI, and helping a manager review the next step in one workspace. It is a demonstration project, not a client engagement or commercial deployment.

## Verified product capabilities

- Inquiry intake backed by PostgreSQL, including duplicate detection by normalized email.
- Dashboard analytics queried from the database, with 7, 30, and 90 day ranges.
- Inbox search, status/category/priority/source filters, sorting, and direct lead links.
- Lead details with classification, score, sentiment, intent, summary, activity history, and editable suggested reply.
- Local Ollama qualification with deterministic Demo Mode fallback when the model is unavailable.
- n8n workflow orchestration, with qualification and error-recording workflows.
- Lead deletion with confirmation and transactional activity-history cleanup.
- Local Docker Compose services for the web app, API, PostgreSQL, n8n, and Ollama.

Suggested replies are drafts; FlowPilot does not send messages automatically. Sample lead records are fictional. No customer results, revenue, or conversion claims are made.

## Technology

React, TypeScript, Vite, Node.js, PostgreSQL, n8n, Ollama, and Docker Compose.

## Portfolio assets

- `PORTFOLIO-COPY-EN.txt` and `PORTFOLIO-COPY-UK.txt` — bilingual descriptions.
- `DEMO-VIDEO-SCRIPT.md` and `sources/` — editable narration and production notes.
- `assets/` — destination structure for verified screenshots, video, subtitles, PDF, and thumbnails.
- `ASSET-MANIFEST.md` — capture and delivery status.

Capture screenshots and footage only from the running application. Credentials and personal data must remain outside portfolio materials.
