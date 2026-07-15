import { state } from '../state.js';
import { api } from '../api.js';
import { fetchWeather, fetchWeatherLocations, fetchSidebarWeather } from '../app.js';

export function renderWeatherLocationsDropdown() {
  const weatherLocationSelector = document.getElementById('weatherLocationSelector');
  const deleteWeatherLocationBtn = document.getElementById('deleteWeatherLocationBtn');
  const setHomeWeatherLocationBtn = document.getElementById('setHomeWeatherLocationBtn');
  if (!weatherLocationSelector) return;

  weatherLocationSelector.innerHTML = '';
  state.weatherLocations.forEach((loc) => {
    const option = document.createElement('option');
    option.value = loc.id;
    option.textContent = loc.name;
    weatherLocationSelector.appendChild(option);
  });

  if (state.activeWeatherLocationId) {
    weatherLocationSelector.value = state.activeWeatherLocationId;
  } else {
    weatherLocationSelector.value = '';
  }

  if (deleteWeatherLocationBtn) {
    deleteWeatherLocationBtn.disabled = !state.activeWeatherLocationId;
  }

  if (setHomeWeatherLocationBtn) {
    const activeLoc = state.weatherLocations.find((l) => l.id === state.activeWeatherLocationId);
    if (activeLoc && activeLoc.is_home === 1) {
      setHomeWeatherLocationBtn.classList.remove('btn-secondary');
      setHomeWeatherLocationBtn.classList.add('btn-primary');
      setHomeWeatherLocationBtn.title = 'Current Home Location';
    } else {
      setHomeWeatherLocationBtn.classList.remove('btn-primary');
      setHomeWeatherLocationBtn.classList.add('btn-secondary');
      setHomeWeatherLocationBtn.title = 'Set as Home Location';
    }
    setHomeWeatherLocationBtn.disabled = !state.activeWeatherLocationId;
  }
}

export function initWeatherPageControls() {
  const weatherLocationSelector = document.getElementById('weatherLocationSelector');
  const addWeatherLocationBtn = document.getElementById('addWeatherLocationBtn');
  const deleteWeatherLocationBtn = document.getElementById('deleteWeatherLocationBtn');
  const setHomeWeatherLocationBtn = document.getElementById('setHomeWeatherLocationBtn');
  const weatherLocationModal = document.getElementById('weatherLocationModal');
  const weatherLocationForm = document.getElementById('weatherLocationForm');
  const newWeatherLocationName = document.getElementById('newWeatherLocationName');
  const closeWeatherLocationModalBtn = document.getElementById('closeWeatherLocationModalBtn');
  const cancelWeatherLocationModalBtn = document.getElementById('cancelWeatherLocationModalBtn');

  if (weatherLocationSelector) {
    weatherLocationSelector.addEventListener('change', (e) => {
      state.activeWeatherLocationId = e.target.value ? parseInt(e.target.value) : null;
      fetchWeather();
      if (deleteWeatherLocationBtn) {
        deleteWeatherLocationBtn.disabled = !state.activeWeatherLocationId;
      }
      if (setHomeWeatherLocationBtn) {
        const activeLoc = state.weatherLocations.find((l) => l.id === state.activeWeatherLocationId);
        if (activeLoc && activeLoc.is_home === 1) {
          setHomeWeatherLocationBtn.classList.remove('btn-secondary');
          setHomeWeatherLocationBtn.classList.add('btn-primary');
        } else {
          setHomeWeatherLocationBtn.classList.remove('btn-primary');
          setHomeWeatherLocationBtn.classList.add('btn-secondary');
        }
        setHomeWeatherLocationBtn.disabled = !state.activeWeatherLocationId;
      }
    });
  }

  if (addWeatherLocationBtn) {
    addWeatherLocationBtn.addEventListener('click', () => {
      if (newWeatherLocationName) newWeatherLocationName.value = '';
      if (weatherLocationModal) weatherLocationModal.showModal();
    });
  }

  if (closeWeatherLocationModalBtn) {
    closeWeatherLocationModalBtn.addEventListener('click', () => {
      if (weatherLocationModal) weatherLocationModal.close();
    });
  }

  if (cancelWeatherLocationModalBtn) {
    cancelWeatherLocationModalBtn.addEventListener('click', () => {
      if (weatherLocationModal) weatherLocationModal.close();
    });
  }

  if (weatherLocationForm) {
    weatherLocationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newWeatherLocationName ? newWeatherLocationName.value.trim() : '';
      if (!name) return;

      try {
        const newLoc = await api.saveWeatherLocation({ name });
        if (weatherLocationModal) weatherLocationModal.close();

        state.activeWeatherLocationId = newLoc.id;
        await fetchWeatherLocations();
        fetchWeather();
      } catch (err) {
        alert(err.message || 'Failed to add weather location.');
      }
    });
  }

  if (deleteWeatherLocationBtn) {
    deleteWeatherLocationBtn.addEventListener('click', async () => {
      if (!state.activeWeatherLocationId) return;
      const activeLoc = state.weatherLocations.find((l) => l.id === state.activeWeatherLocationId);
      const locName = activeLoc ? activeLoc.name : 'this location';

      if (confirm(`Are you sure you want to delete the weather location "${locName}"?`)) {
        try {
          await api.deleteWeatherLocation(state.activeWeatherLocationId);
          state.activeWeatherLocationId = null;
          await fetchWeatherLocations();
          fetchWeather();
          await fetchSidebarWeather();
        } catch (err) {
          alert(err.message || 'Failed to delete weather location.');
        }
      }
    });
  }

  if (setHomeWeatherLocationBtn) {
    setHomeWeatherLocationBtn.addEventListener('click', async () => {
      if (!state.activeWeatherLocationId) return;
      try {
        await api.setHomeWeatherLocation(state.activeWeatherLocationId);
        await fetchWeatherLocations();
        await fetchSidebarWeather();
      } catch (err) {
        alert(err.message || 'Failed to set home weather location.');
      }
    });
  }
}

