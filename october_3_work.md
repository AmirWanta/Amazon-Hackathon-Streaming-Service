# Work log — October 3, 2026

## Completed

- Converted the project from React Native CLI configuration to Expo.
- Replaced `react-native-video` with `expo-video`.
- Updated Expo entrypoint, Babel, Metro, TypeScript, Jest, ESLint, scripts, and app metadata.
- Added Expo-compatible web dependencies: `react-dom` and `react-native-web`.
- Resolved the React dependency mismatch by aligning:
  - `react`: `19.1.0`
  - `react-test-renderer`: `19.1.0`
  - `react-dom`: `19.1.0`
- Removed the old iOS project and replaced the old Android project with an Expo-generated Android project when native Fire TV testing became necessary.
- Added and expanded [`developer_readme.md`](./developer_readme.md) with setup, Expo, Fire TV, testing, build, and tool explanations.
- Added [`ideas.md`](./ideas.md) with pairing, phone remote, AI viewing, streaming-source options, feasibility scores, and hackathon-rule considerations.

## Validation

- TypeScript passed.
- Jest passed: 2 tests.
- ESLint passed.
- Expo Android native project compiled successfully.
- Debug APK generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Runtime investigation

- The `PlatformConstants` error was initially suspected to be a missing native module.
- The Fire TV emulator was found to be `unauthorized` in ADB, while Metro port `8081` was occupied by another Node/Metro process.
- Restarting ADB changed the emulator state to `device`.
- The Expo app then ran successfully after reconnecting ADB and starting the correct Metro server.
- Conclusion: a stale or disconnected ADB/Metro connection can make the emulator and JavaScript bundle fall out of sync and produce misleading startup errors. A true native-binary mismatch remains a possible separate cause, which is why the current Expo Android binary was also generated and compiled.

## Current state

- The app is running with Expo.
- Fire TV development uses the generated `android/` project and `npm run android` (`expo run:android`).
- Standard Expo Go development can use `npm start` without Android Studio.
- The emulator must be authorized in ADB, and port `8081` must serve the current project’s Metro server.

## Next-session ideas

- Test the newly generated APK on the authorized Fire TV emulator.
- Confirm the installed APK metadata and verify the `PlatformConstants` error does not return.
- Decide whether phone pairing should start as a browser remote or an Android companion app.
- Choose a legally usable video source before implementing streaming features.
