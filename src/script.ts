"use strict";

const API_KEY = "6b66bf5ee7db79399c1faa2969b57c9e";
const API_URL = "https://api.openweathermap.org/data/2.5/weather";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";
const OPEN_METEO_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const IP_GEO_PROVIDERS = [
  {
    url: "https://ipwho.is/",
    parse: (data) => ({ success: data.success !== false, latitude: data.latitude, longitude: data.longitude })
  },
  {
    url: "https://ipapi.co/json/",
    parse: (data) => ({ success: !data.error, latitude: data.latitude, longitude: data.longitude })
  }
];
const REFRESH_INTERVAL = 12 * 60 * 1000;
const languageNames = { zh_cn: "中文", en: "English", es: "Español", fr: "Français", ja: "日本語" };
const placeNameFallbacks = {
  zh_cn: { Taiwan: "台湾" },
  ja: { Taiwan: "台湾" }
};

const translations = {
  zh_cn: { searchLabel: "搜索城市", searchPlaceholder: "搜索城市或国家…", searchButton: "搜索", chooseLocation: "请选择地点", useLocation: "使用我的位置", languageLabel: "语言", soundOn: "开启天气白噪音", soundOff: "关闭天气白噪音", enterFullscreen: "进入全屏", exitFullscreen: "退出全屏", lastUpdated: "最后更新", feelsLike: "体感", humidity: "湿度", wind: "风速", poweredBy: "天气数据来自", loading: "正在获取天气…", locating: "正在获取你的位置…", notFound: "未找到这个地点，请检查拼写。", apiError: "天气服务暂时不可用，请稍后重试。", locationDenied: "无法获取位置，请允许定位权限或手动搜索。", clear: "晴", clouds: "多云", rain: "雨", drizzle: "细雨", thunderstorm: "雷暴", snow: "雪", atmosphere: "雾霾" },
  en: { searchLabel: "Search for a city", searchPlaceholder: "Search city or country…", searchButton: "Search", chooseLocation: "Choose a location", useLocation: "Use my location", languageLabel: "Language", soundOn: "Play weather noise", soundOff: "Mute weather noise", enterFullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen", lastUpdated: "Last updated", feelsLike: "Feels", humidity: "Humidity", wind: "Wind", poweredBy: "Weather data by", loading: "Fetching weather…", locating: "Finding your location…", notFound: "Place not found. Check the spelling.", apiError: "Weather service is unavailable. Try again later.", locationDenied: "Location unavailable. Allow access or search manually.", clear: "Clear", clouds: "Cloudy", rain: "Rain", drizzle: "Drizzle", thunderstorm: "Thunderstorm", snow: "Snow", atmosphere: "Mist" },
  es: { searchLabel: "Buscar ciudad", searchPlaceholder: "Buscar ciudad o país…", searchButton: "Buscar", chooseLocation: "Elige una ubicación", useLocation: "Usar mi ubicación", languageLabel: "Idioma", soundOn: "Activar ruido del clima", soundOff: "Silenciar ruido del clima", enterFullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa", lastUpdated: "Última actualización", feelsLike: "Sensación", humidity: "Humedad", wind: "Viento", poweredBy: "Datos meteorológicos de", loading: "Consultando el tiempo…", locating: "Buscando tu ubicación…", notFound: "No encontramos ese lugar.", apiError: "El servicio no está disponible.", locationDenied: "No se pudo obtener la ubicación.", clear: "Despejado", clouds: "Nublado", rain: "Lluvia", drizzle: "Llovizna", thunderstorm: "Tormenta", snow: "Nieve", atmosphere: "Niebla" },
  fr: { searchLabel: "Rechercher une ville", searchPlaceholder: "Ville ou pays…", searchButton: "Rechercher", chooseLocation: "Choisissez un lieu", useLocation: "Utiliser ma position", languageLabel: "Langue", soundOn: "Activer le bruit météo", soundOff: "Couper le bruit météo", enterFullscreen: "Plein écran", exitFullscreen: "Quitter le plein écran", lastUpdated: "Dernière mise à jour", feelsLike: "Ressenti", humidity: "Humidité", wind: "Vent", poweredBy: "Données météo par", loading: "Chargement de la météo…", locating: "Recherche de votre position…", notFound: "Lieu introuvable.", apiError: "Service météo indisponible.", locationDenied: "Position indisponible.", clear: "Ciel dégagé", clouds: "Nuageux", rain: "Pluie", drizzle: "Bruine", thunderstorm: "Orage", snow: "Neige", atmosphere: "Brume" },
  ja: { searchLabel: "都市を検索", searchPlaceholder: "都市または国を検索…", searchButton: "検索", chooseLocation: "場所を選択", useLocation: "現在地を使う", languageLabel: "言語", soundOn: "天気の環境音を再生", soundOff: "環境音を停止", enterFullscreen: "全画面表示", exitFullscreen: "全画面表示を終了", lastUpdated: "最終更新", feelsLike: "体感", humidity: "湿度", wind: "風速", poweredBy: "気象データ：", loading: "天気を取得中…", locating: "現在地を取得中…", notFound: "場所が見つかりません。", apiError: "気象サービスを利用できません。", locationDenied: "位置情報を取得できません。", clear: "晴れ", clouds: "曇り", rain: "雨", drizzle: "霧雨", thunderstorm: "雷雨", snow: "雪", atmosphere: "霧" }
};

const localeMap = { zh_cn: "zh-CN", en: "en-GB", es: "es-ES", fr: "fr-FR", ja: "ja-JP" };
const seoContent = {
  zh_cn: { title: "My Weather · 全球实时天气", description: "极简天气查询，直观呈现全球城市的实时天气、温度、湿度和风速。", keywords: "天气,实时天气,天气查询,温度,湿度,风速,全球天气", ogLocale: "zh_CN" },
  en: { title: "My Weather · Current Weather Worldwide", description: "A minimalist weather experience for checking current conditions, temperature, humidity, and wind worldwide.", keywords: "weather,current weather,weather search,temperature,humidity,wind,world weather", ogLocale: "en_GB" },
  es: { title: "My Weather · Tiempo actual en todo el mundo", description: "Una experiencia meteorológica minimalista para consultar el tiempo, la temperatura, la humedad y el viento en todo el mundo.", keywords: "tiempo,tiempo actual,pronóstico,temperatura,humedad,viento,tiempo mundial", ogLocale: "es_ES" },
  fr: { title: "My Weather · Météo actuelle dans le monde", description: "Une expérience météo minimaliste pour consulter le temps, la température, l’humidité et le vent partout dans le monde.", keywords: "météo,météo actuelle,prévisions,température,humidité,vent,météo mondiale", ogLocale: "fr_FR" },
  ja: { title: "My Weather · 世界の現在の天気", description: "世界各地の天気、気温、湿度、風速を直感的に確認できる、ミニマルな天気サービスです。", keywords: "天気,現在の天気,天気検索,気温,湿度,風速,世界の天気", ogLocale: "ja_JP" }
};
const supportedLanguages = Object.keys(localeMap);
const requestedLanguage = new URLSearchParams(location.search).get("lang");
const initialLanguage = supportedLanguages.includes(requestedLanguage) ? requestedLanguage : localStorage.getItem("weather-language");
const state = { lang: supportedLanguages.includes(initialLanguage) ? initialLanguage : "zh_cn", lastQuery: { q: "Northampton,GB" }, data: null, sound: false, placeName: "", pendingPlaces: [], updatedAt: null, refreshTimer: null, locationRequestId: 0 };
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};
const elements = {
  form: $<HTMLFormElement>(".search-form"), input: $<HTMLInputElement>("#city-search"), locate: $<HTMLButtonElement>("#location-button"), languageButton: $<HTMLButtonElement>("#language-button"),
  languageMenu: $("#language-menu"), languageCurrent: $("#language-current"), fullscreen: $("#fullscreen-button"),
  sound: $<HTMLButtonElement>("#sound-button"), city: $("#city"), date: $("#date"), temp: $("#temp"), weather: $("#weather"),
  hiLow: $("#hi-low"), feels: $("#feels-like"), humidity: $("#humidity"), wind: $("#wind"),
  icon: $("#weather-icon"), status: $("#status"), updated: $<HTMLTimeElement>("#updated-time"),
  placeMenu: $("#place-menu"), placeOptions: $("#place-options")
};

function t(key) { return translations[state.lang][key] || translations.en[key] || key; }

function updateSeo() {
  const seo = seoContent[state.lang];
  const pageUrl = `https://weather.bestguo.top/?lang=${state.lang}`;
  document.title = seo.title;
  $("meta[name='description']").setAttribute("content", seo.description);
  $("meta[name='keywords']").setAttribute("content", seo.keywords);
  $("link[rel='canonical']").setAttribute("href", pageUrl);
  $("meta[property='og:title']").setAttribute("content", seo.title);
  $("meta[property='og:description']").setAttribute("content", seo.description);
  $("meta[property='og:url']").setAttribute("content", pageUrl);
  $("meta[property='og:locale']").setAttribute("content", seo.ogLocale);
  $("meta[name='twitter:title']").setAttribute("content", seo.title);
  $("meta[name='twitter:description']").setAttribute("content", seo.description);
}

function applyLanguage() {
  const locale = localeMap[state.lang];
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((node) => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });
  elements.placeMenu.setAttribute("aria-label", t("chooseLocation"));
  elements.languageCurrent.textContent = languageNames[state.lang];
  elements.languageMenu.querySelectorAll<HTMLElement>("[data-lang]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.lang === state.lang));
  });
  updateSoundLabel();
  updateFullscreenLabel();
  updateSeo();
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

