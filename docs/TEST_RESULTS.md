# Verification record

Date: 30 October 2026 (Asia/Kolkata). No live credentials or original user PDFs were available.

## Passed source checks

| Command | Actual result |
| --- | --- |
| `npm run typecheck` | Strict shared/API/mobile/test TypeScript passed |
| `npm run lint` | Passed |
| `npm test` | **60 passed, 3 explicitly skipped** |
| `npm run test:mobile` | **11 passed** using React Native Testing Library / Jest Expo |
| `npm run build:api` | Production TypeScript output generated |
| `cd apps/mobile && npx expo-doctor` | **20/20 checks passed** |
| `npx expo export --platform android --output-dir dist/android` | Android Hermes release JavaScript bundle exported successfully |
| `npx expo prebuild --platform android --no-install` | Native Android project generated successfully |
| `npm audit --workspace @attemply/api --omit=dev` | **0 production API dependency advisories** after updating supported SDK validation dependencies |

The three skipped tests cover real credentialed PDF OCR, user OCR ZIP fixtures and user unpacked OCR export fixtures. These inputs were missing. Adding corresponding files under `fixtures/` automatically enables those paths; PDFs additionally require MISTRAL_API_KEY. No user RAS/JEE paper was tested.

The full workspace audit still reports **16 toolchain advisories (13 low, 3 high)** through Expo/Jest dependencies, including deepmerge and the Expo toolchain's older Zod. Direct backend validation and the Mistral runtime SDK dependency tree use patched Zod 4.6.7. Do not blindly force an SDK downgrade to make the tooling audit disappear. Machine-readable results: DEPENDENCY_AUDIT.json and BACKEND_DEPENDENCY_AUDIT.json.

## Coverage boundaries

Vitest tests RAS numeric options, JEE letter options, OCR block reading order, LaTeX preservation, cross-page continuity, sections, repeated diagram IDs, multiple diagrams, ignored promotions, missing diagrams/options, duplicate numbering, merged options, key matching and empty extraction. They also test the CBT event/state machine, negative marking, partial/ungraded results, numerical tolerance, exact multiple-select, review flags, no background-time double counting, revisit timing, correct→incorrect changes, deadline expiry, duplicate submissions, student mistake tags and independent reattempts.

API integration tests exercise actual Fastify routes, expiring authentication, per-device ownership, MIME validation, malformed PDFs, real Sharp/Poppler previews from synthetic sources, queued jobs, raw result preservation, OCR ZIP imports, deterministic analysis fallback and rejection of invented AI evidence IDs. **Mistral providers are mocked in these integration tests.**

Persistence tests run the actual schema/migration and SQL writes against a real Node SQLite database through an expo-sqlite-compatible adapter. They reopen storage, verify responses/events/deadlines, exclude closed-app time, prevent double counting and delete data. This establishes SQL/recovery behaviour; device-native bindings require the emulator/phone checks below.

Native component/provider tests cover Home/demo entry, attempt creation, answering, clear/review controls, computed result screens, user-chosen mistake reasons, denied camera-permission recovery, Home deadline submission, full saved history and source recovery/protection. Hardware modules are mocked. They are not screenshots or real-device E2E.

## Real local API

The compiled backend was started successfully on port 3001. An actual request to `http://localhost:3001/health` returned:

```json
{"ok":true,"service":"attemply-lab","ocrConfigured":false}
```

This is a local health verification only. The actual local pairing endpoint also returned HTTP 200 and an expiring token, without printing the setup code or token. Pairing/session edge cases are additionally verified by API integration tests. Live Mistral OCR, account model access and text generation are **not verified** without server credentials. No hosted HTTPS endpoint is claimed.

## Android build / native acceptance

