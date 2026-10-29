# Known limitations and honest verification boundaries

## External delivery

Live Mistral OCR/model availability, deployed HTTPS access, EAS account authorization/signing, and real-phone acceptance require external resources. Their actual status belongs in TEST_RESULTS.md. A signed local ARM64 APK has now been built and its demo/review/reattempt/persistence flow verified on an Android emulator; live document OCR and physical phones remain unverified. Source code, passing component tests and a release JS export do not prove an installable APK or a working phone camera. Do not call this fully accepted until the final phone flow has passed.

## OCR and correction

- Real RAS/JEE papers were not supplied. Current parser evidence uses representative synthetic fixtures. Run the live fixture test and inspect actual sources once supplied.
- Reading order follows Mistral's ordered blocks. Incorrect provider ordering is not automatically solved; compare the original and manually reorder/split/merge. Diagram association uses page-local Markdown references, not a separately trained layout model.
- Only explicit numbered question starts and supported option conventions are parsed confidently. Dense tables, unusual keys, inline multi-option layouts and unsupported types need manual correction. Numerical/multiple-select types require reliable section cues or explicit manual selection.
- Answer-key matching is conservative and limited to simple rows. Keys stay provisional until confirmed. Historical factual questions receive no guessed modern answers.
- Suspected watermarks/promotions are preserved in ignored content and can be restored; keyword rules can misclassify material.
- Optional AI boundary suggestions remain diagnostic; they are not auto-applied. No AI explanation-generation endpoint is implemented. Original demo explanations are explicitly labelled.
- KaTeX produces offline MathML for a controlled native WebView. Unsupported LaTeX shows a warning/raw expression. Android/iPhone WebView typography and long-equation behaviour still require device inspection. No claim is made that every OCR equation is correct.
- Original pages and available bounding metadata are preserved. The review shows full source pages rather than automatically generated per-question crops. Users can crop imported photographs manually using percentage coordinates.

## Native behaviour

- Camera/gallery/PDF selection and camera capture were exercised on the emulator using synthetic material. Secure storage and physical-phone behaviour need final hardware tests. Cache-only clearing did not complete in the final emulator check, so it is not recorded as a pass. SQLite persistence, numerical keyboard entry, math/diagram rendering, zoom and interrupted-attempt recovery have been exercised on the Android emulator. Component tests mock hardware. A Node SQLite adapter tests the real SQL and reopen behaviour but does not replace expo-sqlite on a device.
- PDF previews require a connected backend with Poppler. PDF sources are limited to 100 pages/25 MB; extract up to 20 selected pages at a time. Gallery inputs are JPEG/PNG; convert HEIC before importing.
- Image zoom includes buttons/scrolling on Android and iOS plus iOS pinch support. PDF preview thumbnails are 1000px; originals remain preserved, but a dedicated full-resolution native PDF viewer is not included.
- Timers continue to their deadline while backgrounded; actual OS scheduling cannot execute JS at the deadline when the process is stopped. On foreground/restart, expired attempts are submitted at the persisted deadline.
- Abrupt termination can lose at most the latest active-time checkpoint interval (normally up to 5 seconds), while saved responses/events remain. Device clock changes are not tamper-proof.
- SQLite stores validated entity snapshots/events as JSON rows rather than a fully normalized relational product schema. It is suited to this private prototype, with one migration and serialized transactional writes. It is not a multi-user synchronization service.
- Device data is not cloud backed up by the app. Uninstalling/deleting data can remove it. Pairing is separate from local data deletion.

## Backend operations

- Use one API process. The default Render blueprint selects Free compute and temporary `/tmp/attemply` storage, so server uploads/jobs are lost on restart, redeploy or idle sleep. Re-prepare retained phone sources after server storage loss. Durable server recovery requires an explicitly paid service with a persistent disk. The processing queue is in memory; interrupted jobs are retryable failures only when their files survive. This is not a distributed job queue.
- Sources/raw responses have short-term retention for retry/debug. Retention cleanup runs at startup and every ten minutes while the processing queue is idle. The app's server-delete action provides explicit removal. Host/disk access must remain private.
- Upload and OCR processing are bounded, with rate limits, provider timeouts, disk cleanup and per-device reads. A proper private HTTPS deployment remains required; the local development server is not a deployed backend.
- The Docker/Render blueprint was prepared; no container/hosting build is claimed without a successful run. Review hosting billing and credentials before deployment.
- Remaining npm audit advisories, if any, are recorded in TEST_RESULTS. Do not run `npm audit fix --force` blindly: it currently proposes downgrading Expo to an incompatible SDK. Direct server dependency updates were applied during development.
