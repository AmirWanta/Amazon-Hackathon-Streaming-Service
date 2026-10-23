# Voice Navigation TV

A Fire TV streaming app for your own media library. Browse movies and shows
from a Jellyfin server, play them on the TV, and control playback by voice:
hold the remote's select button, say "skip ahead 30 seconds" or "lower the
volume," and let go.

## What it does

TV remotes make anything beyond play/pause slow: seeking, adjusting volume,
or changing playback speed takes repeated button presses. This app adds
AI-powered voice control to the player, so viewers can say what they want
instead of navigating menus. All speech recognition runs locally with
faster-whisper, so no audio leaves your network.

## Features

- **Browse your library:** Home, Movies, and Shows rows with posters, a
  featured hero banner, and detail pages.
- **Shows with seasons and episodes:** pick a season and episode to play.
- **My List:** save titles for later, with sorting; saved locally on the device.
- **Full-screen player:** play/pause, ±10s skip, volume, mute, and playback
  speed, all reachable with the D-pad.
- **Hold-to-talk voice commands:** pause, resume, volume, mute, seek, restart,
  speed, and exit. See [AIEnhancer/README.md](./AIEnhancer/README.md) for the
  full command list.
- **Built for Fire TV:** supports the Leanback launcher and remote D-pad
  navigation; also runs on Android and the web.

## How it works

```text
Fire TV app (Expo / React Native)
   ├── catalog + video ──► KrakenD proxy (:8080) ──► Jellyfin (:8096)
   └── voice audio ──────► voice_pipeline.py (:8765, faster-whisper) ──► text
                              └─► keyword rules (voiceCommands.ts) ──► player action
```

- **KrakenD** exposes a small, read-only catalog API (`/v1/movies/popular`,
  `/v1/shows/{id}/seasons`, streams, and images) and keeps the Jellyfin API
  key on the server, so the app never holds it.
- **Jellyfin** stores and streams the media.
- **The AI enhancer** transcribes the recorded audio, and the app turns the
  text into a player action.

## Built with

Expo 54 · React Native 0.81 · TypeScript · expo-video · expo-audio ·
Jellyfin · KrakenD · Docker Compose · Python · faster-whisper

## Demo

