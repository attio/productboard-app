# productboard

Attio app integrating with [Productboard](https://productboard.com) — product management and customer feedback.

## Overview

Send product feedback to Productboard without leaving Attio. Feedback can be sent from a Person or Company record, from selected text in a call recording transcript/insight/summary, or from a workflow automation — each flow creates a Productboard note linked to the right customer.

## Features

- **Send feedback from a record** — a "Send feedback" action on People and Companies opens a dialog to write feedback and (optionally) tag it.
- **Send feedback from a call recording** — select text in a transcript, insight, or summary and send it straight to Productboard, attributed to the matching speaker where possible.
- **Workflow step block** — send feedback for a person and/or company as part of an Attio workflow automation.
- **Automatic customer resolution** — feedback is linked to a Productboard customer by email; if the customer doesn't exist yet, it's created automatically before the note is retried.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm run dev
```

## Commands

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `pnpm run dev`          | Start dev server         |
| `pnpm run build`        | Build + type-check       |
| `pnpm run lint`         | Run ESLint               |
| `pnpm run lint:fix`     | Run ESLint with auto-fix |
| `pnpm run format`       | Format with Prettier     |
| `pnpm run format:check` | Check formatting         |
| `pnpm run test`         | Run tests                |
| `pnpm run knip`         | Check for dead code      |

## Source folder structure

| Path                        | Description                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app.ts`                 | App manifest — registers record actions and call-recording text actions.                                        |
| `src/attio/get-record.server.ts` | Server-side REST lookup of a person/company's name + email/domain by record ID.                              |
| `src/blocks/send-feedback-to-productboard/` | Workflow step block — block definition, configurator, execute.                                    |
| `src/call-recording/`        | Transcript/insight/summary text-selection actions, the shared feedback dialog, and speaker/participant lookup.  |
| `src/events/`                | Connection lifecycle handler (`connection-added.event.ts`).                                                      |
| `src/productboard/`          | Productboard REST API client, note creation with customer resolution/retry, feature/tag listing, and types.     |
| `src/record/actions/`        | Person/Company record actions, feedback dialogs, GraphQL queries, and the tags combobox options provider.       |

See [AGENTS.md](./AGENTS.md) for full SDK usage notes and coding guidelines.
