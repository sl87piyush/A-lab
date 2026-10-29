# Attemply Lab — implementation status

Workspace: `/Users/tarunchoudhary/p/attemply lab app`.

## Implemented

- Expo SDK 58 / React Native 0.88 / strict TypeScript / Expo Router native application.
- Offline eight-question demo; timed and untimed CBT; palette, answers, changes, clear, flags, navigation, confirmation, deadline auto-submission.
- SQLite migrations, durable attempts/events/source metadata, persistent source files, restart recovery, key revision history and reattempt lineage.
- Deterministic grading, partial/ungraded reports, active timing, revisit timing, behaviour analytics, mistake tags and reattempts.
- Camera, gallery, PDF picker, retained original files, rotation, percentage-based cropping, backend PDF thumbnails and selected page order.
- Question editor, source comparison, diagram zoom, KaTeX-to-MathML WebView rendering, split/merge/reorder/delete, ignored-block restoration and manually confirmed keys.
- Secure Fastify API: setup-code pairing, expiring JWT, per-device ownership, validated uploads, bounded queue, disk-backed import jobs, Mistral SDK OCR, account model verification, source-backed boundary suggestions, safe AI insight selection, OCR ZIP/JSON debug imports.
- Docker / Render blueprint and EAS development, preview APK and production profiles.

## Verified delivery

- Final TypeScript, lint and production backend build passed.
- Expo Doctor: 20/20 checks passed.
- Android Hermes release JS bundle exported successfully (this is not an APK).
- 60 Vitest tests passed, 3 missing-input/credential tests skipped; 11 native component/provider tests passed.
- Native Android prebuild and ARM64 signed release APK build succeeded (42 MB). APK installed and launched on read-only Pixel 10 Pro emulator without Metro. Interrupted attempt resumed after replacing/reopening the APK. Math and diagram rendering/zoom verified; full submission scored 27/32; mistake tagging and an independent 4/4 reattempt passed. Saved history survived APK replacement/reopening. The Home deadline fix passed a real one-minute emulator check (01:00 elapsed, 2 seconds active reading). Camera denial recovery, capture, rotate/crop, gallery PNG and multi-page PDF picker tests passed. A final cache-only clearing check did not complete and is unverified. Final delivery APK includes full-history access, direct re-preparation and source protection, all covered by regression tests. The exact delivery APK also passed a fresh 4/32 submission, force-stop/restart history check and 320dp screen inspection.

## External verification still required

- MISTRAL_API_KEY is absent; no live OCR or text-model call has been claimed. Private pairing/session secrets were generated into ignored `services/api/.env` (mode 0600); the real local pairing endpoint returned 200 and an expiring token without printing values.
- No original RAS/JEE PDFs were present in fixtures. Parser evidence is synthetic.
- No Expo account session or hosting credentials were available. EAS preview build and HTTPS deployment have not run.
- Read-only Android emulator booted; no physical Android device is connected. iOS Simulator tooling is unavailable. Android emulator permissions, capture/pickers, rendering and restart acceptance passed. Physical-phone and iPhone acceptance remain unverified.

The local installable APK is `artifacts/attemply-lab-1.0.0-arm64.apk`; its SHA-256, size and ABI are recorded in `artifacts/APK_INFO.json`. See `docs/TEST_RESULTS.md` for complete evidence and external verification boundaries.
