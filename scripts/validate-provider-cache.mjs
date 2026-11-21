import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const outputDir = process.env.OUTPUT_DIR || "/tmp/provider-cache-output";
const database = JSON.parse(await readFile(new URL("../data/courses/asia-courses.json", import.meta.url), "utf8"));
const index = JSON.parse(await readFile(path.join(outputDir, "index.json"), "utf8"));
const expectedCourses = database.courses;
const expectedNames = new Set(expectedCourses.map(c => c.name_en || c.name || c.course_id));
const indexedNames = Object.keys(index.courses || {});

assert.equal(index.schema_version, 1, "Unsupported provider cache schema_version");
assert.ok(index.generated_at && Number.isFinite(Date.parse(index.generated_at)), "index.generated_at must be a valid timestamp");
assert.equal(index.course_count, expectedCourses.length, "index.course_count must match the course database");
assert.equal(indexedNames.length, expectedCourses.length, "Every course must have exactly one cache index entry");
for (const name of expectedNames) assert.ok(index.courses[name], "Missing cache index entry: " + name);

const providerTotals = { "Visual Crossing": { ok: 0, error: 0, hours: 0 }, Foreca: { ok: 0, error: 0, hours: 0 } };
let coursesWithUsableProvider = 0;
for (const course of expectedCourses) {
  const name = course.name_en || course.name || course.course_id;
  const relativePath = index.courses[name];
  assert.ok(typeof relativePath === "string" && relativePath.startsWith("courses/") && relativePath.endsWith(".json"), "Unsafe or invalid cache path for " + name);
  const file = JSON.parse(await readFile(path.join(outputDir, relativePath), "utf8"));
  assert.ok(file.generated_at && Number.isFinite(Date.parse(file.generated_at)), name + " missing generated_at");
  const daily = file.courses?.[name];
  assert.ok(daily && typeof daily === "object", name + " missing courses[name] data");
  let courseHasUsableProvider = false;
  for (const providerName of Object.keys(providerTotals)) {
    const days = Object.values(daily);
    const entries = days.map(day => day.providers?.[providerName]).filter(Boolean);
    const successful = entries.filter(p => p.status === "ok");
    const failed = entries.filter(p => p.status !== "ok");
    providerTotals[providerName].ok += successful.length ? 1 : 0;
    providerTotals[providerName].error += failed.length ? 1 : 0;
    const hours = successful.flatMap(p => p.hourly || []);
    providerTotals[providerName].hours += hours.length;
    if (hours.length) courseHasUsableProvider = true;
    for (const hour of hours) {
      assert.ok(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/.test(hour.time), name + " " + providerName + " invalid local timestamp: " + hour.time);
      for (const key of ["temperature_2m","apparent_temperature","relative_humidity_2m","precipitation","precipitation_probability","wind_speed_10m","wind_direction_10m","wind_gusts_10m"]) {
        const value = hour[key];
        assert.ok(value === null || (typeof value === "number" && Number.isFinite(value)), name + " " + providerName + " invalid " + key);
      }
      if (hour.precipitation_probability !== null) assert.ok(hour.precipitation_probability >= 0 && hour.precipitation_probability <= 100, name + " precipitation probability outside 0–100");
      if (hour.relative_humidity_2m !== null) assert.ok(hour.relative_humidity_2m >= 0 && hour.relative_humidity_2m <= 100, name + " relative humidity outside 0–100");
    }
  }
  assert.ok(courseHasUsableProvider, name + " has no usable hourly data from either provider");
  coursesWithUsableProvider++;
}
assert.equal(coursesWithUsableProvider, expectedCourses.length);
console.log("PASS: " + expectedCourses.length + " courses indexed; all have usable hourly data from at least one provider.");
for (const [name, stats] of Object.entries(providerTotals)) {
  console.log(name + ": " + stats.ok + " courses with successful data; " + stats.error + " with at least one failed date; " + stats.hours + " hourly rows.");
}
