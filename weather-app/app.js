/* ============================================
   SkyPulse — Weather App Logic
   Uses Open-Meteo API (free, no key needed)
   Geocoding + Forecast with hourly & daily data
   ============================================ */

(function () {
  'use strict';

  // DOM refs
  const $ = id => document.getElementById(id);
  const searchInput = $('searchInput');
  const searchBtn = $('searchBtn');
  const suggestions = $('suggestions');
  const unitToggle = $('unitToggle');
  const locationBtn = $('locationBtn');
  const loadingState = $('loadingState');
  const errorState = $('errorState');
  const errorMsg = $('errorMsg');
  const welcomeState = $('welcomeState');
  const weatherMain = $('weatherMain');
  const retryBtn = $('retryBtn');

  let useCelsius = true;
  let lastQuery = null;
  let searchTimeout = null;

  // Weather code → emoji + description
  const WMO = {
    0: { icon: '☀️', desc: 'Clear sky' },
    1: { icon: '🌤️', desc: 'Mostly clear' },
    2: { icon: '⛅', desc: 'Partly cloudy' },
    3: { icon: '☁️', desc: 'Overcast' },
    45: { icon: '🌫️', desc: 'Foggy' },
    48: { icon: '🌫️', desc: 'Depositing rime fog' },
    51: { icon: '🌦️', desc: 'Light drizzle' },
    53: { icon: '🌦️', desc: 'Moderate drizzle' },
    55: { icon: '🌧️', desc: 'Dense drizzle' },
    56: { icon: '🌧️', desc: 'Freezing drizzle' },
    57: { icon: '🌧️', desc: 'Heavy freezing drizzle' },
    61: { icon: '🌧️', desc: 'Slight rain' },
    63: { icon: '🌧️', desc: 'Moderate rain' },
    65: { icon: '🌧️', desc: 'Heavy rain' },
    66: { icon: '🌧️', desc: 'Freezing rain' },
    67: { icon: '🌧️', desc: 'Heavy freezing rain' },
    71: { icon: '🌨️', desc: 'Slight snowfall' },
    73: { icon: '🌨️', desc: 'Moderate snowfall' },
    75: { icon: '❄️', desc: 'Heavy snowfall' },
    77: { icon: '❄️', desc: 'Snow grains' },
    80: { icon: '🌦️', desc: 'Light showers' },
    81: { icon: '🌧️', desc: 'Moderate showers' },
    82: { icon: '⛈️', desc: 'Violent showers' },
    85: { icon: '🌨️', desc: 'Light snow showers' },
    86: { icon: '🌨️', desc: 'Heavy snow showers' },
    95: { icon: '⛈️', desc: 'Thunderstorm' },
    96: { icon: '⛈️', desc: 'Thunderstorm with hail' },
    99: { icon: '⛈️', desc: 'Thunderstorm heavy hail' },
  };

  function getWMO(code) {
    return WMO[code] || { icon: '🌤️', desc: 'Unknown' };
  }

  // Night icon override for clear/partly cloudy
  function getIcon(code, isNight) {
    if (isNight && code <= 1) return '🌙';
    if (isNight && code === 2) return '☁️';
    return getWMO(code).icon;
  }

  function tempUnit(c) {
    if (!useCelsius) return Math.round(c * 9 / 5 + 32);
    return Math.round(c);
  }

  function showState(state) {
    [loadingState, errorState, welcomeState, weatherMain].forEach(s => s.classList.add('hidden'));
    state.classList.remove('hidden');
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    showState(errorState);
  }

  // ---- GEOCODING ----
  async function geocode(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    return data.results || [];
  }

  // ---- WEATHER FETCH ----
  async function fetchWeather(lat, lon, cityName, countryName) {
    showState(loadingState);
    lastQuery = { lat, lon, cityName, countryName };

    try {
      const params = [
        `latitude=${lat}`,
        `longitude=${lon}`,
        `current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day`,
        `hourly=temperature_2m,weather_code,precipitation_probability,is_day`,
        `daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max`,
        `timezone=auto`,
        `forecast_days=7`
      ].join('&');

      const url = `https://api.open-meteo.com/v1/forecast?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather API error');
      const data = await res.json();

      renderWeather(data, cityName, countryName);
      showState(weatherMain);
      updateBackground(data.current.weather_code, data.current.is_day);
    } catch (err) {
      console.error(err);
      showError('Failed to fetch weather. Please try again.');
    }
  }

  // ---- RENDER ----
  function renderWeather(data, city, country) {
    const c = data.current;
    const isNight = !c.is_day;

    $('cityName').textContent = city;
    $('countryName').textContent = country;
    $('currentDateTime').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    $('currentIcon').textContent = getIcon(c.weather_code, isNight);
    $('currentTemp').textContent = tempUnit(c.temperature_2m) + '°';
    $('currentDesc').textContent = getWMO(c.weather_code).desc;
    $('feelsLike').textContent = tempUnit(c.apparent_temperature) + '°';

    // Daily temp range
    $('tempHigh').textContent = tempUnit(data.daily.temperature_2m_max[0]);
    $('tempLow').textContent = tempUnit(data.daily.temperature_2m_min[0]);
    $('humidity').textContent = c.relative_humidity_2m;
    $('windSpeed').textContent = Math.round(c.wind_speed_10m);
    $('visibility').textContent = '10'; // Open-Meteo doesn't provide visibility, default
    $('pressure').textContent = Math.round(c.surface_pressure);

    // Sunrise / sunset
    const sr = new Date(data.daily.sunrise[0]);
    const ss = new Date(data.daily.sunset[0]);
    $('sunrise').textContent = sr.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    $('sunset').textContent = ss.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Hourly
    renderHourly(data.hourly);

    // Daily
    renderDaily(data.daily);

    // UV
    const uv = data.daily.uv_index_max[0];
    $('uvValue').textContent = uv.toFixed(1);
    $('uvLabel').textContent = uvLabel(uv);
    $('uvFill').style.width = Math.min(uv / 11 * 100, 100) + '%';

    // Wind
    $('windSpeedBig').textContent = Math.round(c.wind_speed_10m);
    $('windArrow').style.transform = `translate(-50%, -100%) rotate(${c.wind_direction_10m}deg)`;
    $('windDir').textContent = windDirection(c.wind_direction_10m);

    // Humidity arc
    const humidPct = c.relative_humidity_2m / 100;
    const dashoffset = 264 - (264 * humidPct);
    $('humidArc').style.strokeDashoffset = dashoffset;
    $('humidValue').textContent = c.relative_humidity_2m + '%';
    $('dewPoint').textContent = tempUnit(c.temperature_2m - ((100 - c.relative_humidity_2m) / 5));
  }

  function renderHourly(hourly) {
    const container = $('hourlyScroll');
    container.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    let startIdx = 0;
    // Find current hour in forecast
    for (let i = 0; i < hourly.time.length; i++) {
      const h = new Date(hourly.time[i]);
      if (h >= now) { startIdx = Math.max(0, i - 1); break; }
    }

    for (let i = startIdx; i < Math.min(startIdx + 24, hourly.time.length); i++) {
      const t = new Date(hourly.time[i]);
      const isNow = i === startIdx;
      const isNight = !hourly.is_day[i];
      const card = document.createElement('div');
      card.className = 'hourly-card' + (isNow ? ' now' : '');
      card.innerHTML = `
        <div class="hourly-time">${isNow ? 'Now' : t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</div>
        <span class="hourly-icon">${getIcon(hourly.weather_code[i], isNight)}</span>
        <div class="hourly-temp">${tempUnit(hourly.temperature_2m[i])}°</div>
        ${hourly.precipitation_probability[i] > 0 ? `<div class="hourly-rain">💧${hourly.precipitation_probability[i]}%</div>` : ''}
      `;
      container.appendChild(card);
    }
  }

  function renderDaily(daily) {
    const container = $('dailyGrid');
    container.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < daily.time.length; i++) {
      const d = new Date(daily.time[i]);
      const dayName = i === 0 ? 'Today' : days[d.getDay()];
      const row = document.createElement('div');
      row.className = 'daily-row';
      row.innerHTML = `
        <div class="daily-day">${dayName}</div>
        <div class="daily-icon">${getWMO(daily.weather_code[i]).icon}</div>
        <div class="daily-desc">${getWMO(daily.weather_code[i]).desc}${daily.precipitation_probability_max[i] > 20 ? ` · 💧${daily.precipitation_probability_max[i]}%` : ''}</div>
        <div class="daily-temps">${tempUnit(daily.temperature_2m_max[i])}° <span class="daily-low">${tempUnit(daily.temperature_2m_min[i])}°</span></div>
      `;
      container.appendChild(row);
    }
  }

  function uvLabel(uv) {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Moderate';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'Very High';
    return 'Extreme';
  }

  function windDirection(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function updateBackground(code, isDay) {
    const bg = $('appBg');
    if (!isDay) {
      bg.style.background = 'linear-gradient(180deg, #0b0e18 0%, #0d1225 100%)';
    } else if (code >= 61 && code <= 67 || code >= 80 && code <= 82 || code >= 95) {
      bg.style.background = 'linear-gradient(180deg, #0f1928 0%, #162236 100%)';
    } else if (code >= 3 && code <= 48) {
      bg.style.background = 'linear-gradient(180deg, #0b0e18 0%, #1a1d2e 100%)';
    }
  }

  // ---- SEARCH ----
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 2) { suggestions.classList.remove('show'); return; }
    searchTimeout = setTimeout(async () => {
      try {
        const results = await geocode(q);
        if (results.length === 0) { suggestions.classList.remove('show'); return; }
        suggestions.innerHTML = results.map((r, i) =>
          `<div class="suggestion-item" data-idx="${i}">
            <span class="sug-flag">${countryFlag(r.country_code)}</span>
            ${r.name}, ${r.admin1 || ''} ${r.country || ''}
          </div>`
        ).join('');
        suggestions._results = results;
        suggestions.classList.add('show');
      } catch (e) { suggestions.classList.remove('show'); }
    }, 350);
  });

  suggestions.addEventListener('click', e => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    const r = suggestions._results[parseInt(item.dataset.idx)];
    searchInput.value = r.name;
    suggestions.classList.remove('show');
    fetchWeather(r.latitude, r.longitude, r.name, r.country || '');
  });

  searchBtn.addEventListener('click', search);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

  async function search() {
    const q = searchInput.value.trim();
    if (!q) return;
    suggestions.classList.remove('show');
    try {
      const results = await geocode(q);
      if (results.length === 0) { showError(`No results for "${q}"`); return; }
      const r = results[0];
      fetchWeather(r.latitude, r.longitude, r.name, r.country || '');
    } catch (e) {
      showError('Search failed. Check connection.');
    }
  }

  // Location
  locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { showError('Geolocation not supported'); return; }
    showState(loadingState);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=&count=1&language=en&format=json`);
          fetchWeather(latitude, longitude, 'My Location', '');
        } catch (e) {
          fetchWeather(latitude, longitude, 'My Location', '');
        }
      },
      err => { showError('Location access denied.'); }
    );
  });

  // Unit toggle
  unitToggle.addEventListener('click', () => {
    useCelsius = !useCelsius;
    document.querySelector('.unit-c').classList.toggle('active', useCelsius);
    document.querySelector('.unit-f').classList.toggle('active', !useCelsius);
    if (lastQuery) fetchWeather(lastQuery.lat, lastQuery.lon, lastQuery.cityName, lastQuery.countryName);
  });

  // Retry
  retryBtn.addEventListener('click', () => {
    if (lastQuery) fetchWeather(lastQuery.lat, lastQuery.lon, lastQuery.cityName, lastQuery.countryName);
    else showState(welcomeState);
  });

  // Quick cities
  document.querySelectorAll('.quick-city').forEach(btn => {
    btn.addEventListener('click', async () => {
      const city = btn.dataset.city;
      searchInput.value = city;
      try {
        const results = await geocode(city);
        if (results.length > 0) {
          const r = results[0];
          fetchWeather(r.latitude, r.longitude, r.name, r.country || '');
        }
      } catch (e) { showError('Failed to search city.'); }
    });
  });

  // Close suggestions on click outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) suggestions.classList.remove('show');
  });

  // Country flag emoji
  function countryFlag(code) {
    if (!code) return '🌍';
    return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
  }

})();
