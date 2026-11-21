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


### Eight-country long-range API verification — 2026-11-20
- Expanded the live smoke test from one Hanoi point to eight representative points: Tokyo (JP), Seoul (KR), Shanghai (CN), Hanoi (VN), Bangkok (TH), Kuala Lumpur (MY), Singapore (SG), and Bali (ID).
- For every point, verified HTTP success, timezone echo, 46 EC46 daily rows with the required daily variables, and SEAS5 monthly data with the required monthly fields.
- GitHub Actions run #44713420786 passed all eight points: each returned 46 daily rows and 3 monthly rows with the expected IANA timezone. Course database validation also passed on the same commit (#44713420800).
- These are representative regional API smoke tests, not a validation of every golf-course coordinate or forecast accuracy. The app remains un-deployed; browser/mobile acceptance is still pending.
- Clarified the 60-day panel heading: SEAS5 is shown as long-range monthly trend context after EC46, not as a daily forecast specifically covering days 47–60.


### Course GPS enrichment — 2026-11-20
- Added sourced golf-course-area coordinates for six records: Camellia Hills (JP), Woo Jeong Hills (KR), Siam Country Club Old Course (TH), KLGCC (MY), Sentosa Golf Club (SG), and Laguna National (SG).
- Each record retains partially_verified status and records coordinate_source plus a note that official-club-map cross-check is still pending. No status was upgraded to verified.
- GPS + timezone coverage increased from 24/44 (54.5%) to 30/44 (68.2%). Fourteen courses still lack one or both required location fields.
- Sources used: FullGolf for Camellia Hills and Woo Jeong Hills; OpenStreetMap-derived Mapcarta/GeoView for Siam Old Course, KLGCC and Laguna National; Where2Golf for Sentosa. These are course-area references, not claims of official survey-grade tee/clubhouse pins.


### Independent Visual Crossing + Foreca integration — 2026-11-20
- Added Cloudflare Pages Function `functions/api/provider-compare.js` to call Visual Crossing Timeline hourly/daily and Foreca hourly forecasts server-side for a selected course.
- Provider credentials are read only from encrypted Cloudflare Pages environment secrets `VC_API_KEY` and `FORECA_API_KEY`; they are never returned to the browser.
- The endpoint validates course ID and requires course latitude, longitude and IANA timezone from the app course database. Foreca uses longitude,latitude order and requests up to 169 hourly periods; Visual Crossing requests hourly and daily data.
- Provider responses remain separate and independently report success/failure; partial response is supported. No blind averaging and no changes to Open-Meteo, EC46, SEAS5, or existing forecast panels.
- Added `docs/PROVIDER-API-SECURITY.md` with Cloudflare secret setup and rollout procedure.
- Pending: Cloudflare Pages project/deployment is not configured yet; owner must add the two encrypted secrets in Cloudflare dashboard. Endpoint and live provider credentials have not yet been tested. No key values were requested or stored in chat or GitHub.


### Course GPS enrichment — second batch — 2026-11-20
- Added sourced coordinates for nine additional courses: Yalong Bay and Shanqin Bay (CN), Red Mountain and Nikanti (TH), The Els Club Teluk Datai (MY), Tanah Merah Garden Course (SG), Handara, New Kuta and Damai Indah PIK (ID).
- All nine remain partially_verified. Coordinate source URLs and provenance notes are stored per record; no record was upgraded to verified. Tanah Merah uses the Garden Course location as the club reference; course-specific routing may need a later check.
- GPS + timezone coverage is now 39/44 (88.6%). Five courses still lack GPS: Mission Hills Shenzhen, Mission Hills Dongguan, Sheshan International (CN), Pondok Indah and Jagorawi (ID).
- Sources include OpenStreetMap-derived Mapcarta/GeoView and golf-course directories (Where2Golf and Parscape). These are course-area reference points, not official survey-grade tee/clubhouse coordinates.


