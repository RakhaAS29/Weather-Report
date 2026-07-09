/* =========================================================
   Weatherline — script.js
   Uses OpenWeatherMap's free classic endpoints (no card needed):
     - /data/2.5/weather   (current conditions)
     - /data/2.5/forecast  (5 days, in 3-hour steps)

   We aggregate the 3-hour forecast into one card per day
   ourselves, since the free tier doesn't include the daily
   One Call endpoint.
   ========================================================= */

// 1. PASTE YOUR API KEY BELOW -------------------------------
const API_KEY = "5f9ab869e82f7a02dae105600d305fc1";
// -------------------------------------------------------------

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const UNITS = "metric"; // "metric" = °C, "imperial" = °F

// ---- DOM references ----------------------------------------
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const geoButton = document.getElementById("geo-button");

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorText = document.getElementById("error-text");
const emptyState = document.getElementById("empty-state");

const currentPanel = document.getElementById("current-panel");
const forecastPanel = document.getElementById("forecast-panel");
const forecastStrip = document.getElementById("forecast-strip");

// ---- Event listeners -----------------------------------------
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = searchInput.value.trim();
  if (!city) return;
  fetchByCity(city);
});

geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Geolocation isn't supported by this browser.");
    return;
  }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showError("Couldn't get your location. Try searching instead.")
  );
});

// ---- Fetching --------------------------------------------------
async function fetchByCity(city) {
  showLoading();
  try {
    const [current, forecast] = await Promise.all([
      getJSON(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${UNITS}&appid=${API_KEY}`),
      getJSON(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${UNITS}&appid=${API_KEY}`),
    ]);
    renderWeather(current, forecast);
  } catch (err) {
    handleFetchError(err);
  }
}

async function fetchByCoords(lat, lon) {
  try {
    const [current, forecast] = await Promise.all([
      getJSON(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${UNITS}&appid=${API_KEY}`),
      getJSON(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${UNITS}&appid=${API_KEY}`),
    ]);
    renderWeather(current, forecast);
  } catch (err) {
    handleFetchError(err);
  }
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error("CITY_NOT_FOUND");
    if (res.status === 401) throw new Error("BAD_API_KEY");
    throw new Error("NETWORK");
  }
  return res.json();
}

function handleFetchError(err) {
  if (err.message === "CITY_NOT_FOUND") {
    showError("Couldn't find that place. Check the spelling and try again.");
  } else if (err.message === "BAD_API_KEY") {
    showError("API key missing or not active yet. New keys can take up to ~2 hours to activate.");
  } else {
    showError("Something went wrong reaching the weather service. Try again shortly.");
  }
}

// ---- Rendering ----------------------------------------------
function renderWeather(current, forecast) {
  updateSkyTheme(current);

  document.getElementById("current-place").textContent =
    `${current.name}${current.sys?.country ? ", " + current.sys.country : ""}`;
  document.getElementById("current-temp").textContent = Math.round(current.main.temp);
  document.getElementById("current-unit").textContent = UNITS === "metric" ? "C" : "F";
  document.getElementById("current-condition").textContent = current.weather[0].description;
  document.getElementById("current-feels").textContent = Math.round(current.main.feels_like);
  document.getElementById("current-humidity").textContent = current.main.humidity;
  document.getElementById("current-wind").textContent = current.wind.speed;
  document.getElementById("current-sunrise").textContent = formatTime(current.sys.sunrise, current.timezone);
  document.getElementById("current-sunset").textContent = formatTime(current.sys.sunset, current.timezone);

  renderForecast(forecast);

  emptyState.hidden = true;
  errorState.hidden = true;
  loadingState.hidden = true;
  currentPanel.hidden = false;
  forecastPanel.hidden = false;
}

function renderForecast(forecast) {
  const dailyBuckets = groupByDay(forecast.list);
  forecastStrip.innerHTML = "";

  dailyBuckets.slice(0, 5).forEach((day) => {
    const card = document.createElement("div");
    card.className = "forecast__day";
    card.innerHTML = `
      <p class="forecast__day-name">${day.label}</p>
      <img src="https://openweathermap.org/img/wn/${day.icon}.png" alt="${day.description}" loading="lazy" />
      <p class="forecast__day-temp">${day.hi}&deg; <span class="lo">${day.lo}&deg;</span></p>
    `;
    forecastStrip.appendChild(card);
  });
}

// Groups the 3-hour forecast entries into one summary per calendar day,
// picking the reading closest to midday as representative and tracking
// the day's high/low across all its entries.
function groupByDay(list) {
  const groups = new Map();

  list.forEach((entry) => {
    const date = new Date(entry.dt * 1000);
    const key = date.toISOString().slice(0, 10);
    const hour = date.getHours();

    if (!groups.has(key)) {
      groups.set(key, {
        date,
        entries: [],
      });
    }
    groups.get(key).entries.push({ entry, hour });
  });

  return Array.from(groups.values()).map(({ date, entries }) => {
    const temps = entries.map((e) => e.entry.main.temp);
    const midday = entries.reduce((closest, e) =>
      Math.abs(e.hour - 13) < Math.abs(closest.hour - 13) ? e : closest
    );

    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      hi: Math.round(Math.max(...temps)),
      lo: Math.round(Math.min(...temps)),
      icon: midday.entry.weather[0].icon,
      description: midday.entry.weather[0].description,
    };
  });
}

// ---- Sky theming (the signature visual) ----------------------
function updateSkyTheme(current) {
  const main = current.weather[0].main.toLowerCase(); // e.g. "clear", "clouds", "rain"
  const now = current.dt;
  const isDay = now >= current.sys.sunrise && now < current.sys.sunset;

  document.body.setAttribute("data-weather", main);
  document.body.setAttribute("data-time", isDay ? "day" : "night");
}

// ---- Helpers ---------------------------------------------------
function formatTime(unixSeconds, timezoneOffsetSeconds) {
  const date = new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
  return date.toUTCString().slice(17, 22); // HH:MM
}

function showLoading() {
  loadingState.hidden = false;
  errorState.hidden = true;
  emptyState.hidden = true;
  currentPanel.hidden = true;
  forecastPanel.hidden = true;
}

function showError(message) {
  errorText.textContent = message;
  errorState.hidden = false;
  loadingState.hidden = true;
  emptyState.hidden = true;
  currentPanel.hidden = true;
  forecastPanel.hidden = true;
}
