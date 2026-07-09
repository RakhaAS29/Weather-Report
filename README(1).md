# Weatherline

A small vanilla HTML/CSS/JS weather app: search a city, see current
conditions, and a 5-day outlook. Built against OpenWeatherMap's free
classic endpoints (no credit card required).

## Setup

1. Open `script.js` and paste your API key into:
   ```js
   const API_KEY = "YOUR_API_KEY_HERE";
   ```
2. Open `index.html` directly in a browser, or serve the folder with
   any static server (recommended, avoids some CORS quirks):
   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```
3. New OpenWeatherMap keys can take up to ~2 hours to activate. If you
   get a 401 error right after signing up, that's why — try again
   later.

## How it's built

- `index.html` — structure: search bar, loading/error/empty states,
  current conditions panel, forecast strip.
- `style.css` — the sky gradient behind everything shifts color based
  on the live weather condition and time of day (`data-weather` /
  `data-time` attributes set in JS). Fraunces (serif) is used for the
  big temperature reading; Space Mono for data labels, like an
  instrument readout.
- `script.js` — fetches `/data/2.5/weather` (current) and
  `/data/2.5/forecast` (5 days in 3-hour steps) in parallel, then
  groups the 3-hour blocks into daily high/low/icon summaries since
  the free tier doesn't include a true daily forecast endpoint.

## Notes on the API tier

This uses the **free, no-card** classic endpoints, which cap out at a
5-day forecast in 3-hour steps (aggregated here into daily cards). If
you later add a payment card to your OpenWeatherMap account, you can
switch to **One Call API 3.0/4.0** for a true 7-8 day daily forecast
with fewer client-side calls — it includes 1,000 free calls/day. That
would mean swapping the `/forecast` call in `script.js` for
`/data/3.0/onecall` and simplifying `groupByDay` since the data
already comes back per-day.

## Ideas for next steps

- Toggle between °C and °F (swap the `UNITS` constant and re-fetch)
- Cache the last searched city in memory so a reload doesn't lose it
- Debounce/autosuggest city names as the user types (needs the
  Geocoding API)
- Show a small sunrise/sunset position indicator using the sky panel
- Deploy to GitHub Pages
