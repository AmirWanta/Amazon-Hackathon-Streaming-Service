# October 14 Work

- Added Jellyfin as a Docker Compose service alongside KrakenD.
- Added persistent Jellyfin config/cache volumes and a read-only `krakend/media` mount.
- Added `scripts/start-jellyfin.ps1` to validate Docker and start Jellyfin.
- Updated `.env.example`, `.gitignore`, setup documentation, and local Compose routing to use `http://jellyfin:8096`.
- Verified PowerShell syntax and Docker Compose configuration.
- Confirmed Expo requires `npx expo start --clear` after proxy/environment changes.
- Clarified that Docker Desktop may show both containers under the `krakend` Compose project; Jellyfin libraries/media still need to be seeded separately.

- Dockerized Jellyfin and KrakenD
- Configured Expo proxy environments
- Fixed Jellyfin routing and authentication
- Added working Movies and Shows catalogs
- Implemented local My List
- Added sorting and TV focus behavior
- Documented the deferred PostgreSQL/pairing architecture
