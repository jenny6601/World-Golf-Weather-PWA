import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const db = JSON.parse(await readFile(new URL("../data/courses/asia-courses.json", import.meta.url), "utf8"));
const expectedCountries = ["JP","KR","CN","VN","TH","MY","SG","ID"];
const expectedCounts = { JP:6, KR:5, CN:5, VN:8, TH:5, MY:5, SG:5, ID:5 };
const zones = { JP:"Asia/Tokyo", KR:"Asia/Seoul", CN:"Asia/Shanghai", VN:"Asia/Ho_Chi_Minh", TH:"Asia/Bangkok", MY:"Asia/Kuala_Lumpur", SG:"Asia/Singapore" };
const errors = [];
const warnings = [];
const ids = new Set();
const names = new Set();
const coords = new Map();
const countryCounts = {};
const statusCounts = {};

assert.equal(db.record_count, db.courses.length, "record_count does not match courses.length");
assert.equal(db.courses.length, 44, "Expected 44 Asian golf courses");
assert.deepEqual([...db.countries].sort(), [...expectedCountries].sort(), "Country list mismatch");

for (const c of db.courses) {
  const label = c.course_id || c.name_en || "(unknown course)";
  if (!c.course_id || ids.has(c.course_id)) errors.push(`${label}: missing or duplicate course_id`);
  ids.add(c.course_id);
  if (!c.name_en || names.has(c.name_en)) errors.push(`${label}: missing or duplicate English name`);
  names.add(c.name_en);
  countryCounts[c.country_code] = (countryCounts[c.country_code] || 0) + 1;
  statusCounts[c.verification_status] = (statusCounts[c.verification_status] || 0) + 1;

  if (!expectedCountries.includes(c.country_code)) errors.push(`${label}: unsupported country_code ${c.country_code}`);
  if (!Number.isFinite(c.latitude) || c.latitude < -90 || c.latitude > 90) errors.push(`${label}: invalid latitude`);
  if (!Number.isFinite(c.longitude) || c.longitude < -180 || c.longitude > 180) errors.push(`${label}: invalid longitude`);
  if (!c.timezone) errors.push(`${label}: missing IANA timezone`);
  else {
    try { new Intl.DateTimeFormat("en-US", { timeZone:c.timezone }).format(new Date()); }
    catch { errors.push(`${label}: invalid IANA timezone ${c.timezone}`); }
  }

  const expectedZone = c.country_code === "ID"
    ? (c.longitude >= 110 ? "Asia/Makassar" : "Asia/Jakarta")
    : zones[c.country_code];
  if (expectedZone && c.timezone !== expectedZone) errors.push(`${label}: timezone ${c.timezone} inconsistent with expected ${expectedZone}`);

  if (Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
    const key = `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
    if (coords.has(key)) errors.push(`${label}: duplicate coordinates with ${coords.get(key)}`);
    else coords.set(key, label);
  }
  if (!c.official_address) warnings.push(`${label}: official_address missing`);
  if (!c.official_website) warnings.push(`${label}: official_website missing`);
  if (!c.coordinate_source) warnings.push(`${label}: coordinate_source missing`);
  if (!["verified","partially_verified","unverified"].includes(c.verification_status)) errors.push(`${label}: invalid verification_status`);
}

for (const code of expectedCountries) {
  if (countryCounts[code] !== expectedCounts[code]) errors.push(`${code}: expected ${expectedCounts[code]} courses, got ${countryCounts[code] || 0}`);
}
assert.deepEqual(statusCounts, { verified:7, partially_verified:37 }, "Verification status counts differ from current audited data");
assert.deepEqual(errors, [], errors.join("\\n"));
console.log(`PASS ${db.courses.length} courses | ${expectedCountries.length} countries | status verified ${statusCounts.verified}, partially_verified ${statusCounts.partially_verified}`);
console.log("PASS coordinates, unique IDs/names/coordinates, IANA timezones and country timezone mapping");
console.log(`DATA COMPLETENESS WARNINGS: ${warnings.length}`);
for (const warning of warnings) console.log("WARN " + warning);
