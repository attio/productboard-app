# AGENTS.md

This file provides guidance to AI agents who are working on the code in this repository.

## Context

This repository contains an app built with the Attio App SDK.

### What the app does

Productboard integration for Attio. It lets users send product feedback straight from Attio to Productboard: a record action on People and Companies opens a "Send feedback" dialog, and the same flow is available from call recording transcripts, insights, and summaries (select text, send it as feedback) and from a workflow step block for automations. Feedback is created as a Productboard note and linked to a customer resolved from the person's email (or a placeholder derived from the company's domain when only a company is selected). If the customer doesn't exist yet in Productboard, it's created automatically before the note is retried.

### What is the App SDK?

The App SDK is a set of components and functionality to build apps that are embedded directly in the Attio CRM platform.

#### App SDK capabilities

- Use React to render components provided by the `attio/client` package.
- Run server-side code and make API calls to external services using `.server.ts` files.
- Store API tokens using the connections system.
- Receive incoming requests from third-party services via webhooks.
- Subscribe to events e.g. connection.added
- Manage form rendering, validation and submission with `useForm()`.
- Manage data fetching and async caching with `useAsyncCache()` and `useQuery()`.

## App SDK entry points in use

- **Record actions** — `send-to-productboard` (People) and `send-to-productboard-company` (Companies) open a "Send feedback" dialog pre-filled from the record, resolved via GraphQL.
- **Call recording text-selection actions** — `send-feedback` (transcript), `send-feedback-insight`, and `send-feedback-summary` let a user select text from a call recording and send it to Productboard as feedback, attributing it to the matching speaker/participant where possible.
- **Workflow step block** — `send-feedback-to-productboard` mirrors the record actions for use in workflow automations: pick a person and/or company, supply feedback text and an optional tag.
- **Connection event** — `events/connection-added.event.ts` verifies the Productboard connection (a lightweight authenticated request) when a workspace connects it; throwing here blocks the connection from being created.

## Source folder structure

| Path                        | Description                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app.ts`                 | App manifest — registers record actions and call-recording text actions.                                        |
| `src/app.settings.ts`        | App-level settings schema.                                                                                       |
| `src/attio/get-record.server.ts` | Server-side REST lookup of a person/company's name + email/domain by record ID. Used where GraphQL's `runQuery` isn't available (workflow block `execute.ts`, call-recording server files). |
| `src/blocks/send-feedback-to-productboard/` | Workflow step block — block definition, configurator, execute.                                    |
| `src/call-recording/transcript/` | Transcript text-selection action, its feedback dialog, and server helpers to resolve the speaker/participant from the call recording. |
| `src/call-recording/insight/`, `src/call-recording/summary/` | Insight/summary text-selection actions — reuse the transcript feedback dialog. |
| `src/events/`                | Connection lifecycle handler (`connection-added.event.ts`).                                                      |
| `src/productboard/`          | Productboard REST API wrapper. `client/productboard-client.ts` is the core fetch+validate client (never throws, returns an `AsyncResult<T, ProductboardClientError>`) plus pagination helper; `client/errors.ts` maps client errors to a user-facing `ProductboardUserError`. Each resource has its own `<resource>/api.ts` factory (`customers`, `notes`, `features`, `tags`) returning `AsyncResult`-based methods, mirroring the linear app's per-resource API pattern. `create-note.server.ts` composes the customers + notes APIs into the single feedback-submission entry point (resolves the customer, retries on "not found"). `list-tags.server.ts` / `list-features.server.ts` are thin wrappers around the tags/features APIs that swallow errors into an empty array for UI call sites. `types.ts` holds shared domain types. |
| `src/record/actions/`        | Person/Company record actions, their feedback dialogs, GraphQL queries to read the record, and the tags combobox options provider. |

## External service

- **Service:** Productboard (product management — features, notes/feedback, customers).
- **API:** REST v2 — `https://api.productboard.com/v2` (docs: https://developer.productboard.com).
- **Auth:** workspace connection — calls send `Authorization: Bearer <connection.value>`, retrieved via `getProductboardAccessToken()` (wraps `getWorkspaceConnection()`) in `src/productboard/client.ts`.
- **Required scopes:** `entities:read entities:write notes:read notes:write users:pii:read`.

## Environment

Code for the app may run either in a client-side or server-side context.

### Client-side code

Client-side code runs in the browser. However, it runs inside a safe sandbox, using a custom JS runtime. This means that:

- You MUST NOT render HTML tags directly e.g. `<div>Hello</div>`. Instead, you MUST only use components provided by the App SDK.
- You MUST NOT use custom styles or CSS. Only use the pre-styled components provided by the App SDK.
- You MUST NOT try to read the DOM directly.
- Some browser APIs may not be available.
- `fetch` calls are not allowed. You MUST NOT call `fetch` directly and should instead use `fetch` via server-side functions.

