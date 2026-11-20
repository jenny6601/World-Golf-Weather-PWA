import assert from "node:assert/strict";

const lat = 21.0278, lon = 105.8342, timezone = "Asia/Ho_Chi_Minh";
const base = "https://seasonal-api.open-meteo.com/v1/forecast";
const dailyParams = new URLSearchParams({
  latitude: String(lat), longitude: String(lon), timezone,
  forecast_days: "46", models: "ecmwf_ec46",
  daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max",
  wind_speed_unit: "kmh"
});
const dailyResponse = await fetch(base + "?" + dailyParams);
assert.equal(dailyResponse.status, 200, "EC46 daily endpoint must return HTTP 200");
const daily = await dailyResponse.json();
assert.equal(daily.timezone, timezone, "EC46 timezone must match selected course");
assert.ok(Array.isArray(daily.daily?.time), "EC46 daily.time must be an array");
assert.ok(daily.daily.time.length >= 30, "EC46 should provide at least 30 daily dates");
for (const key of ["temperature_2m_max","temperature_2m_min","precipitation_sum","weather_code","wind_speed_10m_max"]) {
  assert.ok(Array.isArray(daily.daily[key]), `EC46 daily.${key} must be an array`);
  assert.ok(daily.daily[key].some(v => v !== null), `EC46 daily.${key} must contain values`);
}

const monthlyParams = new URLSearchParams({
  latitude: String(lat), longitude: String(lon), timezone,
  forecast_days: "90", models: "ecmwf_seas5",
  monthly: "temperature_2m_mean,temperature_2m_anomaly,precipitation_sum,precipitation_anomaly,wind_speed_10m_mean,wind_speed_10m_anomaly"
});
const monthlyResponse = await fetch(base + "?" + monthlyParams);
assert.equal(monthlyResponse.status, 200, "SEAS5 monthly endpoint must return HTTP 200");
const monthly = await monthlyResponse.json();
assert.equal(monthly.timezone, timezone, "SEAS5 timezone must match selected course");
assert.ok(Array.isArray(monthly.monthly?.time), "SEAS5 monthly.time must be an array");
for (const key of ["temperature_2m_mean","temperature_2m_anomaly","precipitation_sum","precipitation_anomaly","wind_speed_10m_mean","wind_speed_10m_anomaly"]) {
  assert.ok(Array.isArray(monthly.monthly[key]), `SEAS5 monthly.${key} must be an array`);
}
console.log(`PASS EC46: ${daily.daily.time.length} daily rows; timezone ${daily.timezone}`);
console.log(`PASS SEAS5: ${monthly.monthly.time.length} monthly rows; timezone ${monthly.timezone}`);
