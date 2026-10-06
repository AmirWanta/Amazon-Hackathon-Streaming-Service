# Catalog proxy

This KrakenD gateway exposes the app-facing `GET /v1/tv/popular` endpoint.
It injects `TMDB_API_KEY` only into the upstream request. The Expo client never
receives or sends that credential.

## Run locally

1. Copy `.env.example` to `.env` and set the server-side key.
2. From this directory, run `docker compose up`.
3. Configure the Expo app with the proxy's reachable address:

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
