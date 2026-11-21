import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const databasePath = new URL("../data/courses/asia-courses.json", import.meta.url);
const database = JSON.parse(await readFile(databasePath, "utf8"));
const courses = (database.courses || []).filter(course =>
  Number.isFinite(course.latitude) && Number.isFinite(course.longitude) && course.timezone
);
assert.ok(courses.length > 0, "No courses with GPS coordinates and IANA timezone were found.");

const vcKey = process.env.VC_API_KEY;
const forecaKey = process.env.FORECA_API_KEY;
if (!vcKey || !forecaKey) {
  throw new Error("Missing GitHub Actions Secrets: configure VC_API_KEY and FORECA_API_KEY. Do not put keys in source files.");
}

const outputDir = process.env.OUTPUT_DIR || "/tmp/provider-cache-output";
const generatedAt = new Date().toISOString();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const numberOrNull = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

async function fetchJson(url, headers, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 3000;
        if (attempt < 4) { await sleep(delay); continue; }
      }
      if (!response.ok) throw new Error(label + " HTTP " + response.status);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 2000);
    }
  }
  throw lastError || new Error(label + " request failed");
}

function makeVisualCrossingUrl(course) {
  const location = encodeURIComponent(course.latitude + "," + course.longitude);
  const url = new URL("https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/" + location);
  url.search = new URLSearchParams({
    key: vcKey,
    unitGroup: "metric",
    contentType: "json",
    include: "hours,days",
    elements: "datetime,temp,feelslike,humidity,precip,precipprob,windspeed,winddir,windgust,conditions,icon",
    lang: "zh",
    timezone: course.timezone
  }).toString();
  return url;
}

function makeForecaUrl(course) {
  const url = new URL("https://weatherapi.foreca.net/api/v1/forecast/hourly/" + course.longitude + "," + course.latitude);
  url.search = new URLSearchParams({
    periods: "169",
    dataset: "full",
    tempunit: "C",
    windunit: "KMH",
    tz: course.timezone,
    lang: "zh"
  }).toString();
  return url;
}

function normalizeVcDay(day) {
  return (day.hours || []).map(hour => ({
    time: day.datetime + "T" + String(hour.datetime || "00:00:00"),
    temperature_2m: numberOrNull(hour.temp),
    apparent_temperature: numberOrNull(hour.feelslike),
    relative_humidity_2m: numberOrNull(hour.humidity),
    precipitation: numberOrNull(hour.precip),
    precipitation_probability: numberOrNull(hour.precipprob),
    wind_speed_10m: numberOrNull(hour.windspeed),
    wind_direction_10m: numberOrNull(hour.winddir),
    wind_gusts_10m: numberOrNull(hour.windgust),
    conditions: hour.conditions || day.conditions || "",
    icon: hour.icon || day.icon || "",
    weather_code: null
  }));
}

function forecaDateKey(value, timezone) {
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value || ""))) {
    const n = Number(value);
    const date = new Date(String(value).length <= 10 ? n * 1000 : n);
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
}

function normalizeForecaHour(hour, timezone) {
  const rawTime = String(hour.time || "");
  const date = forecaDateKey(hour.time, timezone);
  if (!date) return null;
  let clock = "00:00:00";
  const timeMatch = rawTime.match(/T(\d{2}:\d{2}(?::\d{2})?)/);
  if (timeMatch) clock = timeMatch[1].length === 5 ? timeMatch[1] + ":00" : timeMatch[1];
  else if (/^\d{10,13}$/.test(rawTime)) {
    const n = Number(rawTime);
    const dt = new Date(rawTime.length <= 10 ? n * 1000 : n);
    clock = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(dt);
  }
  return {
    time: date + "T" + clock,
    temperature_2m: numberOrNull(hour.temperature),
    apparent_temperature: numberOrNull(hour.feelsLikeTemp),
    relative_humidity_2m: numberOrNull(hour.relHumidity),
    precipitation: numberOrNull(hour.precipAccum),
    precipitation_probability: numberOrNull(hour.precipProb),
    wind_speed_10m: numberOrNull(hour.windSpeed),
    wind_direction_10m: numberOrNull(hour.windDir),
    wind_gusts_10m: numberOrNull(hour.windGust),
    conditions: hour.symbolPhrase || "",
    icon: hour.symbol || "",
    weather_code: null
  };
}

