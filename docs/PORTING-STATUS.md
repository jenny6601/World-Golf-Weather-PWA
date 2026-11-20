# Porting and validation status

## Source baseline
- Source repository: `jenny6601/Taiwan-Golf-Weather-PWA`
- Source branch: `main`
- Source app entry: root `index.html` (full version, not `compact/index.html`)
- Port target: `jenny6601/World-Golf-Weather-PWA`, branch `development`

## Completed in development
- Copied the full-version weather interface and forecast calculation code as the starting point.
- Replaced Taiwan course list UI with Asia country filter and local course search.
- Added Unicode normalization, case/punctuation/space normalization, token matching and basic edit-distance typo tolerance.
- Added local favorites and last-10 recent course selections.
- Added eight country filters: JP, KR, CN, VN, TH, MY, SG, ID.
- Added a structured course data schema.
- Added 44 course records across eight countries.
- Current verification: 7 fully verified, 27 partially verified, 7 unverified; three partially verified records now also have sourced GPS coordinates.
- Japan: five courses have official addresses and official-site embedded map pins; Camellia Hills identity/address verified, GPS pending.
- South Korea: Nine Bridges and Black Stone Jeju have coordinates from the Jeju official tourism portal; Teddy Valley, Asiad CC and Woo Jeong Hills have identity/address verified, GPS pending.
- China: Mission Hills Shenzhen and Dongguan, Sheshan and Yalong Bay have identity/address sources recorded; GPS pending.
- Vietnam: Ba Na Hills, Hoiana Shores, Laguna Lang Co, Legend Da Nang and Montgomerie Links have official club identity/address sources recorded; GPS pending.
- Thailand: three identity/address records partially verified; Malaysia: four; Singapore: four; Indonesia: three, with Bali and Jakarta timezones assigned individually. Seven remaining candidates across China, Thailand, Malaysia, Singapore and Indonesia are unverified.
- Candidates without GPS coordinates do not have fabricated coordinates; forecast selection remains disabled until coordinates are available. Three partial records (Black Mountain, Saujana and Kota Permai) now have traceable GPS points from a specialist golf directory or Selangor Tourism publication; these remain partially verified pending official-map cross-check.
- Disabled the inherited Taiwan live-observation snapshot lookup. The UI states that global observation/METAR integration is not yet available.
- Disabled inherited Taiwan course-cache lookup; forecast requests fall back to the Open-Meteo model API.
- Replaced inherited Taiwan repository cache URLs with this World Golf Weather repository namespace.
- Added a separate manifest, service worker cache namespace, offline page, installation script and app icons.

## Not yet complete
- Complete GPS verification for all partially verified courses, including Camellia Hills, Teddy Valley, Asiad CC, Woo Jeong Hills, the four China partial records and five Vietnam courses.
- Verify remaining candidates in Thailand, Malaysia, Singapore and Indonesia; obtain GPS for all partially verified courses.
- Confirm Indonesia timezone per course coordinates (Asia/Jakarta, Asia/Makassar or Asia/Jayapura); do not infer a single country-wide zone.
- Add licensed/official course photos and attribution.
- Add external map/GPS discovery and geocoder policy.
- Implement global current observations using a validated source hierarchy (station/METAR where available, commercial observations where licensed, and clearly labelled model estimates).
- Create independent forecast cache workflows and provider secrets.
- Review China coverage/access and country-specific provider limitations.
- Run browser/mobile functional tests and verify PWA install/offline behavior.
- Configure Cloudflare Pages independently and test production deployment.
- Promote development to main only after acceptance.

## Isolation verification
- No GitHub Actions from the Taiwan PWA were copied.
- No Taiwan PWA cache branch is read by the Asia app.
- The Taiwan source repository has not been modified by this porting work.


### Vietnam expansion — 2026-11-20
Added Long Bien Golf Course, BRG Legend Hill Golf Resort, and BRG Kings Island Golf Resort. Each record includes official website/address, Vietnamese aliases/search terms, Asia/Ho_Chi_Minh timezone, a mapped coordinate and provenance. All three remain partially verified. Kings Island is a 55-hole resort with three layouts; the stored pin is the resort location rather than a specific course entrance.