▶ [Watch the demo video](https://www.youtube.com/watch?v=_AnzGW6ww0o)

## Prerequisites

Download and install these before running the project:

- **Node.js `22.11+`**, which includes npm. Download the LTS version from
  [nodejs.org](https://nodejs.org/).
- **Python 3**, which is used by the AI voice-enhancer pipeline.
- **Docker Desktop**, with Linux containers enabled. Docker Desktop includes
  Docker Engine and Docker Compose; download it from
  [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
- **Git**, if cloning the repository from GitHub. Download it from
  [git-scm.com](https://git-scm.com/downloads).
- **Cloudflare cloudflared**, only when testing on the remote Fire TV virtual
  device. Install it with `winget install --id Cloudflare.cloudflared`.

Choose one client option:

- **Web:** a modern browser. Android Studio is not required.
- **Android emulator or Fire TV emulator:** install **Android Studio**, its
  Android SDK, an emulator, and ADB. The full AI-enhancer workflow requires a
  native Android build; Expo Go is not sufficient for the hold-Enter feature.

The repository includes the Jellyfin and KrakenD Compose configuration and
startup scripts. Users do not install Jellyfin or KrakenD separately, but they
must install Docker Desktop because the containers run on their computer.

## Setup and run

Follow these steps in order from the repository root.

1. Clone this repository and install the JavaScript dependencies after
   completing the downloads above:

   ```powershell
   npm install
   ```

2. Start Docker Desktop and confirm that it is running:

   ```powershell
   docker info
   docker compose version
   ```

3. Create the local KrakenD environment file. This file contains the Jellyfin
   API key and must remain uncommitted:

   ```powershell
   Copy-Item krakend\.env.example krakend\.env
   ```

   The file should initially contain:

   ```env
   JELLYFIN_BASE_URL=http://jellyfin:8096
   JELLYFIN_API_KEY=replace-with-a-local-jellyfin-api-key
   ```

   `http://jellyfin:8096` is the Docker-internal address used by KrakenD. Do
   not replace it with `localhost`, a browser URL, or a `/web/` path.

4. Start the Jellyfin container:

   ```powershell
   .\scripts\start-jellyfin.ps1
   ```

   The script starts the Compose `jellyfin` service and keeps its configuration
   and cache in persistent Docker volumes. The local media directory is:

   ```text
   krakend\media\
   ```

   Jellyfin sees that directory as `/media`. Use these folders for the demo:

   ```text
   krakend\media\movies\  →  /media/movies
   krakend\media\shows\   →  /media/shows
   ```

5. Open Jellyfin and complete its first-run setup:

   ```text
   http://localhost:8096/web/
   ```

   Add the Movies library using `/media/movies` and the Shows library using
   `/media/shows`. Place legally usable media in the matching host folders and
   scan the libraries. Step 6 will allow demo media to be downloaded into jellyfin's media store.

6. Download the demo media and generate its local metadata files. Run this once
   after creating the Jellyfin libraries:

   ```powershell
   .\scripts\setup-demo-media.ps1
   ```

   The script downloads Big Buck Bunny for Movies and Caminandes for Shows into
   `krakend\media`, then creates matching `.nfo` files with example ratings and
   metadata. It does not overwrite existing media or NFO files.

   In Jellyfin, refresh both libraries so it discovers the new files:

   ```text
   Dashboard → Libraries → Scan All Libraries
   ```

7. Create a Jellyfin API key. In Jellyfin, open:

   ```text
   Dashboard → API Keys → Add API Key
   ```

   Give the key a name such as `firelight-dev`, copy the generated value, and
   replace the placeholder in `krakend\.env`:

   ```env
   JELLYFIN_API_KEY=the-generated-key
   ```

   Do not put this key in the Expo app or any `EXPO_PUBLIC_` variable.

8. Start KrakenD and recreate it after changing the API key:

   ```powershell
   .\scripts\start-krakend.ps1
   ```

   The Docker workflow starts the `catalog-proxy` service on port `8080`. It
   uses the `jellyfin` service name to reach Jellyfin inside the Compose network.
   Confirm both services are running:

   ```powershell
   cd krakend
   docker compose ps
   cd ..
   ```

   Test the catalog proxy:

   ```powershell
   curl.exe -i http://localhost:8080/v1/tv/popular
   curl.exe -i http://localhost:8080/v1/movies/popular
   ```

9. Configure the Expo client. Create `.env.local` in the repository root. For
   an Android emulator, use:

   ```env
   EXPO_PUBLIC_PROXY_BASE_URL=http://10.0.2.2:8080
   EXPO_PUBLIC_VOICE_SERVER_URL=http://10.0.2.2:8765

   # For a physical phone or Fire TV, replace 10.0.2.2 with this computer's
   # LAN IPv4 address in both values.
   ```

   `.env.local` is local Expo configuration and is ignored by Git. Expo loads
   `EXPO_PUBLIC_` variables automatically. Do not commit this file.

10. Start the AI enhancer and native Android app:

    ```powershell
    .\scripts\start-ai-enhancer.ps1
    ```

    The script creates the AI enhancer's Python environment, installs its
    dependencies, starts `voice_pipeline.py` in a separate window, and builds
    and launches the native Android app with `npx expo run:android`. Keep the
    voice-pipeline window open.

11. If you change `.env.local`, rerun the native app so the new values are
    included in the JavaScript bundle:

    ```powershell
    .\scripts\start-ai-enhancer.ps1
    ```

## Run on a real Fire TV

Complete steps 1–8 above first. The Fire TV and this computer must be on the
same Wi-Fi network.

1. Enable developer mode on the Fire TV. Open
   **Settings → My Fire TV → About** and select the device name seven times.
   Then open **Settings → My Fire TV → Developer Options** and turn on
   **ADB Debugging**. Note the Fire TV's IP address from
   **Settings → My Fire TV → About → Network**.

2. Connect to the Fire TV over ADB, replacing `FIRE_TV_IP` with its address:

   ```powershell
   adb connect FIRE_TV_IP:5555
   adb devices
   ```

   Accept the prompt on the TV (choose **Always allow from this computer**).
   `adb devices` should list the Fire TV as `device`; if it shows
   `unauthorized`, accept the prompt and run the commands again.

3. Find this computer's LAN IPv4 address with `ipconfig`, then set both values
   in `.env.local` to it, replacing `PC_IP`:

   ```env
   EXPO_PUBLIC_PROXY_BASE_URL=http://PC_IP:8080
   EXPO_PUBLIC_VOICE_SERVER_URL=http://PC_IP:8765
   ```

   Use the computer's address, not the Fire TV's. `10.0.2.2` works only inside
   the Android emulator.

4. Allow the Fire TV to reach this computer. Windows Firewall must allow
   inbound connections on ports `8080` (KrakenD), `8765` (voice pipeline), and
   `8081` (Metro). If Windows asks whether to allow Docker, Python, or Node,
   allow them on **Private networks**.

5. Close the Android emulator, then start the app:

   ```powershell
   .\scripts\start-ai-enhancer.ps1
   ```

   If more than one device is connected, choose the Fire TV when Expo asks. The
   app installs, opens on the TV, and appears in its apps list.

Voice commands need a microphone that apps can access. If hold-to-talk does not
hear anything on your device, use the Android emulator with host audio input
(see [AIEnhancer/README.md](./AIEnhancer/README.md#emulator-microphone)).

## Run on a Fire TV virtual device

Appstore Quality Central's remote Fire TV virtual device cannot reach
`localhost`, Docker service names, or the Android emulator address
`10.0.2.2`. Complete steps 1–8 first so Jellyfin, the demo media, and KrakenD
are ready, then use temporary HTTPS tunnels for the services before building
the APK.

1. Start the AI enhancer and keep its voice-pipeline window open:

   ```powershell
   .\scripts\start-ai-enhancer.ps1
   ```

2. In a separate PowerShell window, expose KrakenD:

   ```powershell
   cloudflared tunnel --url http://127.0.0.1:8080
   ```

   Copy the generated `https://*.trycloudflare.com` URL and keep this window
   open.

3. In another PowerShell window, expose the voice server:

   ```powershell
   cloudflared tunnel --url http://127.0.0.1:8765
   ```

   Copy this generated URL too and keep the window open. The voice health
   endpoint is `/health`; transcription uses `/transcribe`.

4. Replace the local emulator values in `.env.local` with the tunnel URLs:

   ```env
   EXPO_PUBLIC_PROXY_BASE_URL=https://your-krakend-tunnel.trycloudflare.com
   EXPO_PUBLIC_VOICE_SERVER_URL=https://your-voice-tunnel.trycloudflare.com
   ```

   Test them before building:

   ```powershell
   curl.exe -i https://your-krakend-tunnel.trycloudflare.com/v1/tv/popular
   curl.exe -i https://your-voice-tunnel.trycloudflare.com/health
   ```

5. Build the release APK so the public URLs and JavaScript bundle are packaged
   into the app. Metro is not required for this build:

   ```powershell
   cd android
   cmd.exe /d /c gradlew.bat assembleRelease
   cd ..
   ```

   The APK is created at:

   ```text
   android\app\build\outputs\apk\release\app-release.apk
   ```

6. In Appstore Quality Central, open **Live Device Interaction → Virtual
   Devices**, select a Fire OS device, and use **Dashboard → App Upload** to
   upload and install the release APK. Keep Docker, the AI enhancer, and both
   tunnel windows running while testing.

   Quick Tunnel URLs are temporary and change when their processes restart. If
   either tunnel changes, update `.env.local` and rebuild the APK before
   uploading it again. The virtual device also has limited microphone and
   external-peripheral support, so demonstrate microphone capture separately
   in the Android emulator if necessary.

## Service URLs

```text
Jellyfin in a browser:       http://localhost:8096/web/
KrakenD from the host:       http://localhost:8080
KrakenD → Jellyfin:          http://jellyfin:8096
Android emulator → KrakenD: http://10.0.2.2:8080
Fire TV virtual device → KrakenD: https://your-krakend-tunnel.trycloudflare.com
Fire TV virtual device → voice:   https://your-voice-tunnel.trycloudflare.com
```

For troubleshooting, see [`developer_readme.md`](./developer_readme.md) and
[`LOCAL_DEVELOPMENT_TROUBLESHOOTING.md`](./LOCAL_DEVELOPMENT_TROUBLESHOOTING.md).

## Credits

The demo media downloaded by `scripts/setup-demo-media.ps1` is not included in
this repository. Both films are open movies by the Blender Foundation,
licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/):

- **Big Buck Bunny** (2008): © Blender Foundation,
  [peach.blender.org](https://peach.blender.org/)
- **Caminandes: Gran Dillama** (2013): © Blender Foundation,
  [caminandes.com](https://www.caminandes.com/)
