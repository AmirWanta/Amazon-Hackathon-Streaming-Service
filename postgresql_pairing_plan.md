# PostgreSQL and Pairing Plan

Deferred until after the minimum `My List` integration is complete.

## Goal

Persist profile data and `My List` across devices while keeping the TV on a
single default profile for the minimum viable app.

## Planned architecture

```text
TV / phone
  -> pairing service
  -> list service
  -> PostgreSQL
```

KrakenD will route the profile and list-service endpoints. Jellyfin remains the
source of catalog and playback metadata; PostgreSQL stores app-owned profile
and list data.

## Pairing flow

1. The TV requests a short-lived, single-use pairing code.
2. The TV displays a QR code containing a pairing URL and the code.
3. The phone scans the QR code or enters the code manually.
4. The backend validates and consumes the code.
5. The backend returns a profile-scoped session token.
6. The phone stores the token securely and accesses the default profile and
   `My List`.

The QR code must contain only the temporary pairing code, never a permanent
session token.

## Database scope

Initial migrations should define tables for:

- `profiles`
- `lists`
- `list_items`
- pairing codes/sessions

List items should use portable content/provider identifiers rather than relying
only on installation-specific Jellyfin item IDs.

## Dependencies to plan for

- PostgreSQL Compose service and persistent volume
- Database migrations
- Profile/list service persistence
- KrakenD routes
- QR generation on the TV
- QR scanning or manual code entry on the phone
- Deep-link handling
- Secure session-token storage

