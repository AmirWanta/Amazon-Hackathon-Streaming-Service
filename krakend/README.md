# Catalog proxy

This KrakenD gateway exposes the app-facing `GET /v1/tv/popular` endpoint.
It injects `TMDB_API_KEY` only into the upstream request. The Expo client never
receives or sends that credential.

## Run locally

1. Copy `.env.example` to `.env`.
2. Start the local Jellyfin service:

```powershell
.\scripts\start-jellyfin.ps1
```

Open `http://localhost:8096` and complete Jellyfin's first-run setup. Create an
API key and set `JELLYFIN_API_KEY` in `krakend/.env`.

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

To run with Docker directly, from this directory run `docker compose up`.

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

Validate the configuration with KrakenD before deployment:

```bash
FC_ENABLE=1 TMDB_API_KEY=example krakend check --lint --config ./krakend.json
```

The launchers do not install Docker or Docker Desktop. Docker is the only
machine-level prerequisite for the containerized Jellyfin and KrakenD workflow.
They do not print the contents of `krakend/.env`; keep that file local and
uncommitted.
