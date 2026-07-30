"use strict";

const API_KEY = "6b66bf5ee7db79399c1faa2969b57c9e";
const API_URL = "https://api.openweathermap.org/data/2.5/weather";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";
const IP_GEO_URL = "https://ipwho.is/";
const REFRESH_INTERVAL = 12 * 60 * 1000;
const languageNames = { zh_cn: "中文", en: "English", es: "Español", fr: "Français", ja: "日本語" };
const placeNameFallbacks = {
  zh_cn: { Taiwan: "台湾" },
  ja: { Taiwan: "台湾" }
};

const translations = {
  zh_cn: { searchLabel: "搜索城市", searchPlaceholder: "搜索城市或国家…", searchButton: "搜索", useLocation: "使用我的位置", languageLabel: "语言", soundOn: "开启天气白噪音", soundOff: "关闭天气白噪音", enterFullscreen: "进入全屏", exitFullscreen: "退出全屏", lastUpdated: "最后更新", feelsLike: "体感", humidity: "湿度", wind: "风速", poweredBy: "天气数据来自 OpenWeather，Designed By BestGuo2020", loading: "正在获取天气…", locating: "正在获取你的位置…", notFound: "未找到这个地点，请检查拼写。", apiError: "天气服务暂时不可用，请稍后重试。", locationDenied: "无法获取位置，请允许定位权限或手动搜索。", clear: "晴", clouds: "多云", rain: "雨", drizzle: "细雨", thunderstorm: "雷暴", snow: "雪", atmosphere: "雾霾" },
  en: { searchLabel: "Search for a city", searchPlaceholder: "Search city or country…", searchButton: "Search", useLocation: "Use my location", languageLabel: "Language", soundOn: "Play weather noise", soundOff: "Mute weather noise", enterFullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen", lastUpdated: "Last updated", feelsLike: "Feels", humidity: "Humidity", wind: "Wind", poweredBy: "Weather data by OpenWeather，Designed By BestGuo2020", loading: "Fetching weather…", locating: "Finding your location…", notFound: "Place not found. Check the spelling.", apiError: "Weather service is unavailable. Try again later.", locationDenied: "Location unavailable. Allow access or search manually.", clear: "Clear", clouds: "Cloudy", rain: "Rain", drizzle: "Drizzle", thunderstorm: "Thunderstorm", snow: "Snow", atmosphere: "Mist" },
  es: { searchLabel: "Buscar ciudad", searchPlaceholder: "Buscar ciudad o país…", searchButton: "Buscar", useLocation: "Usar mi ubicación", languageLabel: "Idioma", soundOn: "Activar ruido del clima", soundOff: "Silenciar ruido del clima", enterFullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa", lastUpdated: "Última actualización", feelsLike: "Sensación", humidity: "Humedad", wind: "Viento", poweredBy: "Datos meteorológicos de OpenWeather，Designed By BestGuo2020", loading: "Consultando el tiempo…", locating: "Buscando tu ubicación…", notFound: "No encontramos ese lugar.", apiError: "El servicio no está disponible.", locationDenied: "No se pudo obtener la ubicación.", clear: "Despejado", clouds: "Nublado", rain: "Lluvia", drizzle: "Llovizna", thunderstorm: "Tormenta", snow: "Nieve", atmosphere: "Niebla" },
  fr: { searchLabel: "Rechercher une ville", searchPlaceholder: "Ville ou pays…", searchButton: "Rechercher", useLocation: "Utiliser ma position", languageLabel: "Langue", soundOn: "Activer le bruit météo", soundOff: "Couper le bruit météo", enterFullscreen: "Plein écran", exitFullscreen: "Quitter le plein écran", lastUpdated: "Dernière mise à jour", feelsLike: "Ressenti", humidity: "Humidité", wind: "Vent", poweredBy: "Données météo par OpenWeather，Designed By BestGuo2020", loading: "Chargement de la météo…", locating: "Recherche de votre position…", notFound: "Lieu introuvable.", apiError: "Service météo indisponible.", locationDenied: "Position indisponible.", clear: "Ciel dégagé", clouds: "Nuageux", rain: "Pluie", drizzle: "Bruine", thunderstorm: "Orage", snow: "Neige", atmosphere: "Brume" },
  ja: { searchLabel: "都市を検索", searchPlaceholder: "都市または国を検索…", searchButton: "検索", useLocation: "現在地を使う", languageLabel: "言語", soundOn: "天気の環境音を再生", soundOff: "環境音を停止", enterFullscreen: "全画面表示", exitFullscreen: "全画面表示を終了", lastUpdated: "最終更新", feelsLike: "体感", humidity: "湿度", wind: "風速", poweredBy: "気象データ：OpenWeather，Designed By BestGuo2020", loading: "天気を取得中…", locating: "現在地を取得中…", notFound: "場所が見つかりません。", apiError: "気象サービスを利用できません。", locationDenied: "位置情報を取得できません。", clear: "晴れ", clouds: "曇り", rain: "雨", drizzle: "霧雨", thunderstorm: "雷雨", snow: "雪", atmosphere: "霧" }
};

const localeMap = { zh_cn: "zh-CN", en: "en-GB", es: "es-ES", fr: "fr-FR", ja: "ja-JP" };
const state = { lang: localStorage.getItem("weather-language") || "zh_cn", lastQuery: { q: "Northampton,GB" }, data: null, sound: false, placeName: "", updatedAt: null, refreshTimer: null };
const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $(".search-form"), input: $("#city-search"), locate: $("#location-button"), languageButton: $("#language-button"),
  languageMenu: $("#language-menu"), languageCurrent: $("#language-current"), fullscreen: $("#fullscreen-button"),
  sound: $("#sound-button"), city: $("#city"), date: $("#date"), temp: $("#temp"), weather: $("#weather"),
  hiLow: $("#hi-low"), feels: $("#feels-like"), humidity: $("#humidity"), wind: $("#wind"),
  icon: $("#weather-icon"), status: $("#status"), updated: $("#updated-time")
};

function t(key) { return translations[state.lang][key] || translations.en[key] || key; }

function applyLanguage() {
  const locale = localeMap[state.lang];
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });
  elements.languageCurrent.textContent = languageNames[state.lang];
  elements.languageMenu.querySelectorAll("[data-lang]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.lang === state.lang));
  });
  updateSoundLabel();
  updateFullscreenLabel();
  if (state.data) renderWeather(state.data);
  else updateDate();
}

