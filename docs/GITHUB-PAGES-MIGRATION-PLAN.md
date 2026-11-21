# World Golf Weather — GitHub Pages migration plan

## Product scope
World Golf Weather is a pre-trip golf-weather planning tool for overseas courses, not a live-observation service.

- Do not use Cloudflare services, Pages Functions, Workers, or Cloudflare deployment workflows.
- Do not build offline support; no Service Worker, offline page, or precache logic.
- Retire METAR/live-observation functionality.
- Keep the frontend static and compatible with a GitHub Pages project site.
- Keep provider credentials out of the browser and repository.

## Target architecture

### Static frontend (GitHub Pages)
- Course database JSON, country list, icons and static assets.
- Search, country/region filters, favorites and recent courses using localStorage.
- Open-Meteo standard forecast for the operational 0–16 day window.
- ECMWF EC46 for the subseasonal window (up to 46 days).
- ECMWF seasonal outlook for monthly tendencies.
- Read-only Visual Crossing and Foreca cache JSON served as static files.

### Scheduled data collection (GitHub Actions)
- Visual Crossing Timeline API and Foreca hourly API, subject to plan limits.
- API keys stored only in GitHub Actions Secrets.
- Normalize each provider into its own cache dataset and preserve source timestamps/status.
- Publish cache data to a dedicated data branch; never put credentials in cache files or logs.
- Use bounded concurrency, retry/backoff and manual dry-run before publishing.

### Provider presentation
- Keep Open-Meteo, Visual Crossing and Foreca independently labelled.
- Do not blend provider values into the Open-Meteo model consensus by default.
- Display missing data as unavailable, never as zero.
- Show each cache's generation time and provider-specific failure status.

## Forecast horizon semantics
- 0–16 days: operational forecast; use hourly/daytime details where available.
- 17–46 days: EC46 subseasonal outlook; communicate uncertainty and avoid implying course-level precision.
- Beyond 46 days: seasonal anomalies and probabilities, not daily deterministic weather.
- Historical climate normals are a separate reference layer, not a forecast.

## GitHub Pages compatibility and preview
- Keep all local asset and data URLs relative to the project-site path.
- Never deploy the development branch to the repository's configured production Pages environment.
- The development preview workflow builds a downloadable artifact only; it does not publish a Pages deployment.
- Until an isolated preview URL is deliberately established, validate using the workflow artifact.
- The repository default branch is main. Scheduled workflows only run from the default branch; keep cache publication manual/dry-run during development and do not enable scheduled publishing until the migration is accepted.

## Migration sequence
1. Remove live-observation UI, METAR code paths, and all Cloudflare-specific runtime code.
2. Validate the Visual Crossing and Foreca scheduled cache builders.
3. Add provider cache schemas, freshness checks and safe GitHub Actions workflows.
4. Verify project-site relative paths and static resource loading.
5. Establish a safe preview target that cannot overwrite the production Pages site.
6. Test on desktop and Android, including course lookup, timezone correctness, forecasts and cache failure states.
7. Only after acceptance, decide whether to merge and enable GitHub Pages production hosting.

## Operational safeguards
- Never commit API keys.
- Never run a workflow that deploys development to the live Pages environment.
- Do not merge an implementation PR or alter production hosting without explicit approval.
- GitHub Pages is the target hosting platform; Cloudflare is out of scope.
