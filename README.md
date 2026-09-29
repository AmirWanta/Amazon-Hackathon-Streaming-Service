This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

  ## If you are new to the project, See [READMENewDevelopers.MD](./READMENewDevelopers.MD) for full environment setup.

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

# Show Metadata Refresh and Cache

The popular-shows metadata request is intentionally independent from the first usable render of the app. On startup, the app begins two asynchronous operations:

1. It reads the existing local cache and hydrates the `shows` array if cached data exists.
2. It requests the latest metadata from TMDB in the background.

The API request is not required to create the initial `shows` array. If TMDB returns a valid payload that differs from the cached shows, the new payload replaces the cache and becomes the next fallback. If the API request fails or returns unchanged metadata, the existing cache is retained.

## Cache location

On a normal device build, the cache is stored in React Native AsyncStorage under this key:

```text
@firelight/tmdb-popular-shows
```

The stored value is JSON with this shape:

```json
{
  "shows": [/* TMDBShow[] */],
  "refreshedAt": "2026-09-28T22:42:15.886Z"
}
```

AsyncStorage persists this value in the app's platform-managed application storage. It is not written to the repository or a user-visible project file. The cache is normally cleared when the app's application data is cleared or the app is uninstalled.

## Inspecting the cache manually on Android / Fire TV

The Android application ID in this project is `com.amazonhackathon`. For a debuggable build connected through ADB, first verify the device and database file:

```powershell
adb devices
adb shell run-as com.amazonhackathon ls -la databases
```

With the default AsyncStorage Android backend, the database is normally named `RKStorage`. Copy it to the host machine and query the cache key with a host SQLite installation:

```powershell
adb exec-out run-as com.amazonhackathon cat databases/RKStorage > RKStorage
sqlite3 RKStorage "SELECT key, value FROM catalystLocalStorage WHERE key = '@firelight/tmdb-popular-shows';"
```

The returned `value` is the JSON object containing `shows` and `refreshedAt`. The direct database method requires a debuggable app because `run-as` is restricted for non-debuggable builds. AsyncStorage is unencrypted, so do not put secrets in it.

You can also inspect the value from JavaScript while debugging the app:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const raw = await AsyncStorage.getItem('@firelight/tmdb-popular-shows');
console.log('Cached show metadata:', raw);
```

To remove only this cache entry during development:

```ts
await AsyncStorage.removeItem('@firelight/tmdb-popular-shows');
```

If AsyncStorage is unavailable in a test or partially installed development environment, the implementation falls back to an in-memory value for that process only. The production dependency is declared in `package.json` and locked in `package-lock.json`.

## Implementation locations

All cache helpers are currently in [`App.tsx`](./App.tsx):

- Lines 36–42: `ShowsCache`, `SHOWS_CACHE_KEY`, and the in-memory fallback.
- Lines 47–55: `getAsyncStorage()`, which loads AsyncStorage safely.
- Lines 57–75: `readShowsCache()`, which reads and validates cached metadata.
- Lines 77–93: `writeShowsCache()`, which records the show list and refresh timestamp.
- Lines 95–97: `showsAreEqual()`, which determines whether API metadata is new.
- Lines 425–534: the `App` function component's startup effect. `hydrateFromCache()` loads the fallback while `refreshFromApi()` performs the independent TMDB refresh.
- Lines 640–641: the on-screen refresh status and API error display.

There are no cache classes; the implementation uses the functional React component `App` plus the module-level helper functions above. The logs include cache load, API success, retained-cache, and API failure outcomes. The UI exposes the same state through messages such as `New API metadata received` and `No new API metadata received`.

To install the native storage dependency after pulling the changes:

```sh
npm install
```

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