- **Local ARM64 standalone APK built successfully**, signed with the generated local development certificate. `artifacts/attemply-lab-1.0.0-arm64.apk` is the actual 43,843,721-byte artifact. `artifacts/APK_INFO.json` records SHA-256, architecture and bundle inspection. Android v2 signature verification passed (APK_SIGNATURE.txt).
- Package `com.attemply.lab`, version 1.0.0 / versionCode 1, ARM64-v8a, minimum Android API 24. EAS preview remains configured for an APK; EAS itself reports **Not logged in**, so no cloud build or EAS URL is claimed.
- Final source-aligned build passed in 21 seconds with cached dependencies. The preceding clean-cache delivery build passed in 19m06s, including dependency downloads; the initial ARM64 build took 9m34s. See ANDROID_DELIVERY_FINAL_BUILD_LOG.txt, ANDROID_DELIVERY_BUILD_LOG.txt and ANDROID_BUILD_LOG.txt. The initial all-architecture attempt was stopped deliberately for resource usage and retained separately.
- The APK contains `assets/index.android.bundle`. Artifact inspection found no server-only secret identifiers or Mistral backend SDK module. Source-map inspection also excluded server API sources. No actual Mistral credential was available, so this is a separation/bundle-content check, not a scan for an existing real key.
- **Installed and launched on the actual Pixel 10 Pro Android emulator without Metro.** Camera/gallery/PDF checks below were also performed on the emulator; physical-phone acceptance remains separate.
- **Complete eight-question native demo submitted:** seven correct, one deliberately incorrect, score **27/32**, 100% attempt rate, displayed graded accuracy 88%, negative marks −1. The result came from the entered responses.
- Exercised answer selection/change/clear, review flag, navigation, palette/revisit, real numerical keyboard input, multiple-select and mathematical-option tapping. Fraction/superscript rendering and original triangle diagram/zoom worked in native WebViews/Image views.
- **Interrupted attempt recovery passed:** replacing/reopening the APK resumed Question 5 with earlier responses preserved. Revisit retained Question 1's selected answer and review flag.
- Analysis reported actual recorded visits, answer changes and active timing. AI refresh without pairing kept deterministic observations and showed the connection requirement. No generated analysis was falsely claimed.
- A chosen **Calculation error** tag was saved to the wrong question. Its new independent reattempt scored **4/4**. Both 27/32 and 4/4 remained in history after another APK replacement/reopen; HISTORY_UI.json contains the observed native UI evidence.
- Actual emulator input checks passed: denied camera permission offered gallery/settings recovery; granting permission mounted the camera and captured a JPEG. Rotation and an 80% crop completed successfully. The system photo picker imported a synthetic PNG, and the document picker imported an actual two-page synthetic PDF (1410 bytes). The source workspace correctly required backend setup for live OCR rather than manufacturing questions. The final cache-only clearing check did not complete and is **not counted as passed**; ordinary restart/history persistence checks above did pass.
- Source recovery/full-history regressions cover re-preparing from retained files, replacing the previous draft without duplicate questions, protecting originals used by saved attempts, and retaining access to attempts beyond the twentieth.
- Device review found and fixed excess WebView math height and indistinguishable marked palette states. A further Home-deadline bug has a native provider regression test and is included in the final APK. Its one-minute emulator check passed: submission occurred while Home stayed open, the result showed exactly 01:00 elapsed, and analysis showed only 2 seconds active reading. DEADLINE_HOME_UI.json, DEADLINE_RESULT_UI.json and DEADLINE_ANALYSIS_UI.json contain the observed evidence.
- **Final delivery artifact smoke/restart passed:** the exact APK recorded in APK_INFO.json installed and launched without Metro, accepted Question 1 option B, confirmed 1 answered / 7 unanswered, and computed **4/32**, 1 correct, 0 incorrect. After force-stop/relaunch, Home retained **1 saved** and **4/32**. A 320dp-wide screen was inspected; the header wraps within its bounds. Evidence: DELIVERY_RESULT_UI.json, DELIVERY_RESTART_UI.json and delivery screenshots. No ReactNativeJS/AndroidRuntime error appeared in the inspected delivery log window.
- Native evidence images are in `docs/screenshots/`. Transient captures before image/math loading are not evidence of a permanent rendering failure.
- Disposable task-specific Gradle caches are cleaned after retaining the final artifact/logs to recover disk space. Future local builds may download caches again. The installed Android SDK components remain available.

## iPhone and live-document acceptance

Full Xcode Simulator tooling, Apple signing authorization and an iPhone were not available. iOS source compatibility is configured but not device verified. Camera photo → real OCR → corrected question → graded CBT → AI report and multi-page real PDF extraction remain blocked by missing credentials/host/material and still need phone acceptance.
