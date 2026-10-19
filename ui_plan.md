# UI, Content, and My List Plan

Recorded: October 12, 2026.

## Purpose and approval status

This document records the planning decisions agreed with the user. Read it at the next session, confirm the remaining details, and then implement when the user authorizes execution. Saving this document does not authorize implementation. No application changes have been made as part of this planning conversation.

The existing client can send GET requests to KrakenD using localhost port forwarding to Docker, with a WSL 2 fallback. The Shows page currently works. Repository details and target platform still require verification before implementation.

## Tabs and controls

- Shows: Preserve the working page and its shows-specific behavior while migrating its TMDB upstream to Jellyfin.
- Movies: Create a separate page and movie-specific request. There is currently no movie endpoint; define one. Do not reuse the popular-shows request.
- Series: Remove the separate tab. Series belong under Shows.
- My List: Start empty and combine manually saved movies and shows in one list. Provide Add to My List and Remove from My List controls, including removal from the My List tab. Prevent duplicate saves.
- Preserve TV remote navigation and usable focus behavior across tabs and controls.

## Content backend: Jellyfin

Jellyfin is the selected replacement for TMDB catalog upstreaming. The hackathon demo must demonstrate real catalog requests and playable content, with metadata and playback referring to the same titles.

- Define separate Shows and Movies endpoints through KrakenD.
- Return stable content IDs, content type, titles, descriptions, artwork, and available sorting metadata.
- Resolve playback information for selected movies and episodes; test actual playback on the target TV.
- Supply a small curated library of content with clear redistribution/streaming permissions and required attribution.
- Supply local metadata and configure metadata providers so replacing TMDB is complete, rather than leaving Jellyfin dependent on TMDB.
- Choose an actual episodic content source for Shows, as well as movie content. These titles are not yet selected.

The Jellyfin server address and upstream credentials must be configurable. The user wants another team, including Amazon if it adopts the product, to be able to replace credentials and use its own backend. Changing credentials and server address can support another compatible Jellyfin instance. A provider with a different API requires an adapter for authentication, endpoints, response mapping, and playback behavior; an API key alone is insufficient. Keep the app-facing catalog and playback formats stable to enable this future replacement.

Proposed request paths:

- Catalog/playback information: TV app -> KrakenD -> Jellyfin.
- Video delivery: TV player -> reachable media server using resolved playback information.

These are proposed architectural paths, not verified existing endpoints.

## Persistence: PostgreSQL and AsyncStorage

PostgreSQL is the authoritative backend store for personalized lists and eventual cross-device access. A list service exposes application operations through KrakenD; the TV does not connect directly to PostgreSQL.

Proposed path: TV app -> KrakenD -> list service -> PostgreSQL.

For the hackathon, PostgreSQL can run alongside the existing Docker services with a persistent volume. Deployment details remain to be verified.

AsyncStorage provides a persistent local fallback cache and queue of pending changes. Its lack of SQL queries does not prevent application-side sorting of a small cached list.

### Profiles

- Begin with one default profile; the app currently has no user/profile identification.
- Scope backend records, cached lists, and pending operations by profile ID.
- Structure storage for separate profiles later.
- Cross-device sharing requires devices to identify the same profile. Real profile selection, identity, and authentication remain future work; do not imply they already exist.

### Proposed data model

- Profiles: stable profile ID and profile information.
- Catalog items: internal ID, provider/server identity, provider item ID, movie/show type, title, description, artwork references, genres, available rating/popularity values, and metadata refresh information.
- Saved items: profile ID, catalog item ID, and added-at timestamp. Enforce uniqueness for each profile/content pair.
- Viewing state: profile ID, playable item ID, last-watched timestamp, and playback position. Episode activity can determine a show's latest watch time.

Provider identifiers must map to stable saved-item references. Do not persist temporary playback URLs as durable catalog identity.

### Sorting

The first implementation uses recently added, newest first. Retain data needed for future alphabetical, genre, popularity, rating, and recently watched sorts.