### Course GPS enrichment — third batch — 2026-11-20
- Added course-area GPS coordinates and IANA timezones for the final five previously incomplete records: Mission Hills Shenzhen, Mission Hills Dongguan, Sheshan International, Jagorawi, and Pondok Indah.
- All five remain partially_verified; no record was promoted to verified. The coordinates are reference points from golf-course directories and OpenStreetMap-derived course features, not official survey-grade pins.
- GPS + timezone coverage is now 44/44 (100%). This is field completeness only; it does not mean all 44 coordinates have been independently confirmed by each club.
- Mission Hills Shenzhen and Dongguan use FullGolf resort/course location points, with official Mission Hills contact pages confirming each venue's address. Because each is a multi-course complex, exact representative pin placement remains subject to official course-map confirmation.
- Sheshan uses Where2Golf coordinates, cross-checked against the OpenStreetMap-derived She Shan Golf Club course feature. A materially divergent FullGolf pin was not used.
- Jagorawi uses the Where2Golf Old Course coordinate; the club's official directions page independently confirms the Karanggan entrance and its relationship to the clubhouse.
- Pondok Indah uses Where2Golf coordinates, cross-checked against the OpenStreetMap-derived golf-course polygon. All Indonesia locations use Asia/Jakarta for these Jakarta/West Java venues.
- Sources: https://www.fullgolf.com/en/golf-club/china/guangdong/shenzhen/mission-hills-golf-club-shenzhen ; https://fullgolf.com/en/golf-club/china/guangdong/dongguan/mission-hills-golf-club-dongguan ; https://www.missionhillschina.com/en/others/about-us/contact-us/ ; https://www.where2golf.com/china/sheshan-golf-club/ ; https://mapcarta.com/W414295341 ; https://www.where2golf.com/indonesia/jagorawi-golf-country-club-old-course/ ; https://jagorawi.com/map-directions/ ; https://www.where2golf.com/indonesia/pondok-indah-golf-course/ ; https://mapcarta.com/W28420725
- Next validation: rerun the course-data validator and extend the long-range API smoke test to the full 44-course dataset. Browser/mobile acceptance remains pending.


### Full-course seasonal API verification — 2026-11-20
- Corrected the course database metadata count from 41 to 44; the actual course array contained 44 records and all 44 now have numeric latitude/longitude plus an IANA timezone.
- Added `scripts/test-all-course-seasonal-api.mjs` and `.github/workflows/full-course-seasonal-api.yml` to test every course coordinate against the live Open-Meteo Seasonal API.
- GitHub Actions run #44731566692 passed: 44/44 courses returned 46 EC46 daily rows and 3 SEAS5 monthly rows; every response timezone matched the course database; zero failures.
- Course database validation also passed in run #44731566695.
- This is an API connectivity, response-schema and timezone check at all 44 stored coordinate points. It does not prove coordinate pins are official/survey-grade, forecast accuracy, or visual correctness in a browser.
- Browser/mobile end-to-end testing remains pending. No production deployment or PR merge has been performed.


## Migration audit addendum (2026-11-21)

The live course database currently contains 56 records across 8 countries. Current verification statuses are 7 `verified` and 49 `partially_verified`; older references in this document to 44 records are historical and should not be treated as the current count.

The GitHub repository currently lists only these branches: `main`, `development`, `codex/asia-golf-weather-app-icon`, and the migration branch. The frontend's former raw-content references to `visual-crossing-cache` and `verification-history` therefore do not resolve as repository branches at this audit point. The migration work redirects provider reads to a dedicated `provider-forecast-cache` branch that is created by the scheduled cache workflow. Historical verification data remains a separate follow-up item.

The METAR live-observation panel, frontend request to `./api/metar-nearby`, and Cloudflare Pages Function sources have been removed from the migration branch. Cloudflare is no longer part of the target architecture or deployment plan.

Offline support is explicitly out of scope: no Service Worker, offline page, or precache workflow will be added. The development preview workflow has been changed to upload a downloadable artifact only; it no longer calls `actions/deploy-pages` and cannot overwrite the repository's configured Pages site.
