# Android APK and iPhone testing

## Available local APK

The verified local artifact is `artifacts/attemply-lab-1.0.0-arm64.apk` (about 42 MiB), for ARM64 Android 7+ devices. It includes JavaScript and launches without Metro. It was built locally with the generated development signing certificate, not through EAS. SHA-256 and signature evidence are in artifacts/APK_INFO.json / docs/APK_SIGNATURE.txt. Transfer it to Android and tap to install, or run `adb install -r` with its absolute path.

The offline demo works immediately. Live OCR still requires a reachable HTTPS backend and a valid Mistral key. This APK is not an iPhone app or a Play Store production release.

## EAS profiles

`apps/mobile/eas.json` provides:

- `development`: internal native development client; uses Metro.
- `preview`: internal Android **APK**; JavaScript bundled; no Metro required.
- `production`: Android AAB for store distribution.

The project uses `com.attemply.lab` for Android/iOS identifiers, version 1.0.0 and build/versionCode 1. Store identifier availability has not been verified.

## Configure EAS after login

```sh
cd '/Users/tarunchoudhary/p/attemply lab app/apps/mobile'
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
npx eas-cli@latest build:configure
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR_API.onrender.com --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
```

`eas init` associates the app with your Expo account and writes the real project ID; none is invented in this repository. If using this folder without Git, either initialize a **private local repository** first or set `EAS_NO_VCS=1` for the EAS command. No remote repository is required for local no-VCS upload. Review exactly what EAS will upload; keep private fixtures and `.env` excluded.

Allow EAS to generate/manage the private prototype's Android keystore when prompted. Account authorization, any paid build entitlement, and signing remain user-controlled. Keep the resulting credentials recoverable. The `preview` profile is the requested standalone APK path.

Wait for a successful cloud build, inspect logs, then obtain the APK link from that build. Do not install an AAB as if it were an APK. A JavaScript export (`dist/android/*.hbc`) is not installable by itself.

## Install a successful APK

Download the actual APK from the successful EAS build on Android and allow installation for that download source when Android prompts. Or use USB debugging:

```sh
adb devices
adb install -r /absolute/path/to/attemply-lab.apk
adb shell monkey -p com.attemply.lab 1
```

Close Metro entirely. Launch the APK, complete the offline demo, background/resume a timed attempt, force-close/reopen, inspect history, and verify source/math/diagram rendering. Pair with the deployed HTTPS backend to test real camera/photo/PDF extraction.

## Local Android fallback

Android Studio's Java is available on this machine at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`. If the shell cannot find Java, use it explicitly. The generated native directory is ignored and reproducible with prebuild:

```sh
cd '/Users/tarunchoudhary/p/attemply lab app/apps/mobile'
npx expo prebuild --platform android --no-install
cd android
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/tarunchoudhary/Library/Android/sdk' ./gradlew :app:assembleRelease --no-daemon --console=plain
```

The default Expo-generated local release uses its development signing setup; use EAS-managed signing for the distributed preview. Successful local output is normally `android/app/build/outputs/apk/release/app-release.apk`. Only a successful build plus artifact inspection establishes that this file exists. Missing Android SDK/NDK/build tools or Maven access must be resolved by Android Studio/SDK Manager. See ANDROID_DELIVERY_FINAL_BUILD_LOG.txt for the final successful build. The delivered ARM64-only build used `-PreactNativeArchitectures=arm64-v8a`, with a task-specific GRADLE_USER_HOME and two Gradle workers.

## Native development client

```sh
cd '/Users/tarunchoudhary/p/attemply lab app/apps/mobile'
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

Install that development build, then open the QR/link on the same network. This development build requires Metro; the preview APK does not.

## iPhone

The source and Expo modules support iOS. An Android APK cannot install on iPhone. For a physical iPhone use an EAS iOS development build with Apple signing/device registration, or install full Xcode and run `npx expo run:ios --device` with an appropriate signing team. EAS device builds require the corresponding Apple developer authorization; simulator builds require a Mac simulator and can use a simulator-specific profile. The current session lacks iOS Simulator tooling, Apple authorization and physical iPhone validation. Expo Go is an option only when its installed version supports SDK 58.

References: [Expo APK configuration](https://docs.expo.dev/build-reference/apk/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), [SDK 58 release](https://expo.dev/changelog/sdk-58).
