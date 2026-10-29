# Setup

All project commands below start in `/Users/tarunchoudhary/p/attemply lab app` unless a `cd` is shown. Do not put secrets in chat or in files beginning `EXPO_PUBLIC_`.

## 1. Install

```sh
cd '/Users/tarunchoudhary/p/attemply lab app'
node --version
npm ci
```

Node 24 is used for the API (and the SQLite test adapter). The app uses Expo SDK 58, React Native 0.88.1 and React 19.3.0; these versions were installed using `expo install`. Keep React, React DOM and the test renderer aligned if upgrading. Use `npx expo install --check` from `apps/mobile` after dependency changes.

## 2. Try the complete demo

Install an SDK 58 compatible development client using the commands in ANDROID_APK.md. Then:

```sh
npm run mobile
```

Open the development-client link on a phone on the same network. Expo Go is only suitable if the installed version supports SDK 58 and these modules. A native development client is the dependable path. A release/preview APK needs no development server.

Tap **Try demo CBT**, start a timed test, try all answer controls, submit, inspect results/analysis, select a mistake reason, and reattempt. Turn off connectivity to confirm demo/review work offline. Close/reopen the app to confirm history remains. No Mistral setup is necessary for this path.

## 3. Start the API

```sh
cp -n services/api/.env.example services/api/.env
```

Edit the new `.env` in a local editor: enter MISTRAL_API_KEY, ATTEMPLY_SETUP_CODE and a long random SESSION_SECRET. Leave model defaults unless your account requires another available model. Install Poppler for PDFs. On this Mac the bundled `pdftoppm` may already be on PATH; otherwise `brew install poppler`.

```sh
npm run api
curl --fail http://localhost:3001/health
```

A production-equivalent local start:

```sh
npm run build:api
npm run start -w @attemply/api
```

The server loads `services/api/.env` because workspace scripts run from that directory. It uses PORT (default 3001) and binds to `0.0.0.0` for LAN development.

## 4. Connect a phone

On a real phone `localhost` means the phone. Use a deployed HTTPS API, or a LAN address such as `http://192.168.1.20:3001` in a development client. Android emulator can use `http://10.0.2.2:3001`. Release builds enforce HTTPS in the mobile request layer. Do not use a local address for a standalone APK's deployed configuration.

In **Connection & local data**, enter the API URL and setup code, then pair. The session lasts 24 hours and is stored in SecureStore. Re-pair when expired. No Mistral key is ever requested by the phone.

## 5. Import actual material

- Camera: allow permission, capture in good light, verify legibility.
- Gallery: select JPEG/PNG pages; originals are copied into app-owned storage.
- PDF: select an unlocked file ≤25 MB and ≤100 source pages. Prepare downloads backend-generated thumbnails; choose up to 20 pages. Toggle pages off/on to change selected order.
- Photos can be rotated or cropped by percentage coordinates; review the resulting image before upload. The unmodified original remains available.
- Tap **Prepare source & page previews**, then **Extract selected pages**. Jobs use named states, not made-up progress percentages. Reopen the source workspace to resume polling.
- Review every equation, diagram association and grouping. Edit/split/merge as needed. Resolve warnings only after checking the source.
- Import separate answer-key pages using the **Answer-key pages** mode. Keys are matched conservatively and remain provisional until confirmed in each editor. Alternatively enter verified keys manually, or use an ungraded test.

## Recovery

Denied camera permission offers gallery and system settings. For failed OCR, retry the import; data is never replaced by demo questions. Session-expired messages require re-pairing. If server sources expired or were removed, use **Prepare source again** on the preserved local source. Database errors display a retry/save banner; free disk space before leaving. Missing image/equation warnings require inspecting the original. A server restart marks interrupted jobs as retryable failures.

To inspect extraction, long-press **ATTEMPLY LAB · PRIVATE PROTOTYPE** on Home. The developer screen includes raw OCR, normalized questions, ignored blocks and event logs. Import a Mistral JSON response or ZIP export through the paired backend without spending OCR credits.
