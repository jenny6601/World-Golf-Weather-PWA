import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const db = JSON.parse(await readFile(new URL("../data/courses/asia-courses.json", import.meta.url), "utf8"));
const expected = ["JP","KR","CN","VN","TH","MY","SG","ID"];
const samples = expected.map(code => {
  const rows = db.courses.filter(c => c.country_code === code && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && c.timezone);
  assert.ok(rows.length, `${code}: no coordinate/timezone-enabled course in database`);
  // Prefer fully verified locations; otherwise use the best available database coordinate
  // and report its verification status explicitly.
  return rows.find(c => c.verification_status === "verified") || rows.find(c => c.verification_status === "partially_verified") || rows[0];
});

const hourlyFields = [
  "temperature_2m","relative_humidity_2m","apparent_temperature","precipitation",
  "weather_code","wind_speed_10m","wind_gusts_10m","wind_direction_10m","cloud_cover","uv_index"
].join(",");
const failures = [];
for (const course of samples) {
  const label = `${course.country_code} ${course.name_en}`;
  const params = new URLSearchParams({
    latitude: String(course.latitude),
    longitude: String(course.longitude),
    hourly: hourlyFields,
    timezone: course.timezone,
    forecast_days: "3",
    wind_speed_unit: "kmh"
  });
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?" + params, { signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    assert.equal(response.status, 200, `${label}: HTTP ${response.status} ${JSON.stringify(body)}`);
    assert.equal(body.timezone, course.timezone, `${label}: timezone mismatch ${body.timezone}`);
    const h = body.hourly;
    assert.ok(Array.isArray(h?.time) && h.time.length >= 48, `${label}: hourly timeline missing`);
    const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: course.timezone, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
    const futureDate = h.time.map(t => t.slice(0,10)).find(d => d > localToday);
    assert.ok(futureDate, `${label}: no next local date in hourly forecast`);
    const indices = h.time.map((t,i) => t.startsWith(futureDate+"T") && Number(t.slice(11,13)) >= 6 && Number(t.slice(11,13)) <= 18 ? i : -1).filter(i => i >= 0);
    assert.equal(indices.length, 13, `${label}: expected 13 hourly slots for 06:00-18:00 on ${futureDate}, got ${indices.length}`);
    for (const key of ["temperature_2m","apparent_temperature","precipitation","weather_code","wind_speed_10m"]) {
      assert.ok(Array.isArray(h[key]) && indices.some(i => h[key][i] !== null && h[key][i] !== undefined), `${label}: ${key} has no values`);
    }
    const tempCount = indices.filter(i => Number.isFinite(h.temperature_2m[i])).length;
    const rainCount = indices.filter(i => Number.isFinite(h.precipitation[i])).length;
    const weatherCount = indices.filter(i => Number.isFinite(h.weather_code[i])).length;
    console.log(`PASS ${course.country_code} | ${course.name_en} | ${course.verification_status} | ${course.timezone} | ${futureDate} 06-18 | 13 slots | temp ${tempCount}/13 | rain ${rainCount}/13 | weather ${weatherCount}/13`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.error("FAIL", label, error.message);
  }
}
assert.deepEqual(failures, [], failures.join("\\n"));
console.log(`PASS all ${samples.length} country samples; 06:00-18:00 local hourly forecast verified`);
