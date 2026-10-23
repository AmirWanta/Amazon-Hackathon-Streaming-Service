# Catalog proxy

This KrakenD gateway exposes the app-facing Jellyfin routes for show and movie
catalogs, artwork, playback metadata, and video streams. The Jellyfin API key
stays server-side in `krakend/.env`; the Expo client never receives it.

## Run locally

1. Copy `.env.example` to `.env` and set `JELLYFIN_API_KEY` using the key
   created in the Docker Jellyfin instance. Do not commit that file.

```powershell
Copy-Item krakend\.env.example krakend\.env
```

2. Start the local Jellyfin service:

```powershell
.\scripts\start-jellyfin.ps1
```

Open `http://localhost:8096` and complete Jellyfin's first-run setup. Add the
Movies and Shows libraries using `/media/movies` and `/media/shows`; the host
folders are `krakend\media\movies` and `krakend\media\shows`.

3. From the repository root, run the automatic KrakenD launcher:

```powershell
.\scripts\start-krakend.ps1
```

The launcher uses Docker Compose automatically when a running Docker engine is
available. Otherwise it validates and starts the existing KrakenD installation
inside the configured WSL2 distro (default: `Ubuntu`). To select another distro:

```powershell
$env:KRAKEND_WSL_DISTRO = "Ubuntu-24.04"
.\scripts\start-krakend.ps1
```

To run with Docker directly:

```powershell
Set-Location krakend
docker compose up
```

Inside Compose, KrakenD reaches Jellyfin at `http://jellyfin:8096`. Do not use
`localhost`, `127.0.0.1`, or a placeholder hostname in the upstream URL.

4. Configure the Expo app with the proxy's reachable address:

```powershell
$env:EXPO_PUBLIC_PROXY_BASE_URL = "http://<computer-ip>:8080"
npx expo start
```

The proxy uses `no-op` output encoding so upstream HTTP status and error bodies
remain identifiable to the client. It also serves poster/backdrop requests under
`/v1/images/...`, keeping the client independent of the upstream image host.
KrakenD-generated failures include a readable gateway error because
`return_error_msg` is enabled.

The proxy provides routes including `GET /v1/tv/popular`,
`GET /v1/movies/popular`, poster/backdrop image routes under `/v1/images/...`,
show season and episode routes under `/v1/shows/...`, and playback metadata and
stream routes under `/v1/videos/...`.

The launchers do not install Docker or Docker Desktop. They also do not print
the contents of `krakend/.env`; keep that file local and uncommitted.
