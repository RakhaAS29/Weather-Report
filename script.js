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
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const UNITS = "metric"; // "metric" = °C, "imperial" = °F

// ---- DOM references ----------------------------------------
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const geoButton = document.getElementById("geo-button");
const suggestionsList = document.getElementById("suggestions-list");

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorText = document.getElementById("error-text");
const emptyState = document.getElementById("empty-state");

const weatherCard = document.getElementById("weather-card");
const forecastStrip = document.getElementById("forecast-strip");

// ---- Autocomplete state ---------------------------------------
let suggestionTimer = null;
let currentSuggestions = [];
let activeSuggestionIndex = -1;

// ---- Event listeners -----------------------------------------
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = searchInput.value.trim();
  if (!city) return;
  closeSuggestions();
  fetchByCity(city);
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  clearTimeout(suggestionTimer);

  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  // Debounce so we're not firing a request on every keystroke
  suggestionTimer = setTimeout(() => fetchSuggestions(query), 300);
});

searchInput.addEventListener("keydown", (e) => {
  if (suggestionsList.hidden) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActiveSuggestion(activeSuggestionIndex + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActiveSuggestion(activeSuggestionIndex - 1);
  } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
    e.preventDefault();
    selectSuggestion(currentSuggestions[activeSuggestionIndex]);
  } else if (e.key === "Escape") {
    closeSuggestions();
  }
});

// Close the dropdown when clicking anywhere outside the search area
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) {
    closeSuggestions();
  }
});

geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Geolocation isn't supported by this browser.");
    return;
  }
  closeSuggestions();
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

// ---- Autocomplete: fetching + rendering -----------------------
async function fetchSuggestions(query) {
  try {
    const results = await getJSON(
      `${GEO_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
    );
    currentSuggestions = results || [];
    renderSuggestions();
  } catch {
    // Autocomplete failing silently is fine — the person can still
    // hit enter to search normally, so we just close the dropdown.
    closeSuggestions();
  }
}

function renderSuggestions() {
  if (!currentSuggestions.length) {
    closeSuggestions();
    return;
  }

  suggestionsList.innerHTML = "";
  activeSuggestionIndex = -1;

  currentSuggestions.forEach((place, index) => {
    const item = document.createElement("li");
    item.className = "suggestions__item";
    item.id = `suggestion-${index}`;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", "false");

    const region = [place.state, place.country].filter(Boolean).join(", ");
    item.innerHTML = `
      <span class="place">${place.name}</span>
      <span class="region">${region}</span>
    `;

    item.addEventListener("mousedown", (e) => {
      // mousedown (not click) fires before the input's blur, so the
      // selection registers before the outside-click handler closes it
      e.preventDefault();
      selectSuggestion(place);
    });

    suggestionsList.appendChild(item);
  });

  suggestionsList.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
}

function setActiveSuggestion(index) {
  const items = suggestionsList.querySelectorAll(".suggestions__item");
  if (!items.length) return;

  activeSuggestionIndex = (index + items.length) % items.length;

  items.forEach((item, i) => {
    const isActive = i === activeSuggestionIndex;
    item.setAttribute("aria-selected", String(isActive));
    if (isActive) item.scrollIntoView({ block: "nearest" });
  });
}

function selectSuggestion(place) {
  const region = [place.state, place.country].filter(Boolean).join(", ");
  searchInput.value = region ? `${place.name}, ${region}` : place.name;
  closeSuggestions();
  showLoading();
  fetchByCoords(place.lat, place.lon);
}

function closeSuggestions() {
  suggestionsList.hidden = true;
  suggestionsList.innerHTML = "";
  currentSuggestions = [];
  activeSuggestionIndex = -1;
  searchInput.setAttribute("aria-expanded", "false");
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
  weatherCard.hidden = false;
  document.body.setAttribute("data-layout", "results");
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
  weatherCard.hidden = true;
}

function showError(message) {
  errorText.textContent = message;
  errorState.hidden = false;
  loadingState.hidden = true;
  emptyState.hidden = true;
  weatherCard.hidden = true;
}

// ---- Highlights: a snapshot of a few random major cities -----
// A larger pool to draw from — 5 are picked at random on each load.
const HIGHLIGHT_CITY_POOL = [
  { name: "Tokyo", country: "JP" },
  { name: "London", country: "GB" },
  { name: "Berlin", country: "DE" },
  { name: "St. Petersburg", country: "RU" },
  { name: "Cairo", country: "EG" },
  { name: "New York", country: "US" },
  { name: "Paris", country: "FR" },
  { name: "Sydney", country: "AU" },
  { name: "Dubai", country: "AE" },
  { name: "Singapore", country: "SG" },
  { name: "Toronto", country: "CA" },
  { name: "Mumbai", country: "IN" },
  { name: "Seoul", country: "KR" },
  { name: "Mexico City", country: "MX" },
  { name: "Rome", country: "IT" },
  { name: "Beijing", country: "CN" },
  { name: "Nairobi", country: "KE" },
  { name: "Buenos Aires", country: "AR" },
  { name: "Reykjavik", country: "IS" },
  { name: "Bangkok", country: "TH" },
];

const HIGHLIGHT_COUNT = 5;

// Fisher–Yates shuffle, then take the first N — gives an unbiased
// random sample without repeats.
function pickRandomCities(pool, count) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// Turns "St. Petersburg" into "st-petersburg" so it's safe to use
// inside an element id.
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildHighlightSkeleton(cities) {
  const highlightsSection = document.getElementById("highlights");
  highlightsSection.innerHTML = "";

  cities.forEach((city) => {
    const id = slugify(city.name);
    const card = document.createElement("div");
    card.className = "highlight-card";
    card.dataset.cityId = id;
    card.innerHTML = `
      <p class="highlight-card__city">${city.name}</p>
      <img class="highlight-card__icon" id="highlight-${id}-icon" src="" alt="" hidden />
      <p class="highlight-card__temp"><span id="highlight-${id}-temp">—</span>&deg;</p>
      <p class="highlight-card__meta">
        Feels <span id="highlight-${id}-feels">—</span>&deg; · <span id="highlight-${id}-humidity">—</span>%
      </p>
    `;
    highlightsSection.appendChild(card);
  });
}

async function loadHighlights() {
  const cities = pickRandomCities(HIGHLIGHT_CITY_POOL, HIGHLIGHT_COUNT);
  buildHighlightSkeleton(cities);

  const requests = cities.map((city) =>
    getJSON(`${BASE_URL}/weather?q=${encodeURIComponent(city.name)},${city.country}&units=${UNITS}&appid=${API_KEY}`)
  );
  const results = await Promise.allSettled(requests);

  results.forEach((result, index) => {
    const id = slugify(cities[index].name);
    if (result.status === "fulfilled") {
      renderHighlightCard(id, result.value);
    }
    // On failure (e.g. key not active yet), the card just keeps its
    // "—" placeholders rather than showing an error — this is a
    // decorative row, not worth interrupting the page for.
  });
}

function renderHighlightCard(cityId, data) {
  const icon = document.getElementById(`highlight-${cityId}-icon`);
  icon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}.png`;
  icon.alt = data.weather[0].description;
  icon.hidden = false;

  document.getElementById(`highlight-${cityId}-temp`).textContent = Math.round(data.main.temp);
  document.getElementById(`highlight-${cityId}-feels`).textContent = Math.round(data.main.feels_like);
  document.getElementById(`highlight-${cityId}-humidity`).textContent = data.main.humidity;
}

loadHighlights();