function populateSnow(intensity) {
  const scene = $(".scene-snow");
  if (scene.dataset.intensity === intensity) return;
  scene.dataset.intensity = intensity;
  const totals = { light: 42, moderate: 68, heavy: 96 };
  const layers = [
    { selector: ".snow-far", share: .34, size: .48, duration: 15, opacity: .42 },
    { selector: ".snow-mid", share: .38, size: .76, duration: 10.5, opacity: .7 },
    { selector: ".snow-near", share: .28, size: 1.08, duration: 7.5, opacity: .94 }
  ];
  const shapes = ["❄", "❅", "❆"];
  layers.forEach((config) => {
    const layer = $(config.selector);
    layer.replaceChildren();
    const count = Math.round(totals[intensity] * config.share);
    for (let index = 0; index < count; index += 1) {
      const flake = document.createElement("span");
      const shape = document.createElement("i");
      const duration = config.duration * (.78 + Math.random() * .44);
      const size = config.size * (.68 + Math.random() * .64);
      const sway = size * (1.1 + Math.random() * 2.2);
      const turns = (Math.random() > .5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2));
      flake.className = "snow-flake";
      flake.style.setProperty("--snow-x", `${(Math.random() * 104 - 2).toFixed(2)}vw`);
      flake.style.setProperty("--snow-size", `${size.toFixed(2)}rem`);
      flake.style.setProperty("--snow-duration", `${duration.toFixed(2)}s`);
      flake.style.setProperty("--snow-delay", `${(-Math.random() * duration).toFixed(2)}s`);
      flake.style.setProperty("--snow-sway", `${sway.toFixed(2)}rem`);
      flake.style.setProperty("--snow-sway-back", `${(-sway * .45).toFixed(2)}rem`);
      flake.style.setProperty("--snow-sway-end", `${(sway * .25).toFixed(2)}rem`);
      flake.style.setProperty("--snow-opacity", `${(config.opacity * (.72 + Math.random() * .28)).toFixed(2)}`);
      flake.style.setProperty("--snow-turns", `${turns}turn`);
      shape.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      shape.style.setProperty("--spin-duration", `${(3.8 + Math.random() * 5.6).toFixed(2)}s`);
      shape.style.setProperty("--spin-delay", `${(-Math.random() * 6).toFixed(2)}s`);
      flake.append(shape);
      layer.append(flake);
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
  if (type === "snow") populateSnow(intensity);
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
  document.title = `${Math.round(data.main.temp)}° · ${data.name} | My Weather`;
  if (state.sound) restartWeatherSound(type);
}

function localizedPlace(place) {
  const language = localeMap[state.lang].split("-")[0];
  const localizedName = place.local_names?.[state.lang] || place.local_names?.[language];
  return {
    lat: place.lat,
    lon: place.lon,
    name: localizedName || placeNameFallbacks[state.lang]?.[place.name] || place.name,
    searchName: place.name,
    state: place.state || "",
    country: place.country || ""
  };
}

async function getOpenWeatherPlaces(params, signal) {
  try {
    const endpoint = params.q ? "direct" : "reverse";
    const query = new URLSearchParams({ ...params, limit: params.q ? "5" : "1", appid: API_KEY });
    const response = await fetch(`${GEO_URL}/${endpoint}?${query}`, { signal });
    if (!response.ok) return [];
    const places = await response.json();
    return places.map(localizedPlace);
  } catch {
    return [];
  }
}

async function getOpenMeteoPlaces(search, signal) {
  try {
    const parts = search.split(",").map((part) => part.trim()).filter(Boolean);
    const lastPart = parts[parts.length - 1] || "";
    const countryCode = /^[a-z]{2}$/i.test(lastPart) ? parts.pop().toUpperCase() : "";
    const query = new URLSearchParams({
      name: parts[0] || search,
      count: "50",
      language: localeMap[state.lang].split("-")[0],
      format: "json"
    });
    if (countryCode) query.set("countryCode", countryCode);
    const response = await fetch(`${OPEN_METEO_GEO_URL}?${query}`, { signal });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((place) => ({
      lat: place.latitude,
      lon: place.longitude,
      name: place.name,
      searchName: place.name,
      state: place.admin1 || place.admin2 || "",
      country: place.country_code || ""
    }));
  } catch {
    return [];
  }
}

async function getPlaces(params, signal) {
  const sources = params.q
    ? await Promise.all([getOpenWeatherPlaces(params, signal), getOpenMeteoPlaces(params.q, signal)])
    : [await getOpenWeatherPlaces(params, signal)];
  const unique = new Map();
  sources.flat().forEach((place) => {
      const key = [place.name, place.state, place.country]
        .map((part) => part.trim().toLocaleLowerCase())
        .join("|");
      if (!unique.has(key)) unique.set(key, place);
  });
  const places = [...unique.values()];
  if (!params.q) return places;

  const searchTerm = params.q.split(",")[0].normalize("NFKC").trim().toLocaleLowerCase();
  const relevance = (place) => {
    const names = [place.name, place.searchName]
      .filter(Boolean)
      .map((name) => name.normalize("NFKC").trim().toLocaleLowerCase());
    if (names.some((name) => name === searchTerm)) return 0;
    if (names.some((name) => name.includes(searchTerm) || searchTerm.includes(name))) return 1;
    return 2;
  };
  const ranked = places.map((place) => ({ place, rank: relevance(place) }));
  const hasRelevantMatch = ranked.some(({ rank }) => rank < 2);
  return ranked
    .filter(({ rank }) => !hasRelevantMatch || rank < 2)
    .sort((a, b) => a.rank - b.rank)
    .map(({ place }) => place);
}

function closePlaceMenu() {
  elements.placeMenu.hidden = true;
  elements.placeOptions.replaceChildren();
  state.pendingPlaces = [];
}

function countryName(code) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([localeMap[state.lang]], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function showPlaceMenu(places) {
  state.pendingPlaces = places;
  const fragment = document.createDocumentFragment();
  places.forEach((place, index) => {
    const button = document.createElement("button");
    const name = document.createElement("span");
    const region = document.createElement("span");
    button.type = "button";
    button.dataset.placeIndex = String(index);
    button.setAttribute("role", "option");
    name.className = "place-name";
    name.textContent = place.name;
    region.className = "place-region";
    region.textContent = [place.state, countryName(place.country), place.country].filter(Boolean).join(" · ");
    button.append(name, region);
    fragment.append(button);
  });
  elements.placeOptions.replaceChildren(fragment);
  elements.placeMenu.hidden = false;
  elements.status.textContent = t("chooseLocation");
}

async function getWeather(params, selectedPlace = null) {
  elements.status.textContent = t("loading");
  elements.input.disabled = true;
  elements.locate.disabled = true;
  closePlaceMenu();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const places = selectedPlace ? [selectedPlace] : await getPlaces(params, controller.signal);
    if (params.q && places.length > 1) {
      showPlaceMenu(places);
      return;
    }
    const place = places[0] || null;
    const weatherParams = place ? { lat: place.lat, lon: place.lon } : params;
    state.placeName = place?.name || "";
    const query = new URLSearchParams({ ...weatherParams, appid: API_KEY, units: "metric", lang: state.lang });
    const response = await fetch(`${API_URL}?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 404 ? "notFound" : "apiError");
    state.data = await response.json();
    state.lastQuery = place ? { lat: place.lat, lon: place.lon } : params;
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
  for (const provider of IP_GEO_PROVIDERS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(provider.url, { signal: controller.signal });
      if (!response.ok) continue;
      const location = provider.parse(await response.json());
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      if (location.success && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { lat: latitude.toFixed(5), lon: longitude.toFixed(5) };
      }
    } catch {
      // Try the next IP provider.
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error("ipLocationFailed");
}

function getGpsCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("gpsUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude.toFixed(5), lon: coords.longitude.toFixed(5) }),
      () => reject(new Error("gpsUnavailable")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

async function useLocation(options: { fallbackToDefault?: boolean } = {}) {
  const fallbackToDefault = options.fallbackToDefault === true;
  const requestId = ++state.locationRequestId;
  elements.locate.disabled = true;
  elements.status.textContent = t("locating");
  try {
    let coordinates;
    try {
      coordinates = await getGpsCoordinates();
    } catch {
      coordinates = await getIpCoordinates();
    }
    if (requestId !== state.locationRequestId) return;
    await getWeather(coordinates);
  } catch {
    if (requestId !== state.locationRequestId) return;
    if (fallbackToDefault) await getWeather(state.lastQuery);
    else elements.status.textContent = t("locationDenied");
  } finally {
    if (requestId === state.locationRequestId) elements.locate.disabled = false;
  }
}

let audio = null;
function buildNoise(type) {
  const AudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
elements.placeMenu.addEventListener("click", (event) => {
  const option = (event.target as Element).closest<HTMLElement>("[data-place-index]");
  if (!option) return;
  const place = state.pendingPlaces[Number(option.dataset.placeIndex)];
  if (!place) return;
  elements.input.value = "";
  getWeather({ lat: place.lat, lon: place.lon }, place);
});
elements.locate.addEventListener("click", () => useLocation());
elements.languageButton.addEventListener("click", () => {
  setLanguageMenu(elements.languageButton.getAttribute("aria-expanded") !== "true");
});
elements.languageMenu.addEventListener("click", (event) => {
  const option = (event.target as Element).closest<HTMLElement>("[data-lang]");
  if (!option) return;
  state.lang = option.dataset.lang;
  localStorage.setItem("weather-language", state.lang);
  const languageUrl = new URL(location.href);
  languageUrl.searchParams.set("lang", state.lang);
  history.replaceState(null, "", languageUrl);
  setLanguageMenu(false);
  applyLanguage();
  getWeather(state.lastQuery);
});
document.addEventListener("click", (event) => {
  const target = event.target as Element;
  if (!target.closest(".language-control")) setLanguageMenu(false);
  if (!target.closest(".search-form")) closePlaceMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setLanguageMenu(false);
    closePlaceMenu();
  }
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