- Alphabetical: title.
- Genre: genres; define ordering/filter behavior when implemented.
- Popularity: nullable value with a defined source/meaning; no fabricated popularity scores.
- Rating: nullable value with a defined source/scale.
- Recently watched: actual viewing activity, not the time an item was saved.
- Recently added: saved-item added-at timestamp.

Offline sorting operates on cached metadata. The user accepts being able to sort cached entries offline; confirm which additional sort controls are in the first release, since only recently added was initially selected. Missing source values remain unavailable rather than invented.

## Offline and fallback behavior

The user explicitly approved offline add/remove operations and later synchronization.

- Online: fetch the authoritative list and refresh the local cache after successful reads and synchronized changes.
- Backend unavailable: display the last cached list with an indication that it may be out of date. Retain titles and descriptions so browsing remains useful.
- Offline edits: apply add/remove operations to the local list immediately and persist them in a pending queue.
- Reconnection: synchronize pending operations, reconcile with PostgreSQL, and refresh the cache while preserving unsynchronized user changes.
- Retries must avoid duplicate saves and must not accidentally restore removed items.
- Pending changes must survive app restarts and remain isolated by profile.
- Cached artwork references do not guarantee offline images; image caching is a separate decision.
- Access to cached metadata does not guarantee video playback or imply downloaded/offline videos. Playback depends on the media source being reachable.

Cross-device conflict rules, operation ordering, retry semantics, and removal handling remain to be specified before implementing synchronization. Do not silently choose a conflict policy that can discard user changes.

## Deferred work

When implementation begins, add an AI-enhanced viewing idea to ideas.md:

- Voice navigation to specific tabs.
- Voice commands that change lists.
- AI translates requests into validated TV commands from an allowlist the user has not yet specified.

Voice functionality is outside the current implementation. Additional deferred work includes real profile identity/authentication, additional sort controls beyond the agreed first-release scope, and adapters for non-Jellyfin providers.

## Next-session confirmation and execution checklist

1. Read this plan and inspect the repository, its instructions, platform configuration, existing UI, KrakenD configuration, and playback integration.
2. Confirm demo content for both movies and episodic shows, metadata, and attribution.
3. Confirm Jellyfin hosting, networking, credentials, and playback formats supported by the target TV.
4. Confirm the list-service implementation, PostgreSQL deployment, and compatible AsyncStorage integration.
5. Define stable content identity, default-profile behavior, and offline synchronization/conflict rules.
6. Confirm which sort controls ship initially; recently added is the existing first-release agreement.
7. Obtain the user's implementation go-ahead, then implement the tabs, content integration, list controls, persistence, and fallback behavior in the confirmed scope.
8. Verify distinct catalog requests, real playback, add/remove behavior, persistence after restart, offline browsing/edits, reconnection synchronization, and TV focus/navigation. Verify profile isolation and shared-backend behavior in proportion to the default-profile demo scope.

Whenever permission is required, explain the exact action, why it is necessary for the project, its impact, and what the user is approving. Continue routine work within the user's authorized scope without redundant permission requests.

## Current Work Tasks

1. Replace the TMDB KrakenD routes with Jellyfin-backed Shows and Movies routes.
2. Preserve or define a stable app-facing metadata contract.
3. Add PostgreSQL and the list service to Docker.
4. Add AsyncStorage-backed catalog/list caching and offline pending operations.
5. Add the My List API endpoints and persistence.
6. Add the full sorting and focus-navigation behavior.

## Reference documentation

- Jellyfin movie organization: https://jellyfin.org/docs/general/server/media/movies/
- Jellyfin networking/streaming: https://jellyfin.org/docs/general/networking/index.html
- Jellyfin local metadata: https://jellyfin.org/docs/general/server/metadata/nfo/
- Jellyfin authentication: https://github.com/jellyfin/jellyfin-sdk-kotlin/blob/master/docs/guide/authentication.md
- Example openly licensed movie, Spring: https://studio.blender.org/projects/spring/pages/about/
- PostgreSQL indexes and ordering: https://www.postgresql.org/docs/current/indexes-ordering.html

These references informed the planning conversation; recheck relevant documentation during implementation.
