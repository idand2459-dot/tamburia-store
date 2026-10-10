---
name: error-handling
description: Design or review how errors are detected, classified, logged, and returned. Use when adding an API error response, choosing an HTTP status code, shaping an error payload, writing retry logic, adding error logging, or surfacing a failure in the UI. Covers the standard error shape, status-code table, logging redaction, retry policy, and required failure-path tests.
---

# Error Handling

## Principles
- Fail fast on invalid input.
- Return safe, actionable messages to clients.
- Keep internal details in logs, never in external responses.
- Use one consistent error shape and status-code convention everywhere.

## Categories
| Category | What it means |
|---|---|
| Validation | Input missing, malformed, or out of range (e.g. a required field is missing) |
| Domain | Business rule violated (e.g. an order whose prices changed since the cart was filled) |
| Infrastructure | Network, database, queue, or third-party failure |
| Auth | Missing credentials, invalid token, insufficient resource access |

## API response shape
Every non-2xx response is `{ "error": "<user-facing message, in Hebrew>" }`, with
optional `details` for validation context. Throw `AppError(status, message, details)`
(`server/utils/AppError.js`) from controllers, services and models;
`server/middleware/errorHandler.js` turns it into the response, and maps PostgreSQL and
upload errors to a status and message.

Never include secrets, stack traces, SQL text, or raw provider payloads in a response.
The existing exception is `errorHandler.js:62` (non-production 5xx only); see the backlog.

## Status codes
| Code | Use for |
|---|---|
| `400` | Malformed or invalid input |
| `401` | Not logged in as admin, or a wrong password |
| `404` | Missing resource or route |
| `409` | State conflict: a duplicate value, a broken reference, or changed prices |
| `413` | Uploaded file too large |
| `415` | Unsupported file type (HEIC) |
| `429` | Too many login attempts |
| `500` | Unexpected internal error |
| `503` | Database unavailable |

## Logging
- Log every unexpected error with enough context to debug it.
- The central handler logs every 5xx with `console.error`, the method, and the URL
  (`server/middleware/errorHandler.js:52`).
- Redact tokens, passwords, credentials, and secrets.

## Retry and recovery
- Retry **only** transient infrastructure errors.
- Bounded retries with backoff — never an unbounded loop.
- Never retry validation or domain errors.
- Make retried operations idempotent where possible.

## Frontend and UX
- Show user-safe, specific messages. Avoid a bare "Something went wrong" when
  the failed action is known.
- Offer a recovery hint: retry, refresh, re-authenticate.
- The client reads `error` through `client/src/js/utils/apiErrors.js`.

## Tests
Critical flows need tests for their failure modes: validation errors,
authorization failures, and dependency failures. Assert the response shape,
not just the status code.