async function collectCourse(course) {
  const result = {
    course_id: course.course_id,
    course_name: course.name_en || course.name || course.course_id,
    country_code: course.country_code,
    timezone: course.timezone,
    generated_at: new Date().toISOString(),
    providers: {}
  };
  const [vc, foreca] = await Promise.allSettled([
    fetchJson(makeVisualCrossingUrl(course), { accept: "application/json" }, "Visual Crossing " + course.course_id),
    fetchJson(makeForecaUrl(course), { authorization: "Bearer " + forecaKey, accept: "application/json" }, "Foreca " + course.course_id)
  ]);

  if (vc.status === "fulfilled") {
    result.providers["Visual Crossing"] = {
      status: "ok",
      display_name: "Visual Crossing",
      fetched_at: new Date().toISOString(),
      days: (vc.value.days || []).map(day => ({
        date: day.datetime,
        hourly: normalizeVcDay(day)
      }))
    };
  } else {
    result.providers["Visual Crossing"] = { status: "error", display_name: "Visual Crossing", message: String(vc.reason?.message || vc.reason) };
  }

  if (foreca.status === "fulfilled") {
    const grouped = new Map();
    for (const item of foreca.value.forecast || []) {
      const normalized = normalizeForecaHour(item, course.timezone);
      if (!normalized) continue;
      const date = normalized.time.slice(0, 10);
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(normalized);
    }
    result.providers.Foreca = {
      status: "ok",
      display_name: "Foreca",
      fetched_at: new Date().toISOString(),
      days: [...grouped.entries()].map(([date, hourly]) => ({ date, hourly }))
    };
  } else {
    result.providers.Foreca = { status: "error", display_name: "Foreca", message: String(foreca.reason?.message || foreca.reason) };
  }
  return result;
}

const index = {
  schema_version: 1,
  generated_at: generatedAt,
  course_count: courses.length,
  providers: ["Visual Crossing", "Foreca"],
  courses: {}
};
await mkdir(path.join(outputDir, "courses"), { recursive: true });
let next = 0;
let completed = 0;
const errors = [];
const worker = async () => {
  while (true) {
    const i = next++;
    if (i >= courses.length) return;
    const course = courses[i];
    try {
      const record = await collectCourse(course);
      const daily = {};
      for (const providerName of ["Visual Crossing", "Foreca"]) {
        const provider = record.providers[providerName];
        for (const day of provider.days || []) {
          if (!daily[day.date]) daily[day.date] = { providers: {} };
          daily[day.date].providers[providerName] = {
            status: provider.status,
            display_name: provider.display_name,
            hourly: day.hourly
          };
        }
      }
      const relativePath = "courses/" + course.course_id + ".json";
      index.courses[course.name_en || course.name || course.course_id] = relativePath;
      await writeFile(path.join(outputDir, relativePath), JSON.stringify({
        course: {
          course_id: course.course_id,
          name: course.name_en || course.name || course.course_id,
          country_code: course.country_code,
          timezone: course.timezone,
          latitude: course.latitude,
          longitude: course.longitude
        },
        generated_at: record.generated_at,
        dates: daily
      }));
      const states = Object.fromEntries(Object.entries(record.providers).map(([name, p]) => [name, p.status]));
      completed++;
      if (Object.values(states).every(status => status !== "ok")) errors.push(course.course_id + ": both providers failed");
      console.log("COURSE " + course.course_id + " " + JSON.stringify(states));
    } catch (error) {
      errors.push(course.course_id + ": " + (error.message || String(error)));
      console.error("COURSE_FAILED " + course.course_id + " " + (error.message || String(error)));
    }
    await sleep(500);
  }
};
await Promise.all(Array.from({ length: 2 }, worker));
index.completed_courses = completed;
index.failed_courses = errors.length;
index.errors = errors;
await writeFile(path.join(outputDir, "index.json"), JSON.stringify(index, null, 2));
await writeFile(path.join(outputDir, ".nojekyll"), "");
console.log("SUMMARY " + JSON.stringify({ total: courses.length, completed, failed: errors.length, outputDir }));
if (completed === 0) throw new Error("No course cache files were produced.");