function weatherType(id) {
  if (id >= 200 && id < 300) return "thunderstorm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "atmosphere";
  if (id === 800) return "clear";
  return "clouds";
}

function weatherIntensity(id) {
  if ([300, 310, 500, 520, 600, 612, 615, 620].includes(id)) return "light";
  if ([302, 312, 314, 502, 503, 504, 522, 602, 622].includes(id)) return "heavy";
  return "moderate";
}

function populateRain(intensity) {
  const scene = $(".scene-rain");
  if (scene.dataset.intensity === intensity) return;
  scene.dataset.intensity = intensity;
  const totals = { light: 36, moderate: 56, heavy: 82 };
  const layers = [
    { selector: ".rain-far", share: .25, size: .45, duration: 1.75, opacity: .55 },
    { selector: ".rain-mid", share: .34, size: .66, duration: 1.35, opacity: .78 },
    { selector: ".rain-near", share: .41, size: .9, duration: 1.05, opacity: 1 }
  ];
  layers.forEach((config) => {
    const layer = $(config.selector);
    layer.replaceChildren();
    const count = Math.round(totals[intensity] * config.share);
    for (let index = 0; index < count; index += 1) {
      const drop = document.createElement("span");
      const duration = config.duration * (.82 + Math.random() * .36);
      const size = config.size * (.68 + Math.random() * .64);
      drop.className = "rain-drop";
      drop.style.setProperty("--drop-x", `${Math.random() * 112 - 6}%`);
      drop.style.setProperty("--drop-y", `${Math.random() * 115 - 18}%`);
      drop.style.setProperty("--drop-size", `${size.toFixed(2)}rem`);
      drop.style.setProperty("--drop-duration", `${duration.toFixed(2)}s`);
      drop.style.setProperty("--drop-delay", `${(-Math.random() * duration).toFixed(2)}s`);
      drop.style.setProperty("--drop-opacity", `${(config.opacity * (.72 + Math.random() * .28)).toFixed(2)}`);
      layer.append(drop);
    }
  });
}

