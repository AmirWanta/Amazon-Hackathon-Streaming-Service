# Amazon_Hackathon developer guide

Amazon_Hackathon is an Expo app. The JavaScript and TypeScript source is shared across development targets; Expo supplies the bundler and native runtime. Standard Expo Go development does not require Android Studio. The Fire TV emulator is different: it needs a locally compiled Android development binary, so this repository now includes the generated `android/` project for that target.

## Prerequisites

- Node.js 22 or newer (the repository declares `>=22.11.0`).
- npm 11 or newer.
- An Expo Go-compatible iOS or Android device for the quickest device run, or a browser for web development.
- A USB cable or the same Wi-Fi network as the computer when opening the app on a physical device.

Android Studio is not required for the standard Expo Go phone/browser workflow. It is required for the Fire TV emulator workflow because the emulator needs an APK compiled with the project’s React Native and Expo native modules.

## Install

From the repository root:

```powershell
npm install
```

If dependencies have been changed or the lockfile is intentionally refreshed, use the same command again. Do not install React Native CLI packages manually.

## Develop with Expo

Start the Expo development server:

```powershell
npm start
```

The terminal shows a QR code and the Expo developer UI. Scan the QR code with Expo Go, or press `w` to open the web build. The project also exposes these shortcuts:

```powershell
npm run web       # Open the web target
npm run ios       # Build/open the iOS native target when Xcode is available
npm run android   # Build/install the Android native target with Gradle
```

`npm run android` now invokes `expo run:android`. It is a native development build command, not an Expo Go shortcut. Use `npm start` and Expo Go for a standard phone workflow; use `npm run android` for the Fire TV emulator.

### Fire TV native development

The Fire TV emulator must run an APK built from this repository. The generated `android/` project autolinks React Native and Expo modules, including the native implementation required by `PlatformConstants`. Android Studio supplies the emulator and Android SDK; Gradle performs the compile.

From the repository root:

```powershell
npm install
npx expo prebuild --platform android --no-install
npm run android
```

Do not launch an older APK from a previous React Native project while Metro serves this Expo project. That can produce `TurboModuleRegistry` errors because the JavaScript bundle and installed native binary contain different module sets.

If an error such as a missing `PlatformConstants` module appears unexpectedly, verify the development connection before changing application code. A disconnected or unauthorized ADB session, an emulator connected to another Metro server, or a stale server on port `8081` can leave the emulator and JavaScript bundle out of sync. A direct Metro/ADB problem more commonly appears as a bundle-loading or connection error, but a stale or mismatched bundle can surface as a native-module error during startup.

For a clean cache restart:

```powershell
npx expo start --clear
```

Edit `App.tsx` or a file under `components/`. Expo Fast Refresh updates the running app automatically. The app reads its TMDB API key from the current source, so treat that key as public client configuration and rotate it if it is exposed.

## Tests and checks

```powershell
npm test
npm run lint
```

The Expo Metro configuration is in `metro.config.js`, Babel is configured through `babel-preset-expo`, and TypeScript inherits from `expo/tsconfig.base`.

### What the main tools do

- **Expo** is the application framework and developer CLI. It starts Metro, applies the Expo Babel/Metro configuration, serves the app to Expo Go, and can create production builds through EAS.
- **Metro** is the JavaScript bundler. It follows imports from `index.js`, transforms TypeScript/JSX, and produces the bundle loaded by the device.
- **Babel** is the source transformer used by Metro. `babel-preset-expo` enables the syntax and React Native transforms expected by Expo.
- **TypeScript** checks `.ts` and `.tsx` types without producing the runtime bundle. Run `npx tsc --noEmit` for a type-only check.
- **Jest** is the test runner. It executes the tests in `__tests__/` in Node rather than on a device; `jest-expo` supplies Expo-compatible mocks and transforms so those tests understand Expo modules.
- **ESLint** is the static code-quality checker. It finds issues such as unused variables, invalid imports, and unsafe patterns before runtime.
- **`expo-video`** is the Expo-native media module used by `components/PlayerScreen.tsx`; it replaces the former `react-native-video` dependency.
- **EAS** (Expo Application Services) builds installable Android/iOS binaries remotely, so local Android Studio and Xcode are not required for the build service.

## Build an Expo bundle

To produce an export without Android Studio or Xcode:

```powershell
npm run export
```

Expo writes the web/static bundle to `dist/`. This verifies that Metro can bundle the application, but it is not an installable Android APK or iOS IPA.

For installable store/device binaries, use an Expo Application Services (EAS) build. Install or invoke the CLI, sign in, and configure the project once:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android
```

Use `--platform ios` for an iOS build. EAS performs the native build remotely; local Android Studio is not required. Android release builds still require an EAS-managed or supplied Android signing credential. iOS builds require Apple credentials and are normally submitted from macOS or through EAS.

The current app uses `expo-video`. If a future library requires native code that is not included in Expo Go, create an Expo development build with EAS and run it using the generated development client. Do not add a hand-maintained Gradle project unless the feature genuinely requires custom native code.

## Project conventions

- `app.json` contains Expo identity and platform metadata.
- `index.js` registers the root component through Expo.
- `expo-video` provides playback for `components/PlayerScreen.tsx`.
- `@react-native-async-storage/async-storage` remains available for persistent app storage.
- `android/` is currently included because Fire TV requires a locally compiled native development binary. Regenerate it with `npx expo prebuild` when Expo configuration or native dependencies change; review generated changes before committing them.
