import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("functions/api/metar-nearby.js", "utf8")
  .replace("export async function onRequestGet", "async function onRequestGet") +
  "\nthis.__handler = onRequestGet;";

const course = {
  course_id: "jp-abiko",
  name_en: "Abiko Golf Club",
  latitude: 35.867525722534616,
  longitude: 140.04306791528322
};
const now = Date.now();
const observedAt = new Date(now - 20 * 60000).toISOString();
const header = "raw_text,station_id,latitude,longitude,observation,temp_c,dewpoint,wind_dir,wind_speed,wind_gust,visibility,altimeter";
const row = [
  "RJAA 201000Z 18008KT 9999 FEW020 18/10 Q1013",
  "RJAA", "35.7653", "140.3864", observedAt, "18", "10", "180", "8", "12", "", "29.91"
].join(",");
const csv = header + "\n" + row + "\n";

const context = {
  URL, URLSearchParams, Request, Response, Blob, DecompressionStream, TextDecoder,
  Date, Math, Number, String, JSON, Uint8Array,
  fetch: async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/data/courses/asia-courses.json")) {
      return new Response(JSON.stringify({ courses: [course] }), { status: 200 });
    }
    if (url.hostname === "aviationweather.gov" && url.pathname === "/data/cache/metars.cache.csv.gz") {
      return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
    }
    throw new Error("Unexpected fetch: " + url.href);
  }
};
vm.runInNewContext(source, context);
const response = await context.__handler({ request: new Request("https://preview.example/api/metar-nearby?courseId=jp-abiko") });
assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.status, "fresh");
assert.equal(body.observation.stationId, "RJAA");
assert.equal(body.observation.temperatureC, 18);
assert.equal(body.observation.dewpointC, 10);
assert.equal(body.observation.windDirection, 180);
assert.equal(body.observation.windKmh, 14.8);
assert.equal(body.observation.visibilityKm, 10);
assert.equal(body.observation.pressureHpa, 1012.9);
assert.ok(body.observation.distanceKm > 0 && body.observation.distanceKm < 50);
assert.equal(body.searchedStations, 1);
console.log("METAR CSV tests passed: parsing, station selection, distance, observation mapping, and freshness.");
async function assertVisibility(rawText, csvMiles, expectedKm) {
  const testRow = [
    rawText, "RJAA", "35.7653", "140.3864", observedAt, "18", "10", "180", "8", "", csvMiles, "29.91"
  ].join(",");
  const testCsv = header + "\n" + testRow + "\n";
  const testContext = {
    URL, URLSearchParams, Request, Response, Blob, DecompressionStream, TextDecoder,
    Date, Math, Number, String, JSON, Uint8Array,
    fetch: async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/data/courses/asia-courses.json")) return new Response(JSON.stringify({ courses: [course] }));
      if (url.hostname === "aviationweather.gov") return new Response(testCsv, { status: 200, headers: { "content-type": "text/csv" } });
      throw new Error("Unexpected fetch: " + url.href);
    }
  };
  vm.runInNewContext(source, testContext);
  const res = await testContext.__handler({ request: new Request("https://preview.example/api/metar-nearby?courseId=jp-abiko") });
  const data = await res.json();
  assert.equal(data.observation.visibilityKm, expectedKm, rawText);
}
await assertVisibility("RJAA 201000Z 18008KT 8000 FEW020 18/10 Q1013", "4.97", 8);
await assertVisibility("WMSA 201000Z 18008KT 9000 FEW020 18/10 Q1013", "5.59", 9);
await assertVisibility("RJTY 201000Z 18008KT 10SM CLR 18/10 A2992", "10", 16.09);
console.log("METAR visibility unit tests passed: 8000m, 9000m, and 10SM.");


const noDataContext = {
  ...context,
  fetch: async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/data/courses/asia-courses.json")) return new Response(JSON.stringify({ courses: [course] }));
    if (url.hostname === "aviationweather.gov") return new Response(header + "\n", { status: 200, headers: { "content-type": "text/csv" } });
    throw new Error("Unexpected fetch: " + url.href);
  }
};
vm.runInNewContext(source, noDataContext);
const noDataResponse = await noDataContext.__handler({ request: new Request("https://preview.example/api/metar-nearby?courseId=jp-abiko") });
const noData = await noDataResponse.json();
assert.equal(noData.status, "no_nearby_recent_station");
assert.equal(noData.searchedStations, 0);
console.log("METAR CSV no-data handling passed.");
