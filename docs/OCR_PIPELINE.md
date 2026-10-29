# OCR, question extraction and API

## Processing

1. Camera/gallery/document picker imports are copied from temporary picker cache to app-owned persistent storage. Photo transformations create a separate copy; the uncropped original is preserved.
2. Protected `/v1/documents` validates MIME against JPEG/PNG/PDF signatures, limits uploads to 25 MB, validates PDFs using pdf-lib and images using Sharp. PDFs are capped at 100 source pages and rasterized by Poppler for native thumbnails. The user chooses up to 20 pages and their order.
3. Protected `/v1/imports` stores a disk-backed job. A bounded queue uses one OCR slot. Status transitions are queued → ocr → parsing → complete/failed. App polling can resume after reopening the import workspace; server restarts convert interrupted jobs into explicit retryable failures.
4. The official Mistral SDK verifies configured account models and calls `/v1/ocr` with server-only credentials, selected zero-based pages, extracted images, headers/footers, layout blocks and block confidence. The actual SDK response is preserved. SDK camelCase and export snake_case image fields are normalized separately.
5. OCR blocks are consumed in their supplied reading order, avoiding the common mistake of sorting both columns by y-coordinate alone. Without usable blocks, page Markdown is the fallback. This depends on the OCR provider's ordering; inspect JEE sources carefully.
6. Rules detect numbered question boundaries, `(1)`–`(4)` or A–D options, sections, question continuations, explicit numerical/multiple-select formats and diagrams. Repeated headers/promotions are retained as ignored content. Relative diagram IDs are namespaced by document and source page. Missing diagrams and duplicated/insufficient options require review. No answers are inferred.
7. Ambiguous questions can receive optional text-model boundary suggestions. Strict schema validation and exact-source-substring checks reject fabricated content. Suggestions are diagnostic only and never silently replace source questions or keys.
8. The editable workspace supports source comparison, text/LaTeX/option edits, type fixes, split/merge/reorder/delete, attached diagrams, ignored-block restoration and manually confirmed keys. Only ready questions enter CBT. Unsupported content stays preserved.

## Answer keys

Separate key pages pass through the same OCR service. A conservative parser recognizes rows such as `1: A` and `2: 3`. Matching uses source numbers and section context, refuses ambiguous matches, and reports unmatched entries. Imported source keys are provisional until the user confirms them. Other layouts require manual entry. No AI-generated key is used.

A test can remain ungraded. Deterministic grading uses only confirmed keys, exact set matching for multiple-select, configured tolerance for numerical answers, custom positive/negative marks and zero for unattempted questions. Results clearly identify partial key coverage. Later manual corrections add key revisions and recalculate reports without modifying submitted answers. Reattempts are separate attempts linked to their parent.

## Timing and analytics

The deadline is persisted and is independent of React timers. Backgrounding closes active question time. On restart, the last saved timestamp closes the prior active interval so closed-app time is excluded. Five-second active-time checkpoints limit timing loss on abrupt process death; answer events are saved immediately. Normal navigation/lifecycle changes flush the interval. Multiple submissions are idempotent.

Analytics calculate marks, attempted/correct/incorrect/unattempted, accuracy over graded attempted questions, attempt rate, per-question active/revisit time, visits, flags and answer changes. Priorities use explicit rules, including recorded correct→incorrect changes, high-time errors, marked unanswered questions and student tags. Mistake reasons are only student input.

Optional AI selects up to four observations from deterministic candidate facts/next steps. It returns IDs under strict validation; displayed factual text is constructed from recorded metrics. It cannot create scores or claim causes, topics, psychological traits or mastery. If unavailable, deterministic observations remain visible offline.

## Endpoint reference

Except `/health` and pairing, all routes need `Authorization: Bearer SESSION_TOKEN`. Errors are `{ "error": { "code": "…", "message": "…" } }`.

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/health` | Service health and whether OCR key is configured |
| POST | `/v1/auth/pair` | JSON `{code,deviceId}` → expiring token |
| GET | `/v1/capabilities` | Account model availability, import limits |
| POST | `/v1/documents` | Multipart `file` → private document ID/page count |
| GET | `/v1/documents/:id/pages/:page` | Protected zero-based JPEG thumbnail |
| POST | `/v1/imports` | JSON `{documentId,pages,purpose:"questions"|"key"}` → 202 job ID |
| GET | `/v1/imports/:id/status` | Actual job state/error |
| GET | `/v1/imports/:id/result` | Raw OCR, normalized pages, editable questions, ignored content, source keys, diagnostic suggestions |
| POST | `/v1/analysis` | Validated submitted attempt → deterministic observations plus optional AI-selected candidates |
| POST | `/v1/debug/import` | Multipart OCR JSON/ZIP → parsed diagnostics, no OCR call |
| DELETE | `/v1/data` | Delete this paired device's retained server sources/jobs when processing is idle |

The backend never accepts a client file path or arbitrary OCR URL. Inputs are bounded uploads. HTML from OCR is never executed; question text is escaped before controlled WebView rendering. KaTeX trust mode is disabled. Pairing credentials are separate from diagnostics.

## OCR exports and fixtures

Debug ZIP format: `document/pages/page-1/markdown.md`, optional `page-metadata.json`, and relative image files in that page folder. File names are never extracted onto the host filesystem; ZIP traversal paths are ignored and expanded data is bounded. Page metadata is preserved. Matching page-local image names do not overwrite one another. Raw Markdown/response, image mappings, source bounds and normalized JSON appear in the developer screen.

Place private user PDFs in `fixtures/` locally. The live fixture test runs only when PDFs and MISTRAL_API_KEY are both present; it is explicitly skipped otherwise. JSON fixtures are automatically parsed in the regression suite. `.gitignore` excludes real PDF/ZIP fixture content from publication. No user RAS/JEE PDFs were present during initial testing. The included JSONs are representative **synthetic** inputs, not evidence of accuracy on the user's actual papers.

References: [Mistral OCR API](https://docs.mistral.ai/api/endpoint/ocr), [Mistral document processing](https://docs.mistral.ai/studio/document-processing/basic_ocr).

## Provider rejection diagnostics

Failed job status includes `errorDetails` with allowlisted HTTP status, provider code, reason, numeric Retry-After seconds and a validated request ID when available. SDK request objects, raw upstream bodies, credentials and source content are never serialized into these diagnostics or structured failure logs. HTTP 429 alone does not identify whether the account hit throughput, workspace/organization quota or capacity. The health response includes `ocrDiagnosticsVersion: 1` to verify the diagnostic build has deployed. No automatic inference retry or quota bypass is added.