Files which render React components MUST use the `.tsx` extension.

### Server-side code

Server-side code runs in files ending in:

- `.server.ts`
- `.webhook.ts`
- `.event.ts`

Workflow block files will also run in the server (excluding configurators).

Code that any of the above files import will also run in a server-side environment.

Server-side code DOES NOT run in Node.js but instead in a custom JS runtime. While many Node.js APIs are supported, some are not and you may need to factor this into your decision to use certain packages.

## Using the Attio App SDK

Attio provides three packages to help you build apps:

1. `attio/client` - for client-side imports
2. `attio/server` - for server-side imports
3. `attio` - for shared/environment-agnostic imports

IMPORTANT: Before importing from these packages, you MUST always check one of the following to confirm that your import is correct:

1. Existing examples in the codebase
2. TypeScript type definitions and JSDoc strings for the package
3. The Attio SDK documentation

If you are unsure about an import, always check explicitly and do not guess.

## Coding guidelines

- You SHOULD use Zod to validate data from public APIs.
- You SHOULD only include properties in Zod schemas that we explicitly need.
- You SHOULD use try/catch around calls to `.json()`.
- You SHOULD use console.error to capture information about unexpected errors.
- You MUST NOT log sensitive information such as email addresses or passwords.
- You MUST handle API errors gracefully. Do not throw an error within a React component, but instead return a clear fallback UI.
- When `getUserConnection()` / `getWorkspaceConnection()` is called, you MUST NOT wrap it in a try/catch. These functions throw special errors that power the connection dialogs in the UI.
- You SHOULD prefer named arguments over positional arguments when using 3 or more arguments.
- You MUST NOT use `any` when typing your code. Type errors MUST be fixed properly as usage of `any` is a likely source of bugs.
- You SHOULD order functions/values within code so that all values are defined before being used. Default export should go at the bottom of a file.
- API wrappers MUST NOT leak transport-layer details (e.g. HTTP status codes) to callers — return a domain error such as `ProductboardClientError` instead. All Productboard calls in `src/productboard/*/api.ts` return a `@attio/fetchable` `AsyncResult` rather than throwing.

### App-specific guidelines

- Prefer GraphQL (`runQuery` from `attio/client`) over the REST API to read Attio record data — see `src/record/actions/get-person-data.graphql` / `get-company-data.graphql`. `runQuery` is only available client-side; server-side code (workflow block `execute.ts`, call-recording `.server.ts` files) has no GraphQL runner and must use `src/attio/get-record.server.ts` (REST, via `ATTIO_API_TOKEN`) instead of hand-rolling another fetch against `/v2/objects/{object}/records/{id}`.
- Resource API calls go through `src/productboard/<resource>/api.ts` (`customers`, `notes`, `features`, `tags`), each a `create<Resource>Api()` factory built on `productboardClient`/`fetchAllProductboardPages` from `src/productboard/client/productboard-client.ts`. Do not call `fetch` or the core client directly from record actions, the workflow block, or `.server.ts` files — go through a resource API.
- `submitProductboardInsight` (`src/productboard/create-note.server.ts`) is the single entry point for creating a Productboard feedback note — it composes the customers and notes APIs and returns a `@attio/fetchable` `AsyncResult` rather than throwing. Callers use `isErrored(result)` and read `result.value` / `result.error`.
- Productboard v2 does not auto-create customers on note creation. `submitProductboardInsight` detects a "customer not found" error (`isCustomerNotFoundError` in `src/productboard/client/errors.ts`), calls `customers.ensure()`, then retries note creation with backoff (a freshly created customer can take a moment to become linkable). Keep this retry behaviour when touching that file.
- The person and company "Send feedback" flows (record actions, dialogs, workflow block) deliberately mirror each other. When changing one, check whether the other needs the same change.

### Error messages (user-facing)

- Never dump raw JSON, HTTP status codes, or square brackets in UI error messages.
- Never expose transport-layer details — say "An unexpected error occurred when calling Productboard's API" not "503 from Productboard".
- Auth/scope errors MUST name the missing scope and tell the user to reconnect Productboard — see `toProductboardUserError` in `src/productboard/client/errors.ts`.

### Testing

- Where appropriate, use Vitest to run tests.
- Aim to implement unit testing where it helps increase confidence in the correctness of code.
- Do not test React components using react testing library or similar.
- When passing functions/classes to describe, pass the value directly, do not specify a name in quotes e.g. `describe(myFn, () => {/* ... */})`, not `describe("myFn", () => {/* ... */})`.

## Validation

- You MUST validate all your changes using the commands provided in package.json.
- Run and fix lint rules: `pnpm run lint:fix`
- Validate unused code: `pnpm run knip`
- Run tests: `pnpm run test`
- Validate the build: `pnpm run build`
