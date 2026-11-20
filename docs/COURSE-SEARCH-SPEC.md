# Course Search Specification

## User-facing search
- Country filter plus one universal search field.
- Live local-index search with 250 ms debounce.
- Case-, punctuation-, whitespace- and word-order-insensitive matching.
- Ranking: exact official name > exact alias > prefix > token match > fuzzy spelling > address match.
- Search English official names, short names, aliases, local-language names/addresses, city, region, country and postal code.
- Result cards show photo/placeholder, official name, city/region/country, official address, GPS coordinates, verification state, favorite and select controls.
- Recent searches: latest 10; favorites; restore last country filter.
- GPS and map-point search use a separately configured geocoder/map provider.
- Offline cache for course records, favorites and recent selections.

## Data integrity
- Keep official address separate from map/geocoder address.
- GPS must identify the course property, not a city centroid.
- Use stable IDs; similarly named venues must not be merged.
- Missing photos use a consistent placeholder; do not scrape unlicensed images.
- Unverified fields must remain visibly unverified; never synthesize official addresses or coordinates.

## Architecture
1. Normalize Unicode, case, punctuation and whitespace.
2. Build a token index from official names, aliases, local names, keywords, city, region, country, postal code and addresses.
3. Rank deterministically and preserve country/city context.
4. Use external geocoding only after local-index search fails or when map/GPS discovery is explicitly requested.
5. Store favorites and recent selections locally.

## Initial scope
JP, KR, CN, VN, TH, MY, SG, ID.
