# Local Development Troubleshooting

This guide covers common problems when running the Expo client, Metro, Docker, and KrakenD locally.

## 1. Confirm the emulator or device is connected

Run:

```powershell
adb devices -l
```

The device should appear with a status of `device`, for example:

```text
emulator-5554    device
```

If no device appears:

```powershell
adb kill-server
adb start-server
adb devices
```

For a network-connected Fire TV, connect using:

```powershell
adb connect <device-ip>:5555
```

## 2. Confirm Metro is running

Metro normally listens on port `8081`.

```powershell
Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
```

If there is no result, start Expo from the client project directory:

```powershell
npx expo start --clear
```

Keep this terminal open while using the app.

For an Android emulator, forward Metro through ADB:

```powershell
adb reverse tcp:8081 tcp:8081
adb reverse --list
```

The reverse list should include:

```text
tcp:8081 tcp:8081
```

## 3. Set the proxy URL in the correct terminal

The environment variable only applies to processes started from the same terminal session. Set it in the terminal used to start Expo:

```powershell
$env:EXPO_PUBLIC_PROXY_BASE_URL = "http://<windows-host-ip>:8080"
```

Then start or restart Expo:

```powershell
npx expo start --clear
```

For a standard Android emulator, `http://10.0.2.2:8080` can be used to reach services running on the Windows host. For a physical device, use the Windows host's LAN IPv4 address.

Do not place API keys in this file. The proxy URL is not secret, but keys should remain in `.env` files that are excluded from source control.

## 4. Fix a stale Expo Go project or white screen

If Metro is running and the device is connected but Expo Go stays blank or does not reload, force-stop Expo Go and restart the bundler:

```powershell
adb shell am force-stop host.exp.exponent
npx expo start --clear
```

Press `a` in the Expo terminal to launch the project again.

This is useful after changing `EXPO_PUBLIC_PROXY_BASE_URL`, because Expo environment variables are included when the JavaScript bundle is created.

## 5. Confirm KrakenD is running

KrakenD should listen on port `8080`:

```powershell
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
```

From Windows, test the proxy endpoint:

```powershell
Invoke-WebRequest http://localhost:8080/v1/tv/popular
```

If KrakenD is not running, start it from the `krakend` directory:

```powershell
docker compose up -d
```

Check its status and logs:

```powershell
docker compose ps
docker compose logs -f catalog-proxy
```

The Compose service should use:

```yaml
restart: unless-stopped
```

This restarts KrakenD after crashes or Docker/Windows restarts. It does not restart a container that was intentionally stopped with `docker compose stop` or `docker compose down`.

## 6. Check the proxy URL separately from Metro

Metro uses port `8081` to deliver the JavaScript bundle. KrakenD uses port `8080` for API requests. Both must be working:

```text
Device or emulator → Metro :8081
Device or emulator → KrakenD :8080 → upstream API
```

If the app bundles successfully but metadata does not load, test KrakenD directly. If metadata loads but the UI still reports that the proxy URL is missing, the warning is likely coming from a separate configuration check or stale log message.

## 7. Capture useful errors

Clear the old Android logs:

```powershell
adb logcat -c
```

Reload the app, then search for JavaScript and Android errors:

```powershell
adb logcat -d -v time | Select-String "ReactNativeJS|FATAL|Exception|ERROR|Unable to load"
```

The message below means the JavaScript bundle started successfully:

```text
ReactNativeJS: Running "main"
```

If that message appears without errors, ADB and Metro are probably working. Investigate the app's rendering or initialization logic next.