function updateDate(timestamp = Date.now() / 1000, timezone = 0) {
  const utcMs = (timestamp + timezone) * 1000;
  elements.date.textContent = new Intl.DateTimeFormat(localeMap[state.lang], {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
  }).format(new Date(utcMs));
}

function renderWeather(data) {
  const type = weatherType(data.weather[0].id);
  const intensity = weatherIntensity(data.weather[0].id);
  const isNight = data.weather[0].icon.endsWith("n");
  document.body.dataset.weather = type === "drizzle" ? "rain" : type;
  document.body.dataset.period = isNight ? "night" : "day";
  document.body.dataset.intensity = intensity;
  elements.icon.className = `weather-icon icon-${type} intensity-${intensity}`;
  if (type === "rain" || type === "drizzle" || type === "thunderstorm") populateRain(intensity);
  const fallbackName = placeNameFallbacks[state.lang]?.[data.name];
  elements.city.textContent = `${state.placeName || fallbackName || data.name}, ${data.sys.country}`;
  updateDate(data.dt, data.timezone);
  elements.temp.innerHTML = `${Math.round(data.main.temp)}<span>°c</span>`;
  elements.weather.textContent = data.weather[0].description || t(type);
  elements.hiLow.textContent = `${Math.round(data.main.temp_min)}°c / ${Math.round(data.main.temp_max)}°c`;
  elements.feels.textContent = `${Math.round(data.main.feels_like)}°c`;
  elements.humidity.textContent = `${data.main.humidity}%`;
  elements.wind.textContent = `${Math.round(data.wind.speed * 10) / 10} m/s`;
  elements.status.textContent = "";
  const updatedAt = state.updatedAt || new Date();
  elements.updated.dateTime = updatedAt.toISOString();
  elements.updated.textContent = new Intl.DateTimeFormat(localeMap[state.lang], { hour: "2-digit", minute: "2-digit" }).format(updatedAt);
  document.title = `${Math.round(data.main.temp)}° · ${data.name}`;
  if (state.sound) restartWeatherSound(type);
}

async function getLocalizedPlace(params, signal) {
  try {
    const endpoint = params.q ? "direct" : "reverse";
    const query = new URLSearchParams({ ...params, limit: "1", appid: API_KEY });
    const response = await fetch(`${GEO_URL}/${endpoint}?${query}`, { signal });
    if (!response.ok) return null;
    const places = await response.json();
    const place = places[0];
    if (!place) return null;
    const localizedName = place.local_names?.[state.lang] || place.local_names?.[localeMap[state.lang].split("-")[0]];
    return {
      lat: place.lat,
      lon: place.lon,
      name: localizedName || placeNameFallbacks[state.lang]?.[place.name] || place.name
    };
  } catch {
    return null;
  }
}

