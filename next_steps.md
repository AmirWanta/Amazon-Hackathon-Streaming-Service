# Amazon Hackathon - Next Steps

## Priority order

1. **Backend proxy**
2. **Complete the UI**
   - Movies
   - Series
   - My List
3. **AI-enhanced viewing features**
4. **Reliable fallback caching**

## Tomorrow: backend proxy

The immediate goal is to stop the Expo/Fire TV client from calling TMDB directly or containing a TMDB API key.

### Proposed approach

- Evaluate KrakenD as the API gateway/proxy.
- Keep the TMDB credential only in the proxy/server environment.
- Expose a narrow application API, beginning with an endpoint such as:
  - `GET /v1/tv/popular`
- Update the Expo client to call the proxy instead of TMDB.
- Preserve clear error responses so the client can show actionable feedback.
- Do not commit API keys, `.env` files, or generated proxy credentials.

### Backend-proxy checkpoints

- Define the client-facing endpoint contract.
- Configure the TMDB upstream and server-side environment variable.
- Validate the KrakenD configuration locally.
- Test successful responses, unauthorized upstream responses, timeouts, and unavailable-proxy behavior.
- Update the client and run tests/lint.
- Confirm no credentials appear in source files, bundles, Git history, or logs.

## Later work

### Complete the UI

- Add Movies browsing.
- Add Series browsing.
- Add My List behavior and persistence.
- Keep D-pad/Fire TV navigation usable across all sections.

### AI-enhanced viewing

- Define useful viewing features before selecting an AI architecture.
- Keep model/API credentials server-side through the proxy/backend.
- Design for loading, failure, and offline states.

### Fallback cache

- Retain the local fallback behavior already used by the app.
- Add server-side caching where appropriate.
- Define cache freshness, invalidation, and stale-data behavior.
- Ensure the app remains useful when TMDB or the proxy is unavailable.

## Repository safety reminders

- Review `git status` before staging.
- Keep generated directories such as `.expo/` and `.gradle-local/` ignored.
- Review binary files and deletions before committing.
- Run tests, lint, and a clean-clone verification before pushing.
