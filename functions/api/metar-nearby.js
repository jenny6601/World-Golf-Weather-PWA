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

  // Use AWC's official worldwide METAR cache. It is refreshed about once per minute
  // and avoids the undocumented/strict bbox density parameters of the map-oriented query.
  const cacheUrl = "https://aviationweather.gov/data/cache/metars.cache.csv.gz";
  let cacheResponse;
  try {
    cacheResponse = await fetch(cacheUrl, {
      headers: { "accept": "text/csv", "user-agent": "World-Golf-Weather-PWA/1.0 (global golf course observation)" },
      cf: { cacheTtl: 60, cacheEverything: true }
    });
  } catch (error) {
    return json({ courseId, status: "provider_unreachable", message: String(error) }, 502);
  }
  if (!cacheResponse.ok) {
    const providerBody = (await cacheResponse.text()).slice(0, 1200);
    return json({ courseId, status: "provider_error", providerStatus: cacheResponse.status, providerMessage: providerBody,
      diagnostic: { endpoint: cacheUrl, source: "AWC worldwide METAR CSV cache" } }, 502);
  }
  // Cloudflare normally transparently decodes HTTP gzip. Some upstream/cache
  // paths may still expose the gzip payload, so detect the magic bytes and decode
  // explicitly before parsing the CSV.
  let csvBytes = new Uint8Array(await cacheResponse.arrayBuffer());
  if (csvBytes.length >= 2 && csvBytes[0] === 0x1f && csvBytes[1] === 0x8b) {
    try {
      const decompressed = new Response(new Blob([csvBytes]).stream().pipeThrough(new DecompressionStream("gzip")));
      csvBytes = new Uint8Array(await decompressed.arrayBuffer());
    } catch (error) {
      return json({ courseId, status: "invalid_provider_response", message: "Unable to decompress AWC METAR cache",
        diagnostic: { contentType: cacheResponse.headers.get("content-type"), contentEncoding: cacheResponse.headers.get("content-encoding"), error: String(error) } }, 502);
    }
  }
  const csvText = new TextDecoder("utf-8").decode(csvBytes).replace(/^\\uFEFF/, "");
  const parseCsvLine = line => {
    const values = [];
    let value = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === "," && !quoted) {
        values.push(value); value = "";
      } else value += ch;
    }
    values.push(value);
    return values;
  };
  const lines = csvText.split(/\\r?\\n/);
  const headerIndex = lines.findIndex(line => {
    const cells = parseCsvLine(line).map(value => value.trim().replace(/^"|"$/g, "").toLowerCase());
    return cells.includes("station_id") && cells.includes("latitude") && cells.includes("longitude") &&
      (cells.includes("raw_text") || cells.includes("raw_ob"));
  });
  if (headerIndex < 0) return json({ courseId, status: "invalid_provider_response", message: "AWC METAR cache CSV header not found",
    diagnostic: { contentType: cacheResponse.headers.get("content-type"), contentEncoding: cacheResponse.headers.get("content-encoding"),
      bytes: csvBytes.length, preview: csvText.slice(0, 500) } }, 502);
  const headers = parseCsvLine(lines[headerIndex]).map(value => value.trim().replace(/^"|"$/g, ""));
  const reports = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index] ?? ""]));
    reports.push({
      icaoId: row.station_id,
      name: row.station_id,
      lat: row.latitude,
      lon: row.longitude,
      obsTime: row.observation_time,
      temp: row.temp_c,
      dewp: row.dewpoint_c,
      wdir: row.wind_dir_degrees ?? row.winddir,
      wspd: row.wind_speed_kt,
      wgst: row.wind_gust_kt ?? row.wind_gust,
      visib: row.visibility_statute_mi ?? row.visibility,
      altim: row.altim_in_hg,
      rawOb: row.raw_text
    });
  }

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
