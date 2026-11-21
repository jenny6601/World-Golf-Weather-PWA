import assert from "node:assert/strict";

const locations = [
  { country: "JP", lat: 35.68, lon: 139.69, timezone: "Asia/Tokyo" },
  { country: "KR", lat: 37.57, lon: 126.98, timezone: "Asia/Seoul" },
  { country: "CN", lat: 31.23, lon: 121.47, timezone: "Asia/Shanghai" },
  { country: "VN", lat: 21.03, lon: 105.83, timezone: "Asia/Ho_Chi_Minh" },
  { country: "TH", lat: 13.76, lon: 100.50, timezone: "Asia/Bangkok" },
  { country: "MY", lat: 3.14, lon: 101.69, timezone: "Asia/Kuala_Lumpur" },
  { country: "SG", lat: 1.35, lon: 103.82, timezone: "Asia/Singapore" },
  { country: "ID", lat: -8.65, lon: 115.22, timezone: "Asia/Makassar" }
];
const base = "https://seasonal-api.open-meteo.com/v1/forecast";
const get = async (params, label) => {
  const response = await fetch(base + "?" + params.toString(), { signal: AbortSignal.timeout(25000) });
  const body = await response.json();
  assert.equal(response.status, 200, `${label}: HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
};

for (const p of locations) {
  const dailyParams = new URLSearchParams({
    latitude: String(p.lat), longitude: String(p.lon), timezone: p.timezone,
    forecast_days: "46", models: "ecmwf_ec46",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max",
    wind_speed_unit: "kmh"
  });
  const daily = await get(dailyParams, `${p.country} EC46`);
  assert.equal(daily.timezone, p.timezone, `${p.country}: EC46 timezone mismatch`);
  assert.ok(Array.isArray(daily.daily?.time) && daily.daily.time.length >= 30, `${p.country}: EC46 daily rows missing`);
  for (const key of ["temperature_2m_max","temperature_2m_min","precipitation_sum","weather_code","wind_speed_10m_max"]) {
    assert.ok(Array.isArray(daily.daily[key]) && daily.daily[key].some(v => v !== null), `${p.country}: EC46 ${key} missing`);
  }

  const monthlyParams = new URLSearchParams({
    latitude: String(p.lat), longitude: String(p.lon), timezone: p.timezone,
    forecast_days: "90", models: "ecmwf_seas5",
    monthly: "temperature_2m_mean,temperature_2m_anomaly,precipitation_mean,precipitation_anomaly,wind_speed_10m_mean,wind_speed_10m_anomaly"
  });
  const monthly = await get(monthlyParams, `${p.country} SEAS5`);
  assert.equal(monthly.timezone, p.timezone, `${p.country}: SEAS5 timezone mismatch`);
  assert.ok(Array.isArray(monthly.monthly?.time) && monthly.monthly.time.length >= 1, `${p.country}: SEAS5 monthly rows missing`);
  for (const key of ["temperature_2m_mean","temperature_2m_anomaly","precipitation_mean","precipitation_anomaly","wind_speed_10m_mean","wind_speed_10m_anomaly"]) {
    assert.ok(Array.isArray(monthly.monthly[key]), `${p.country}: SEAS5 ${key} missing`);
  }
  console.log(`PASS ${p.country}: EC46 ${daily.daily.time.length} daily rows; SEAS5 ${monthly.monthly.time.length} monthly rows; ${p.timezone}`);
}
console.log(`PASS all ${locations.length} Asia country/timezone test points`);
