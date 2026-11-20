const COURSE_DATA_PATH = "/data/courses/asia-courses.json";
const CACHE_SECONDS = 600;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=120, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`,
    "x-content-type-options": "nosniff"
  }
});
const numberOrNull = value => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n;
};
const distanceKm = (aLat, aLon, bLat, bLon) => {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const relativeHumidity = (temp, dewpoint) => {
  if (temp === null || dewpoint === null) return null;
  const a = 17.625, b = 243.04;
  const rh = 100 * Math.exp((a * dewpoint) / (b + dewpoint) - (a * temp) / (b + temp));
  return Math.max(0, Math.min(100, Math.round(rh)));
};
const apparentTemperature = (temp, windKmh, humidity) => {
  if (temp === null) return null;
  if (temp <= 10 && windKmh !== null && windKmh > 4.8) {
    const v = Math.pow(windKmh, 0.16);
    return Math.round((13.12 + 0.6215 * temp - 11.37 * v + 0.3965 * temp * v) * 10) / 10;
  }
  if (temp >= 27 && humidity !== null) {
    const f = temp * 9 / 5 + 32, rh = humidity;
    const hi = -42.379 + 2.04901523*f + 10.14333127*rh - 0.22475541*f*rh - 0.00683783*f*f - 0.05481717*rh*rh + 0.00122874*f*f*rh + 0.00085282*f*rh*rh - 0.00000199*f*f*rh*rh;
    return Math.round(((hi - 32) * 5 / 9) * 10) / 10;
  }
  return Math.round(temp * 10) / 10;
};

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const courseId = requestUrl.searchParams.get("courseId");
  if (!courseId || !/^[a-z0-9-]{2,80}$/.test(courseId)) return json({ error: "invalid_course_id" }, 400);

  const courseUrl = new URL(COURSE_DATA_PATH, requestUrl.origin);
  const courseResponse = await fetch(courseUrl, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!courseResponse.ok) return json({ error: "course_data_unavailable" }, 502);
  const database = await courseResponse.json();
  const course = database.courses?.find(item => item.course_id === courseId);
  if (!course) return json({ error: "course_not_found" }, 404);
  const lat = numberOrNull(course.latitude), lon = numberOrNull(course.longitude);
  if (lat === null || lon === null) return json({ error: "course_location_incomplete" }, 422);

  // AWC METAR API is server-side only (CORS is disabled). Keep the query geographically narrow.
  const latPad = 1.25, lonPad = Math.min(2.5, 1.25 / Math.max(0.25, Math.cos(lat * Math.PI / 180)));
  const bbox = [Math.max(-90, lat-latPad), Math.max(-180, lon-lonPad), Math.min(90, lat+latPad), Math.min(180, lon+lonPad)].join(",");
  const metarUrl = new URL("https://aviationweather.gov/api/data/metar");
  metarUrl.search = new URLSearchParams({ bbox, format: "json", hours: "3" }).toString();
  let response;
  try {
    response = await fetch(metarUrl, { headers: { "accept": "application/json", "user-agent": "World-Golf-Weather-PWA/1.0 (global golf course observation)" } });
  } catch (error) {
    return json({ courseId, status: "provider_unreachable", message: String(error) }, 502);
  }
  if (response.status === 204) return json({ courseId, status: "no_recent_observation", generatedAt: new Date().toISOString() });
  if (!response.ok) {
    const providerBody = (await response.text()).slice(0, 1200);
    return json({
      courseId, status: "provider_error", providerStatus: response.status,
      providerMessage: providerBody,
      diagnostic: { bbox, endpoint: metarUrl.origin + metarUrl.pathname, query: { format: "json", hours: "3" } }
    }, 502);
  }
  let reports;
  try { reports = await response.json(); } catch { return json({ courseId, status: "invalid_provider_response" }, 502); }
  if (!Array.isArray(reports)) reports = reports?.data || reports?.metars || reports?.results || [];

  const now = Date.now();
  const candidates = reports.map(report => {
    const stationLat = numberOrNull(report.lat ?? report.latitude);
    const stationLon = numberOrNull(report.lon ?? report.longitude);
    const timeRaw = report.obsTime ?? report.reportTime ?? report.observationTime;
    const observedAt = typeof timeRaw === "number" ? new Date(timeRaw * 1000) : new Date(timeRaw);
    const ageMinutes = Number.isFinite(observedAt.getTime()) ? Math.max(0, (now - observedAt.getTime()) / 60000) : null;
    const temp = numberOrNull(report.temp ?? report.temperature);
    const dewpoint = numberOrNull(report.dewp ?? report.dewpoint);
    const humidity = relativeHumidity(temp, dewpoint);
    const windKnots = numberOrNull(report.wspd ?? report.windSpeed);
    const gustKnots = numberOrNull(report.wgst ?? report.windGust);
    return {
      stationId: report.icaoId ?? report.stationId ?? report.id ?? null,
      stationName: report.name ?? report.stationName ?? report.icaoId ?? "未知測站",
      latitude: stationLat, longitude: stationLon,
      distanceKm: stationLat === null || stationLon === null ? null : distanceKm(lat, lon, stationLat, stationLon),
      observedAt: Number.isFinite(observedAt.getTime()) ? observedAt.toISOString() : null,
      ageMinutes, temperatureC: temp, dewpointC: dewpoint, humidityPercent: humidity,
      windKmh: windKnots === null ? null : Math.round(windKnots * 1.852 * 10) / 10,
      gustKmh: gustKnots === null ? null : Math.round(gustKnots * 1.852 * 10) / 10,
      windDirection: numberOrNull(report.wdir ?? report.windDirection),
      visibilityKm: numberOrNull(report.visib ?? report.visibility),
      pressureHpa: numberOrNull(report.altim ?? report.altimeter),
      raw: report.rawOb ?? report.raw_text ?? report.raw ?? null
    };
  }).filter(item => item.distanceKm !== null && item.ageMinutes !== null && item.ageMinutes <= 180)
    .sort((a,b) => a.distanceKm - b.distanceKm);

  const station = candidates[0];
  if (!station || station.distanceKm > 150) {
    return json({ courseId, status: "no_nearby_recent_station", generatedAt: new Date().toISOString(), searchedStations: reports.length });
  }
  const apparentC = apparentTemperature(station.temperatureC, station.windKmh, station.humidityPercent);
  return json({
    course: { courseId, name: course.name_en, latitude: lat, longitude: lon },
    status: station.ageMinutes <= 90 ? "fresh" : "stale",
    source: "Aviation Weather Center (AWC) METAR",
    generatedAt: new Date().toISOString(),
    observation: { ...station, apparentTemperatureC: apparentC },
    searchedStations: reports.length
  });
}
