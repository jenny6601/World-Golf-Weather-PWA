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
const station = {
  icaoId: "RJAA",
  name: "Tokyo Narita International Airport",
  lat: 35.7653,
  lon: 140.3864,
  obsTime: Math.floor((now - 20 * 60000) / 1000),
  temp: 18,
  dewp: 10,
  wspd: 8,
  wgst: 12,
  wdir: 180,
  visib: 10,
  altim: 1013,
  rawOb: "RJAA 201000Z 18008KT 9999 FEW020 18/10 Q1013"
};
let metarUrl;
const context = {
  URL, URLSearchParams, Response, Date, Math, Number, String, JSON,
  fetch: async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/data/courses/asia-courses.json")) {
      return new Response(JSON.stringify({ courses: [course] }), { status: 200 });
    }
    if (url.hostname === "aviationweather.gov" && url.pathname === "/api/data/metar") {
      metarUrl = url;
      return new Response(JSON.stringify([station]), { status: 200 });
    }
    throw new Error("Unexpected fetch: " + url.href);
  }
};
vm.runInNewContext(source, context);
const handler = context.__handler;
const response = await handler({ request: new Request("https://preview.example/api/metar-nearby?courseId=jp-abiko") });
assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.status, "fresh");
assert.equal(body.observation.stationId, "RJAA");
assert.equal(body.observation.temperatureC, 18);
assert.ok(body.observation.distanceKm > 0 && body.observation.distanceKm < 50);
assert.equal(metarUrl.searchParams.get("format"), "json");
assert.equal(metarUrl.searchParams.get("hours"), "3");
const bbox = metarUrl.searchParams.get("bbox").split(",").map(Number);
assert.equal(bbox.length, 4);
assert.ok(bbox[0] < course.latitude && bbox[2] > course.latitude);
assert.ok(bbox[1] < course.longitude && bbox[3] > course.longitude);
console.log("METAR endpoint tests passed: station selection, distance, observation mapping, freshness, and bbox.");

const noDataContext = {
  ...context,
  fetch: async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/data/courses/asia-courses.json")) return new Response(JSON.stringify({ courses: [course] }));
    if (url.hostname === "aviationweather.gov") return new Response(null, { status: 204 });
    throw new Error("Unexpected fetch");
  }
};
vm.runInNewContext(source, noDataContext);
const noDataResponse = await noDataContext.__handler({ request: new Request("https://preview.example/api/metar-nearby?courseId=jp-abiko") });
const noData = await noDataResponse.json();
assert.equal(noData.status, "no_recent_observation");
console.log("METAR endpoint no-data handling passed.");
