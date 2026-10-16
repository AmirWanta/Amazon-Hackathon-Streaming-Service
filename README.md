# Amazon Hackathon

An Expo client for browsing and playing Jellyfin movies and shows through a
KrakenD catalog proxy. Jellyfin and KrakenD run locally in Docker Compose.

## Prerequisites

Download and install these before running the project:

- **Node.js `22.11+`**, which includes npm. Download the LTS version from
  [nodejs.org](https://nodejs.org/).
- **Docker Desktop**, with Linux containers enabled. Docker Desktop includes
  Docker Engine and Docker Compose; download it from
  [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
- **Git**, if cloning the repository from GitHub. Download it from
  [git-scm.com](https://git-scm.com/downloads).

Choose one client option:

- **Web:** a modern browser. Android Studio is not required.
- **Physical phone:** install **Expo Go** from the phone's app store. Android
  Studio is not required.
- **Android emulator or Fire TV emulator:** install **Android Studio**, its
  Android SDK, an emulator, and ADB. This is optional and is not needed for web
  or Expo Go development.

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
   scan the libraries.

6. Create a Jellyfin API key. In Jellyfin, open:

   ```text
   Dashboard → API Keys → Add API Key
   ```

   Give the key a name such as `firelight-dev`, copy the generated value, and
   replace the placeholder in `krakend\.env`:

   ```env
   JELLYFIN_API_KEY=the-generated-key
   ```

   Do not put this key in the Expo app or any `EXPO_PUBLIC_` variable.

7. Start KrakenD and recreate it after changing the API key:

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

8. Configure the Expo client. Create `.env.local` in the repository root with
   one of these values, depending on where Expo will run:

   ```env
   # Web on this computer
   EXPO_PUBLIC_PROXY_BASE_URL=http://localhost:8080

   # Standard Android emulator
   # EXPO_PUBLIC_PROXY_BASE_URL=http://10.0.2.2:8080

   # Physical phone or Fire TV; replace with this computer's LAN IPv4 address
   # EXPO_PUBLIC_PROXY_BASE_URL=http://192.168.1.25:8080
   ```

   `.env.local` is local Expo configuration and is ignored by Git. Expo loads
   `EXPO_PUBLIC_` variables automatically; no `$env:` command is needed.

9. Start Expo:

   ```powershell
   npx expo start --clear
   ```

   In the Expo terminal, choose the client you want:

   - Press `w` to run the web application in a browser. Use
     `http://localhost:8080` in `.env.local`.
   - Press `a` to launch Android. This requires a running Android emulator or
     connected Android device. Use `http://10.0.2.2:8080` for an emulator.
   - For Expo Go on a physical phone, scan the QR code and use the computer's
     LAN IPv4 address in `.env.local`.

10. If you change `.env.local`, restart Expo so the new client URL is included
    in the JavaScript bundle:

    ```powershell
    npx expo start --clear
    ```

## Service URLs

```text
Jellyfin in a browser:       http://localhost:8096/web/
KrakenD from the host:       http://localhost:8080
KrakenD → Jellyfin:          http://jellyfin:8096
Android emulator → KrakenD: http://10.0.2.2:8080
```

For troubleshooting, see [`developer_readme.md`](./developer_readme.md) and
[`LOCAL_DEVELOPMENT_TROUBLESHOOTING.md`](./LOCAL_DEVELOPMENT_TROUBLESHOOTING.md).
