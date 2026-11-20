import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const database = JSON.parse(await readFile(new URL("../data/courses/asia-courses.json", import.meta.url), "utf8"));
const courses = database.courses.filter(c => Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && c.timezone);
assert.equal(courses.length, database.record_count, "Every course must have GPS and IANA timezone before full-course API test");

const base = "https://seasonal-api.open-meteo.com/v1/forecast";
const get = async (params, label) => {
  const response = await fetch(base + "?" + params.toString(), { signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  assert.equal(response.status, 200, `${label}: HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
};

const verify = async course => {
  const label = course.course_id;
  const common = { latitude: String(course.latitude), longitude: String(course.longitude), timezone: course.timezone };
  const dailyParams = new URLSearchParams({
    ...common, forecast_days: "46", models: "ecmwf_ec46",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max",
    wind_speed_unit: "kmh"
  });
  const daily = await get(dailyParams, `${label} EC46`);
  assert.equal(daily.timezone, course.timezone, `${label}: EC46 timezone mismatch`);
  assert.ok(Array.isArray(daily.daily?.time) && daily.daily.time.length >= 30, `${label}: EC46 daily rows missing`);
  for (const key of ["temperature_2m_max","temperature_2m_min","precipitation_sum","weather_code","wind_speed_10m_max"]) {
    assert.ok(Array.isArray(daily.daily[key]) && daily.daily[key].some(v => v !== null), `${label}: EC46 ${key} missing`);
  }

  const monthlyParams = new URLSearchParams({
    ...common, forecast_days: "90", models: "ecmwf_seas5",
    monthly: "temperature_2m_mean,temperature_2m_anomaly,precipitation_mean,precipitation_anomaly,wind_speed_10m_mean,wind_speed_10m_anomaly"
  });
  const monthly = await get(monthlyParams, `${label} SEAS5`);
  assert.equal(monthly.timezone, course.timezone, `${label}: SEAS5 timezone mismatch`);
  assert.ok(Array.isArray(monthly.monthly?.time) && monthly.monthly.time.length >= 1, `${label}: SEAS5 monthly rows missing`);
  for (const key of ["temperature_2m_mean","temperature_2m_anomaly","precipitation_mean","precipitation_anomaly","wind_speed_10m_mean","wind_speed_10m_anomaly"]) {
    assert.ok(Array.isArray(monthly.monthly[key]), `${label}: SEAS5 ${key} missing`);
  }
  return `${label}: EC46 ${daily.daily.time.length} days; SEAS5 ${monthly.monthly.time.length} months; ${course.timezone}`;
};

let next = 0;
const results = [];
const failures = [];
const worker = async () => {
  while (true) {
    const index = next++;
    if (index >= courses.length) return;
    const course = courses[index];
    try { results.push(await verify(course)); }
    catch (error) { failures.push(`${course.course_id}: ${error.message}`); }
  }
};
await Promise.all(Array.from({ length: 3 }, worker));
for (const line of results.sort()) console.log("PASS " + line);
for (const failure of failures) console.error("FAIL " + failure);
console.log(`RESULT ${results.length}/${courses.length} courses passed; ${failures.length} failed`);
assert.equal(failures.length, 0, "One or more golf-course forecast API checks failed");
