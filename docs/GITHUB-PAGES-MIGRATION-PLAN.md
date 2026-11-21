# World Golf Weather — GitHub Pages migration plan

## Product scope

World Golf Weather is primarily a pre-trip golf-weather planning tool for overseas courses. It is not intended to provide live observations at the course.

Explicit scope decisions:
- Do not build offline support.
- Do not add a Service Worker or offline cache.
- Retire METAR/live-observation functionality.
- Keep the browser app static and compatible with a GitHub Pages project site.
- Keep provider credentials out of the browser and repository.

## Target architecture

### Static frontend (GitHub Pages)
- Course database JSON, country list, icons and static assets.
- Search, country/region filters, favorites and recent courses using localStorage.
- Open-Meteo standard forecast for the operational 0–16 day window.
- ECMWF EC46 for the subseasonal window (up to 46 days).
- ECMWF SEAS5 for monthly seasonal tendencies.
- Read-only provider cache JSON, served as static files.

### Scheduled data collection (GitHub Actions)
- Visual Crossing Timeline API: one request per course per collection cycle, subject to plan limits.
- Foreca hourly API: one request per course per collection cycle, subject to plan limits.
- API keys stored only in GitHub Actions Secrets.
- Normalize each provider into its own cache dataset and preserve source timestamps/status.
- Publish cache data to a dedicated data branch; do not put credentials in cache files or logs.
- Use bounded concurrency, retry/backoff and a manual workflow dispatch for controlled testing.

### Provider presentation
- Keep Open-Meteo, Visual Crossing and Foreca independently labelled.
- Do not blend provider values into the Open-Meteo model consensus by default.
- Display missing data as unavailable, never as zero.
- Show each cache's generation time and provider-specific failure status.

## Forecast horizon semantics

- 0–16 days: operational forecast; use hourly/daytime details where available.
- 17–46 days: EC46 subseasonal outlook; communicate uncertainty and avoid implying course-level precision.
- Beyond 46 days: SEAS5 monthly/seasonal anomalies and probabilities, not daily deterministic weather.
- For planning several months ahead, add historical climate normals by course and month as a separate reference layer. Historical climatology is not a forecast.

## GitHub Pages compatibility requirements

- Keep all local asset and data URLs relative to the project-site path.
- Remove the frontend call to `./api/metar-nearby`.
- Do not deploy the `development` branch directly to the repository's configured Pages environment.
- The current `development-pages-preview.yml` uses `actions/deploy-pages@v4` and is not an isolated preview deployment. Do not run it for testing.
- Use a separate preview target/repository or a downloadable workflow artifact until an isolated preview URL is established.

## PWA / offline decision

No offline functionality is required. Do not add a Service Worker, offline page, or precache logic. Retain the web app's responsive interface and HTTPS hosting; the manifest can be reviewed separately for install metadata, but it must not imply offline availability.

## Migration sequence

1. Remove METAR/live-observation UI, code paths and Cloudflare Function dependency.
2. Implement and validate the Visual Crossing and Foreca scheduled cache builders.
3. Add provider cache schemas, freshness checks and safe GitHub Actions workflows.
4. Verify project-site relative paths and static resource loading.
5. Establish a safe preview target that cannot overwrite the existing Pages site.
6. Test on desktop and Android, including course lookup, timezone correctness, forecasts and cache failure states.
7. Only after acceptance, decide whether to merge and enable GitHub Pages production hosting.

## Operational safeguards

- Never commit API keys.
- Never run a workflow that deploys the development branch to the live Pages environment.
- Do not merge an implementation PR or alter the current production hosting configuration without explicit approval.
- Keep the existing Cloudflare deployment available until GitHub Pages has passed acceptance testing.