### Hanoi course search smoke test — 2026-11-20
- Confirmed the production local-index search fields include official name, local name, short name, aliases, search keywords, city, region, country and address.
- Exercised the same normalization/ranking rules against the current 44-record course JSON. Exact-match results resolve correctly for: Long Bien / Long Biên / Long Bien Golf Course; Legend Hill / BRG Legend Hill; Kings Island / King's Island / Đảo Vua.
- All three newly added Hanoi records have GPS + Asia/Ho_Chi_Minh and therefore satisfy the UI's current selection gate (finite latitude + longitude + timezone).
- This is a data/search-logic smoke test, not a real browser/mobile or live weather API test. Kings Island's point is the resort-level pin, not an individual 18-hole layout entrance.


### Automated validation added — 2026-11-20
- Added `scripts/validate-course-data.mjs` using Node.js built-in assertions (no third-party dependencies).
- Checks unique/stable course IDs, allowed country/status values, coordinate pair/ranges, valid IANA timezones, required fields for fully verified records, Vietnam course count, seven Hanoi search aliases, inline JavaScript syntax and PWA manifest icon entries.
- Added `.github/workflows/validate-course-data.yml` for development/main pushes, main-targeted PRs and manual dispatch.
- Files are committed to development. Pull-request CI run #44712504749 completed successfully. Runner output: PASS — 44 courses; 24 GPS+timezone; 8 Vietnam courses; 7 alias/name search cases; 1 inline script syntax; manifest checks. The parallel push-triggered run was still in progress at the last status check.
- This automated check is static/data validation; it does not replace browser/mobile end-to-end tests or live Open-Meteo API checks.


### Ensemble precipitation timezone correction — 2026-11-20
- Found a global-course defect: ensemble rain-probability requests and their Best Match fallback were hard-coded to `Asia/Taipei`, which could shift hourly precipitation timestamps for Vietnam, Japan, Korea and other time zones.
- Updated `getRainProbability` to receive the selected course's `currentCourseTimezone` and URL-encode it for both the ensemble endpoints and fallback forecast endpoint.
- Updated ensemble model identifiers to the currently documented Open-Meteo API names: `ecmwf_ifs025_ensemble`, `ncep_gefs_seamless`, and `dwd_icon_seamless_eps`.
- Open-Meteo's official Ensemble API documentation lists IANA timezone support and these model identifiers. A direct live endpoint request could not be verified through the available web fetch environment; the GitHub Actions run for commit `73c2d8f` completed successfully (run #44712678931). This confirms static syntax/data checks, not a live weather endpoint response.
- This fixes the rain-probability timestamp timezone path only. The separate six deterministic model endpoints still require live API/browser verification.


### Long-range forecast panel — 2026-11-20
- Added a separate long-range forecast section after the existing 16-day daily forecast, with 30-day and 60-day display controls. The existing 16-day and hourly forecast logic is unchanged.
- The 30-day view displays daily maximum/minimum temperature, daily precipitation total, weather code and maximum wind from ECMWF EC46.
- The 60-day view displays the EC46 daily forecast through day 46, then adds SEAS5 monthly anomaly context. It does not invent daily weather icons or daily rain probabilities for days 47–60.
- The seasonal API data is global at 36 km and not bias-corrected; the UI labels it as regional trend guidance, not a course-level tee-time forecast.
- Added `scripts/test-long-range-api.mjs` and `.github/workflows/long-range-api-smoke.yml`. Live GitHub Actions run #44713210019 passed: Hanoi test location returned 46 EC46 daily rows and 3 SEAS5 monthly rows, both with timezone `Asia/Ho_Chi_Minh`.
- The first smoke-test attempt found an invalid SEAS5 monthly variable (`precipitation_sum`); corrected it to the documented `precipitation_mean` field, and the subsequent live API test passed.
- Browser/mobile visual testing and real course-by-course validation remain pending. No Cloudflare deployment or merge was performed.
