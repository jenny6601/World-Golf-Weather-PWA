const COURSE_DATA_PATH = "/data/courses/asia-courses.json";
const CACHE_SECONDS = 900;
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=300, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
    "x-content-type-options": "nosniff",
    ...extra
  }
});

export async function onRequestGet({ request, env }) {
  if (!env.VC_API_KEY || !env.FORECA_API_KEY) {
    return json({ error: "provider_secrets_not_configured", message: "Server-side provider secrets are not configured." }, 503);
  }

  const requestUrl = new URL(request.url);
  const courseId = requestUrl.searchParams.get("courseId");
  if (!courseId || !/^[a-z0-9-]{2,80}$/.test(courseId)) {
    return json({ error: "invalid_course_id" }, 400);
  }

  const dataUrl = new URL(COURSE_DATA_PATH, requestUrl.origin);
  const courseResponse = await fetch(dataUrl, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!courseResponse.ok) return json({ error: "course_data_unavailable" }, 502);
  const database = await courseResponse.json();
  const course = database.courses?.find(item => item.course_id === courseId);
  if (!course) return json({ error: "course_not_found" }, 404);
  if (!Number.isFinite(course.latitude) || !Number.isFinite(course.longitude) || !course.timezone) {
    return json({ error: "course_location_incomplete", courseId }, 422);
  }

  const lat = course.latitude;
  const lon = course.longitude;
  const timezone = course.timezone;
  const location = `${lat},${lon}`;

  const vcUrl = new URL(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location}`);
  vcUrl.search = new URLSearchParams({
    key: env.VC_API_KEY,
    unitGroup: "metric",
    contentType: "json",
    include: "hours,days",
    elements: "datetime,temp,tempmax,tempmin,feelslike,humidity,precip,precipprob,windspeed,winddir,windgust,conditions,icon",
    lang: "zh"
  }).toString();

  const forecaUrl = new URL(`https://weatherapi.foreca.net/api/v1/forecast/hourly/${lon},${lat}`);
  forecaUrl.searchParams.set("periods", "169");
  forecaUrl.searchParams.set("dataset", "full");
  forecaUrl.searchParams.set("tempunit", "C");
  forecaUrl.searchParams.set("windunit", "KMH");
  forecaUrl.searchParams.set("tz", timezone);
  forecaUrl.searchParams.set("lang", "zh");

  const [vcResult, forecaResult] = await Promise.allSettled([
    fetch(vcUrl, { headers: { accept: "application/json" } }),
    fetch(forecaUrl, { headers: { authorization: `Bearer ${env.FORECA_API_KEY}`, accept: "application/json" } })
  ]);

  const readProvider = async (result, name) => {
    if (result.status !== "fulfilled") return { status: "network_error", message: String(result.reason) };
    if (!result.value.ok) return { status: "http_error", httpStatus: result.value.status };
    try {
      const body = await result.value.json();
      if (name === "visual_crossing") {
        return {
          status: "ok",
          timezone: body.timezone || timezone,
          fetchedAt: new Date().toISOString(),
          currentConditions: body.currentConditions || null,
          days: (body.days || []).map(day => ({
            datetime: day.datetime, tempmax: day.tempmax, tempmin: day.tempmin,
            precip: day.precip, precipprob: day.precipprob, windspeed: day.windspeed,
            windgust: day.windgust, conditions: day.conditions, hours: (day.hours || []).map(hour => ({
              datetime: hour.datetime, temp: hour.temp, feelslike: hour.feelslike,
              humidity: hour.humidity, precip: hour.precip, precipprob: hour.precipprob,
              windspeed: hour.windspeed, winddir: hour.winddir, windgust: hour.windgust,
              conditions: hour.conditions, icon: hour.icon
            }))
          }))
        };
      }
      return {
        status: "ok",
        fetchedAt: new Date().toISOString(),
        forecast: (body.forecast || []).map(hour => ({
          time: hour.time, symbol: hour.symbol, symbolPhrase: hour.symbolPhrase,
          temperature: hour.temperature, feelsLikeTemp: hour.feelsLikeTemp,
          relHumidity: hour.relHumidity, windSpeed: hour.windSpeed,
          windGust: hour.windGust, windDir: hour.windDir,
          precipProb: hour.precipProb, precipAccum: hour.precipAccum,
          cloudiness: hour.cloudiness, thunderProb: hour.thunderProb,
          uvIndex: hour.uvIndex, pressure: hour.pressure, visibility: hour.visibility
        }))
      };
    } catch {
      return { status: "invalid_json" };
    }
  };

  const [visualCrossing, foreca] = await Promise.all([
    readProvider(vcResult, "visual_crossing"),
    readProvider(forecaResult, "foreca")
  ]);
  const successCount = [visualCrossing, foreca].filter(item => item.status === "ok").length;
  return json({
    course: { courseId, name: course.name_en, country: course.country, timezone, latitude: lat, longitude: lon },
    generatedAt: new Date().toISOString(),
    providers: { visualCrossing, foreca },
    overallStatus: successCount === 2 ? "complete" : successCount === 1 ? "partial" : "unavailable"
  }, successCount ? 200 : 502);
}
