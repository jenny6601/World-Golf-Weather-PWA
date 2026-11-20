# Visual Crossing + Foreca provider integration

## Security model

The browser must never receive either provider key. Cloudflare Pages Functions reads these server-side environment variables only:

- `VC_API_KEY`
- `FORECA_API_KEY`

Do not put keys in `index.html`, JavaScript bundles, course JSON, GitHub commits, workflow logs, query-string links shared with users, or screenshots. If a key is exposed, revoke/rotate it at the provider.

## Cloudflare Pages configuration

In the Cloudflare Pages project for World Golf Weather, open Settings → Variables and Secrets → Add. Add both names above as **encrypted secrets** for the Production environment. Add them separately for Preview only if preview deployments should access paid provider data. Redeploy after adding or changing secrets.

The GitHub repository connector used for code changes cannot create repository Actions secrets. Do not send the key values in chat. Configure the secrets directly in the Cloudflare dashboard.

## Endpoint

After the Pages project is deployed, the server-side function is available at:

`GET /api/provider-compare?courseId=<course_id>`

The endpoint:
- Resolves a course only from the app's own course database.
- Requires valid latitude, longitude and IANA timezone.
- Calls Visual Crossing Timeline (hourly + daily) and Foreca hourly (up to 169 periods) server-side.
- Sends Foreca credentials in the Authorization Bearer header.
- Never returns credentials to the browser.
- Returns normalized provider payloads with independent success/error states.
- Uses a 15-minute shared cache policy; browser cache is 5 minutes.
- Returns partial results if one provider fails.

## Initial rollout

1. Add encrypted Production secrets in Cloudflare.
2. Deploy the Pages Function.
3. Test with one known course per country, then expand to all courses with coordinates.
4. Check each provider's plan, geographic coverage, attribution requirements, rate limits and billing before enabling scheduled multi-course refresh.
5. Only after endpoint tests pass, connect the results to the app's comparison UI.

## Important limits

This integration is an independent comparison feed. It does not replace Open-Meteo, EC46 or SEAS5, and does not alter the existing 16-day or long-range forecast calculations. Provider data should remain separately labelled and should not be averaged blindly. A provider's missing value is missing data, not zero.

## Official API references

- Visual Crossing Timeline API: https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/
- Visual Crossing key handling: https://www.visualcrossing.com/resources/documentation/weather-api/how-your-data-is-used-within-visual-crossing/
- Foreca authorization: https://developer.foreca.com/docs/authorization
- Foreca point forecasts: https://developer.foreca.com/docs/point-forecasts