async function getWeather(params) {
  elements.status.textContent = t("loading");
  elements.input.disabled = true;
  elements.locate.disabled = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const place = await getLocalizedPlace(params, controller.signal);
    const weatherParams = place ? { lat: place.lat, lon: place.lon } : params;
    state.placeName = place?.name || "";
    const query = new URLSearchParams({ ...weatherParams, appid: API_KEY, units: "metric", lang: state.lang });
    const response = await fetch(`${API_URL}?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 404 ? "notFound" : "apiError");
    state.data = await response.json();
    state.lastQuery = params;
    state.updatedAt = new Date();
    renderWeather(state.data);
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => getWeather(state.lastQuery), REFRESH_INTERVAL);
    elements.input.value = "";
  } catch (error) {
    elements.status.textContent = t(error.message === "notFound" ? "notFound" : "apiError");
  } finally {
    window.clearTimeout(timeout);
    elements.input.disabled = false;
    elements.locate.disabled = false;
  }
}

async function getIpCoordinates() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(IP_GEO_URL, { signal: controller.signal });
    if (!response.ok) throw new Error("ipLocationFailed");
    const data = await response.json();
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (data.success === false || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("ipLocationFailed");
    }
    return { lat: latitude.toFixed(5), lon: longitude.toFixed(5) };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function locateByIp(fallbackToDefault) {
  elements.status.textContent = t("locating");
  try {
    const coordinates = await getIpCoordinates();
    await getWeather(coordinates);
  } catch {
    if (fallbackToDefault) await getWeather(state.lastQuery);
    else elements.status.textContent = t("locationDenied");
  }
}

function useLocation(options = {}) {
  const fallbackToDefault = options.fallbackToDefault === true;
  const handleFailure = () => locateByIp(fallbackToDefault);
  if (!navigator.geolocation) { locateByIp(fallbackToDefault); return; }
  elements.status.textContent = t("locating");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => getWeather({ lat: coords.latitude.toFixed(5), lon: coords.longitude.toFixed(5) }),
    handleFailure,
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

let audio = null;
function buildNoise(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const context = new AudioContext();
  const seconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = type === "snow" || type === "atmosphere" ? last * .98 + white * .02 : white;
    channel[i] = last * .34;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = type === "thunderstorm" ? "lowpass" : "bandpass";
  filter.frequency.value = type === "rain" || type === "drizzle" ? 1450 : type === "clear" ? 520 : 760;
  filter.Q.value = .55;
  gain.gain.value = type === "thunderstorm" ? .13 : .075;
  source.buffer = buffer; source.loop = true;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
  return { context, source };
}

function restartWeatherSound(type) {
  if (audio) { audio.source.stop(); audio.context.close(); }
  audio = buildNoise(type);
}

function updateSoundLabel() {
  const key = state.sound ? "soundOff" : "soundOn";
  elements.sound.title = t(key);
  elements.sound.setAttribute("aria-label", t(key));
  elements.sound.setAttribute("aria-pressed", String(state.sound));
}

function setLanguageMenu(open) {
  elements.languageButton.setAttribute("aria-expanded", String(open));
  elements.languageMenu.hidden = !open;
}

function updateFullscreenLabel() {
  const key = document.fullscreenElement ? "exitFullscreen" : "enterFullscreen";
  elements.fullscreen.title = t(key);
  elements.fullscreen.setAttribute("aria-label", t(key));
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  setLanguageMenu(false);
  const q = elements.input.value.trim();
  if (q) getWeather({ q });
});
elements.locate.addEventListener("click", () => useLocation());
elements.languageButton.addEventListener("click", () => {
  setLanguageMenu(elements.languageButton.getAttribute("aria-expanded") !== "true");
});
elements.languageMenu.addEventListener("click", (event) => {
  const option = event.target.closest("[data-lang]");
  if (!option) return;
  state.lang = option.dataset.lang;
  localStorage.setItem("weather-language", state.lang);
  setLanguageMenu(false);
  applyLanguage();
  getWeather(state.lastQuery);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".language-control")) setLanguageMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setLanguageMenu(false);
});
elements.sound.addEventListener("click", () => {
  state.sound = !state.sound;
  if (state.sound) restartWeatherSound(state.data ? weatherType(state.data.weather[0].id) : "clear");
  else if (audio) { audio.source.stop(); audio.context.close(); audio = null; }
  updateSoundLabel();
});
elements.fullscreen.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenLabel);

applyLanguage();
useLocation({ fallbackToDefault: true });
