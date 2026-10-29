# Attemply Lab

A native Expo app for turning printed questions into private practice tests, with a Node OCR service and deterministic attempt analysis.

**An installable local Android APK is available at `artifacts/attemply-lab-1.0.1-arm64.apk` (ARM64, about 42 MiB).** It was built, signed, installed and demo-tested on an Android emulator without Metro. See ANDROID_APK.md for installation and remaining verification limits.

The **1.0.1** Android update fixes SDK 58 PDF/photo/JSON/ZIP multipart uploads. See [the upload-fix verification](docs/UPLOAD_FIX_1.0.1.md).

**Start with the offline demo.** It requires no account, API key or backend. Live OCR requires your own configured backend and Mistral account. This repository is a private prototype; see the verification status in [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md).

## Quick start

Use Node 24 LTS and npm. From this folder:

```sh
npm ci
npm run mobile
```

Open the app in a compatible SDK 58 development client. Choose **Try demo CBT**, configure a test, answer/clear/change/flag/navigate, submit, inspect analysis, tag a mistake, and reattempt. A preview APK, once successfully built, includes its JavaScript and works without Metro.

For a local backend:

```sh
cp -n services/api/.env.example services/api/.env
npm run api
```

Enter your server values in that `.env` file. Install Poppler for PDF thumbnails (`brew install poppler` on macOS, `apt-get install poppler-utils` on Debian). In the app open **Connection & local data**, enter the reachable backend URL and private setup code, then pair. Release apps require HTTPS. Development clients permit HTTP for a local LAN backend.

## The journey

Home → camera/gallery/PDF → prepare and select pages → OCR job → editable question workspace → confirmed keys or ungraded questions → CBT → results → evidence-based analysis → review/mistake tags → new reattempt → saved history.

No login, payments, leaderboard or social features. Pairing secures a private API; it is not an end-user account system.

## Project map

- `apps/mobile/app/`: Expo Router native routes.
- `apps/mobile/src/screens.tsx`: complete product screens and orchestration.
- `apps/mobile/src/ui.tsx`: accessible controls, source zoom and offline mathematical rendering.
- `apps/mobile/src/storage.ts`: SQLite migration, serialized writes and retained files.
- `apps/mobile/src/store.tsx`: persistent app state and lifecycle handling.
- `services/api/src/`: secure upload/job API and official Mistral SDK integration.
- `packages/shared/src/`: validated models, parser, CBT transitions, grading, analytics and original demo questions.
- `fixtures/`: clearly labelled synthetic RAS/JEE parser inputs. Keep private real documents out of public version control.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:mobile
npm run build:api
cd apps/mobile
npx expo-doctor
npx expo export --platform android --output-dir dist/android
```

Vitest covers shared logic, real SQLite storage through a Node adapter, PDF previews and authenticated API integration. API test OCR is explicitly mocked. Native component tests mock hardware modules. Neither replaces real phone acceptance.

## Guides

- [Setup and phone testing](docs/SETUP.md)
- [Android APK and iPhone development](docs/ANDROID_APK.md)
- [Keys, pairing and HTTPS hosting](docs/API_KEYS.md)
- [OCR pipeline and API reference](docs/OCR_PIPELINE.md)
- [Actual test results](docs/TEST_RESULTS.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Resumable implementation status](IMPLEMENTATION_STATUS.md)

The demo and triangle artwork are original sample content supplied with this prototype. OCR quality, answer keys and source reading order require human review. A successful JS bundle is not evidence of an installed native app or live OCR.