export function renderWeatherDashboard(data) {
  const weatherDashboard = document.getElementById('weatherDashboard');
  const weatherUnconfiguredState = document.getElementById('weatherUnconfiguredState');
  const weatherLocationName = document.getElementById('weatherLocationName');
  const weatherUpdateTime = document.getElementById('weatherUpdateTime');
  const weatherTemp = document.getElementById('weatherTemp');
  const weatherIcon = document.getElementById('weatherIcon');
  const weatherDesc = document.getElementById('weatherDesc');
  const weatherFeelsLike = document.getElementById('weatherFeelsLike');
  const weatherWind = document.getElementById('weatherWind');
  const weatherHumidity = document.getElementById('weatherHumidity');
  const weatherSunCycle = document.getElementById('weatherSunCycle');
  const weatherClouds = document.getElementById('weatherClouds');
  const weatherPressure = document.getElementById('weatherPressure');
  const weatherHourlyTimeline = document.getElementById('weatherHourlyTimeline');
  const weatherForecastGrid = document.getElementById('weatherForecastGrid');

  if (!weatherDashboard || !weatherUnconfiguredState) return;

  if (data.configured) {
    const tempVal = Math.round(data.current.main.temp);
    const descVal = data.current.weather[0].description;
    const iconCode = data.current.weather[0].icon;
    const emoji = getWeatherEmoji(iconCode);
    const timezoneOffset = data.current.timezone || 0;

    if (weatherLocationName) weatherLocationName.textContent = data.current.name;
    if (weatherUpdateTime) {
      const timeStr = formatOffsetTime(data.current.dt, timezoneOffset);
      weatherUpdateTime.textContent = `Local Time: ${timeStr} • ${data.current.weather[0].main}`;
    }

    if (weatherTemp) weatherTemp.textContent = tempVal;
    if (weatherIcon) weatherIcon.textContent = emoji;
    if (weatherDesc) weatherDesc.textContent = descVal;

    if (weatherFeelsLike) {
      const feels = Math.round(data.current.main.feels_like);
      let comfort = 'Similar to actual';
      if (feels > tempVal + 1) comfort = 'Warmer than actual';
      else if (feels < tempVal - 1) comfort = 'Cooler than actual';
      weatherFeelsLike.innerHTML = `${feels}°C <span class="detail-sub">${comfort}</span>`;
    }
    if (weatherWind) {
      const speed = Math.round(data.current.wind.speed * 3.6);
      const dir = getWindDirection(data.current.wind.deg || 0);
      let speedText = `${speed} km/h`;
      if (data.current.wind.gust) {
        speedText += ` (Gust: ${Math.round(data.current.wind.gust * 3.6)})`;
      }
      weatherWind.innerHTML = `${speedText} <span class="detail-sub">${dir} direction</span>`;
    }
    if (weatherHumidity) {
      const hum = data.current.main.humidity;
      let humComfort = 'Dry';
      if (hum > 60) humComfort = 'Sticky/Humid';
      else if (hum >= 30) humComfort = 'Comfortable';
      weatherHumidity.innerHTML = `${hum}% <span class="detail-sub">${humComfort}</span>`;
    }
    if (weatherSunCycle) {
      const sunriseStr = formatOffsetTime(data.current.sys.sunrise, timezoneOffset);
      const sunsetStr = formatOffsetTime(data.current.sys.sunset, timezoneOffset);
      weatherSunCycle.innerHTML = `🌅 ${sunriseStr} <span class="detail-sub">🌇 Sunset: ${sunsetStr}</span>`;
    }
    if (weatherClouds) {
      const clouds = data.current.clouds.all;
      const vis = data.current.visibility ? Math.round(data.current.visibility / 1000) : 10;
      weatherClouds.innerHTML = `${clouds}% <span class="detail-sub">👁️ Vis: ${vis} km</span>`;
    }
    if (weatherPressure) {
      weatherPressure.innerHTML = `${data.current.main.pressure} hPa <span class="detail-sub">Standard sea level</span>`;
    }

    if (weatherHourlyTimeline) {
      weatherHourlyTimeline.innerHTML = '';
      const hourlyList = data.forecast.list.slice(0, 8);
      hourlyList.forEach((item) => {
        const localHour = formatOffsetTime(item.dt, timezoneOffset);
        const hourPart = localHour.split(':')[0] + ' ' + localHour.split(' ')[1];
        const hourlyEmoji = getWeatherEmoji(item.weather[0].icon);
        const hourlyTempText = `${Math.round(item.main.temp)}°`;
        const rainPop = item.pop ? Math.round(item.pop * 100) : 0;

        const itemEl = document.createElement('div');
        itemEl.className = 'hourly-item';
        itemEl.innerHTML = `
          <span class="hourly-time">${hourPart}</span>
          <span class="hourly-icon">${hourlyEmoji}</span>
          <span class="hourly-temp">${hourlyTempText}</span>
          ${rainPop > 0 ? `<span class="hourly-pop">💧 ${rainPop}%</span>` : ''}
        `;
        weatherHourlyTimeline.appendChild(itemEl);
      });
    }

    if (weatherForecastGrid) {
      weatherForecastGrid.innerHTML = '';
      const list = data.forecast.list;

      const dayGroups = {};
      list.forEach((item) => {
        const date = new Date(item.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        if (!dayGroups[dayName]) {
          dayGroups[dayName] = [];
        }
        dayGroups[dayName].push(item);
      });

      const days = Object.keys(dayGroups).slice(0, 5);
      days.forEach((day) => {
        const dayItems = dayGroups[day];
        let maxTemp = -Infinity;
        let minTemp = Infinity;
        let icon = '01d';

        dayItems.forEach((item) => {
          if (item.main.temp_max > maxTemp) maxTemp = item.main.temp_max;
          if (item.main.temp_min < minTemp) minTemp = item.main.temp_min;
          const hour = new Date(item.dt * 1000).getHours();
          if (hour >= 11 && hour <= 15) {
            icon = item.weather[0].icon;
          }
        });

        const forecastEmoji = getWeatherEmoji(icon);
        const itemEl = document.createElement('div');
        itemEl.className = 'forecast-item';
        itemEl.innerHTML = `
          <span class="forecast-day">${day}</span>
          <span class="forecast-icon">${forecastEmoji}</span>
          <div class="forecast-temp">
            <span class="forecast-temp-max">${Math.round(maxTemp)}°</span>
            <span class="forecast-temp-min">${Math.round(minTemp)}°</span>
          </div>
        `;
        weatherForecastGrid.appendChild(itemEl);
      });
    }

    weatherDashboard.classList.remove('hidden');
    weatherUnconfiguredState.classList.add('hidden');
  } else {
    weatherDashboard.classList.add('hidden');
    weatherUnconfiguredState.classList.remove('hidden');
  }
}

export function renderWeatherError(message) {
  const weatherDashboard = document.getElementById('weatherDashboard');
  const weatherUnconfiguredState = document.getElementById('weatherUnconfiguredState');
  if (!weatherDashboard || !weatherUnconfiguredState) return;

  weatherDashboard.classList.add('hidden');
  weatherUnconfiguredState.innerHTML = `
    <div class="empty-icon">⚠️</div>
    <h3 class="empty-title">Weather API Error</h3>
    <p class="empty-text">${message || 'Please check your API key, location city name, or internet connection.'}</p>
    <button id="goToWeatherSettingsBtn" class="btn btn-primary" style="margin-top: 16px;">Configure Settings</button>
  `;
  weatherUnconfiguredState.classList.remove('hidden');

  const goToWeatherSettingsBtn = document.getElementById('goToWeatherSettingsBtn');
  if (goToWeatherSettingsBtn) {
    goToWeatherSettingsBtn.addEventListener('click', () => {
      history.pushState(null, '', '#settings');
      const navItem = document.getElementById('navSettings');
      if (navItem) navItem.click();
    });
  }
}

// Weather helpers
export function getWeatherEmoji(iconCode) {
  const mapping = {
    '01d': '☀️',
    '01n': '🌙',
    '02d': '⛅',
    '02n': '☁️',
    '03d': '☁️',
    '03n': '☁️',
    '04d': '☁️',
    '04n': '☁️',
    '09d': '🌧️',
    '09n': '🌧️',
    '10d': '🌦️',
    '10n': '🌧️',
    '11d': '⛈️',
    '11n': '⛈️',
    '13d': '❄️',
    '13n': '❄️',
    '50d': '🌫️',
    '50n': '🌫️'
  };
  return mapping[iconCode] || '🌤️';
}

function getWindDirection(deg) {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW'
  ];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

function formatOffsetTime(epoch, timezoneOffsetSeconds) {
  const date = new Date((epoch + timezoneOffsetSeconds) * 1000);
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const ampm = utcHours >= 12 ? 'PM' : 'AM';
  const displayHours = utcHours % 12 || 12;
  const displayMinutes = utcMinutes < 10 ? '0' + utcMinutes : utcMinutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}
