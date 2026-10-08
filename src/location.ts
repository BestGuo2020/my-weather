export const LOCATION_DIAGNOSTICS_VERSION = "2026-10-08.1";
// accuracyMode is experimental; older browsers ignore the extra dictionary member.
export const GPS_OPTIONS: PositionOptions & { accuracyMode: "precise" } = {
  enableHighAccuracy: true, timeout: 30000, maximumAge: 0, accuracyMode: "precise"
};

export type Coordinates = { lat: string; lon: string; accuracy?: number; timestamp?: number; provider?: string; accuracyModeRead?: boolean };

export class BrowserLocationError extends Error {
  constructor(public code: number | null, message: string, public reason: "browser" | "unsupported" | "insecure" = "browser", public accuracyModeRead?: boolean) {
    super(message);
    this.name = "BrowserLocationError";
  }
}

export function getGpsCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new BrowserLocationError(null, "Geolocation requires a secure context.", "insecure"));
      return;
    }
    if (!navigator.geolocation) {
      reject(new BrowserLocationError(null, "Geolocation is not available in this browser.", "unsupported"));
      return;
    }
    let accuracyModeRead = false;
    const options = { ...GPS_OPTIONS };
    Object.defineProperty(options, "accuracyMode", {
      enumerable: true,
      get() { accuracyModeRead = true; return "precise"; }
    });
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({ lat: coords.latitude.toFixed(5), lon: coords.longitude.toFixed(5), accuracy: coords.accuracy, timestamp, accuracyModeRead }),
      (error) => reject(new BrowserLocationError(error.code, error.message, "browser", accuracyModeRead)),
      options
    );
  });
}

const IP_GEO_PROVIDERS = [
  { url: "/api/ip-location", name: "toola.hiofd.com (EdgeOne)", parse: (data) => ({ success: data.success === true, latitude: data.latitude, longitude: data.longitude }) },
  { url: "https://ipwho.is/", parse: (data) => ({ success: data.success !== false, latitude: data.latitude, longitude: data.longitude }) },
  { url: "https://ipapi.co/json/", parse: (data) => ({ success: !data.error, latitude: data.latitude, longitude: data.longitude }) }
];

export async function getIpCoordinates(isCurrent = () => true): Promise<Coordinates> {
  for (const provider of IP_GEO_PROVIDERS) {
    if (!isCurrent()) throw new Error("locationRequestSuperseded");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(provider.url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) continue;
      const location = provider.parse(await response.json());
      const latitude = Number(location.latitude), longitude = Number(location.longitude);
      if (location.success && location.latitude != null && location.longitude != null
        && String(location.latitude).trim() !== "" && String(location.longitude).trim() !== ""
        && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        return { lat: latitude.toFixed(5), lon: longitude.toFixed(5), provider: provider.name || new URL(provider.url).hostname };
      }
    } catch {
      // Try the next IP provider.
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error("ipLocationFailed");
}

export type LocationDiagnostics = {
  phase: "browser" | "ip" | "ready" | "failed" | "default";
  source?: "browser" | "ip";
  coordinates?: Coordinates;
  browserError?: BrowserLocationError;
  startedAt: number;
  browserDuration?: number;
  trigger?: "button" | "page-ip" | "page-browser";
  userActivation?: boolean;
  userAgent?: string;
  origin?: string;
};

const messages = {
  zh_cn: {
    details: "定位详情", browser: "正在获取浏览器位置…", browserReady: "已使用浏览器定位。",
    ipPending: "正在尝试 IP 近似定位…", ipReady: "已使用 IP 估算位置，可能与实际所在地不同。",
    failed: "IP 定位也失败了，请手动搜索地点。", default: "IP 定位也失败了，正在显示之前的地点或默认地点。",
    denied: "浏览器定位失败：定位权限被拒绝。", unavailable: "浏览器定位失败：无法获取位置。",
    timeout: "浏览器定位失败：请求超时。", unsupported: "浏览器不支持定位。", insecure: "浏览器定位失败：需要安全连接。",
    unknown: "浏览器定位失败：未知错误。", accuracy: "定位精度", source: "定位来源", browserSource: "浏览器定位", ipSource: "IP 估算",
    coordinates: "经度、纬度", duration: "浏览器定位耗时", code: "错误码", original: "浏览器原始错误", version: "诊断版本",
    options: "定位请求参数", timestamp: "位置数据时间", provider: "IP 定位服务", meters: "米", seconds: "秒",
    clickHint: "点击“使用我的位置”获取设备位置。", trigger: "触发方式", button: "点击定位", pageIp: "打开页面时的 IP 估算",
    activation: "用户点击激活", modeRead: "浏览器读取了精确模式选项", browserInfo: "浏览器信息", origin: "页面来源", pageBrowser: "打开页面时的设备定位"
  },
  en: {
    details: "Location details", browser: "Requesting browser location…", browserReady: "Using browser location.",
    ipPending: "Trying approximate IP location…", ipReady: "Using an IP estimate; it may differ from your actual location.",
    failed: "IP location also failed. Search for a place manually.", default: "IP location also failed. Showing the previous or default place.",
    denied: "Browser location failed: permission denied.", unavailable: "Browser location failed: position unavailable.",
    timeout: "Browser location failed: request timed out.", unsupported: "This browser does not support geolocation.", insecure: "Browser location failed: a secure connection is required.",
    unknown: "Browser location failed: unknown error.", accuracy: "Accuracy", source: "Location source", browserSource: "Browser location", ipSource: "IP estimate",
    coordinates: "Longitude, latitude", duration: "Browser location duration", code: "Error code", original: "Original browser error", version: "Diagnostic version",
    options: "Location request options", timestamp: "Position timestamp", provider: "IP location provider", meters: "m", seconds: "s",
    clickHint: "Click Use my location to request device location.", trigger: "Trigger", button: "Location button", pageIp: "Initial IP estimate",
    activation: "User activation", modeRead: "Browser read the precise-mode option", browserInfo: "Browser", origin: "Page origin", pageBrowser: "Initial device location"
  },
  es: {
    details: "Detalles de ubicación", browser: "Solicitando ubicación al navegador…", browserReady: "Usando la ubicación del navegador.",
    ipPending: "Probando ubicación aproximada por IP…", ipReady: "Usando una estimación por IP; puede diferir de tu ubicación real.",
    failed: "La ubicación por IP también falló. Busca un lugar manualmente.", default: "La ubicación por IP también falló. Se muestra el lugar anterior o predeterminado.",
    denied: "Falló la ubicación del navegador: permiso denegado.", unavailable: "Falló la ubicación del navegador: posición no disponible.",
    timeout: "Falló la ubicación del navegador: tiempo de espera agotado.", unsupported: "Este navegador no admite geolocalización.", insecure: "La ubicación requiere una conexión segura.",
    unknown: "Falló la ubicación del navegador: error desconocido.", accuracy: "Precisión", source: "Origen", browserSource: "Navegador", ipSource: "Estimación por IP",
    coordinates: "Longitud, latitud", duration: "Tiempo del navegador", code: "Código de error", original: "Error original", version: "Versión de diagnóstico",
    options: "Opciones de ubicación", timestamp: "Fecha de la posición", provider: "Proveedor IP", meters: "m", seconds: "s",
    clickHint: "Pulsa Usar mi ubicación para solicitar la ubicación del dispositivo.", trigger: "Activación", button: "Botón de ubicación", pageIp: "Estimación IP inicial",
    activation: "Activación del usuario", modeRead: "El navegador leyó la opción de precisión", browserInfo: "Navegador", origin: "Origen de la página", pageBrowser: "Ubicación inicial del dispositivo"
  },
  fr: {
    details: "Détails de localisation", browser: "Demande de position au navigateur…", browserReady: "Position du navigateur utilisée.",
    ipPending: "Recherche d’une position approximative par IP…", ipReady: "Estimation par IP utilisée ; elle peut différer de votre position réelle.",
    failed: "La localisation IP a aussi échoué. Recherchez un lieu manuellement.", default: "La localisation IP a aussi échoué. Le lieu précédent ou par défaut est affiché.",
    denied: "Localisation du navigateur échouée : autorisation refusée.", unavailable: "Localisation du navigateur échouée : position indisponible.",
    timeout: "Localisation du navigateur échouée : délai dépassé.", unsupported: "Ce navigateur ne prend pas en charge la géolocalisation.", insecure: "La localisation nécessite une connexion sécurisée.",
    unknown: "Localisation du navigateur échouée : erreur inconnue.", accuracy: "Précision", source: "Source", browserSource: "Navigateur", ipSource: "Estimation IP",
    coordinates: "Longitude, latitude", duration: "Durée de localisation", code: "Code d’erreur", original: "Erreur originale", version: "Version du diagnostic",
    options: "Options de localisation", timestamp: "Date de la position", provider: "Service IP", meters: "m", seconds: "s",
    clickHint: "Cliquez sur Utiliser ma position pour demander la position de l’appareil.", trigger: "Déclenchement", button: "Bouton de localisation", pageIp: "Estimation IP initiale",
    activation: "Activation utilisateur", modeRead: "Option de précision lue par le navigateur", browserInfo: "Navigateur", origin: "Origine de la page", pageBrowser: "Position initiale de l’appareil"
  },
  ja: {
    details: "位置情報の詳細", browser: "ブラウザーの位置情報を取得中…", browserReady: "ブラウザーの位置情報を使用しています。",
    ipPending: "IP による概算位置を取得中…", ipReady: "IP による概算位置を使用しています。実際の場所と異なる場合があります。",
    failed: "IP の位置取得も失敗しました。場所を手動で検索してください。", default: "IP の位置取得も失敗したため、以前の場所または既定の場所を表示します。",
    denied: "ブラウザーの位置取得に失敗：権限が拒否されました。", unavailable: "ブラウザーの位置取得に失敗：位置を取得できません。",
    timeout: "ブラウザーの位置取得に失敗：タイムアウトしました。", unsupported: "このブラウザーは位置情報に対応していません。", insecure: "位置情報には安全な接続が必要です。",
    unknown: "ブラウザーの位置取得に失敗：不明なエラー。", accuracy: "精度", source: "取得元", browserSource: "ブラウザー", ipSource: "IP による概算",
    coordinates: "経度、緯度", duration: "位置取得の所要時間", code: "エラーコード", original: "ブラウザーの元のエラー", version: "診断バージョン",
    options: "位置取得の設定", timestamp: "位置データの時刻", provider: "IP サービス", meters: "m", seconds: "秒",
    clickHint: "現在地を使うボタンで端末の位置を取得できます。", trigger: "開始方法", button: "位置ボタン", pageIp: "初期 IP 推定",
    activation: "ユーザー操作", modeRead: "ブラウザーが精度設定を読み取りました", browserInfo: "ブラウザー", origin: "ページのオリジン", pageBrowser: "初期の端末位置"
  }
};

export function locationFeedback(diagnostics: LocationDiagnostics, language: string) {
  const text = messages[language] || messages.en;
  const error = diagnostics.browserError;
  const reason = error?.reason === "browser"
    ? ({ 1: "denied", 2: "unavailable", 3: "timeout" }[error.code] || "unknown") : error?.reason;
  const parts = error ? [text[reason || "unknown"]] : [];
  if (diagnostics.phase === "browser") parts.push(text.browser);
  else if (diagnostics.phase === "ip") parts.push(text.ipPending);
  else if (diagnostics.phase === "failed") parts.push(text.failed);
  else if (diagnostics.phase === "default") parts.push(text.default);
  else parts.push(diagnostics.source === "ip" ? text.ipReady : text.browserReady);
  if (diagnostics.trigger === "page-ip" && diagnostics.source === "ip") parts.push(text.clickHint);
  const details = [`${text.version}: ${LOCATION_DIAGNOSTICS_VERSION}`];
  if (diagnostics.trigger) details.push(`${text.trigger}: ${diagnostics.trigger === "button" ? text.button : diagnostics.trigger === "page-browser" ? text.pageBrowser : text.pageIp}`);
  if (diagnostics.source) details.push(`${text.source}: ${diagnostics.source === "ip" ? text.ipSource : text.browserSource}`);
  if (diagnostics.browserDuration != null) details.push(`${text.duration}: ${(diagnostics.browserDuration / 1000).toFixed(2)} ${text.seconds}`);
  if (error) {
    if (error.code != null) details.push(`${text.code}: ${error.code}`);
    details.push(`${text.original}: ${error.message || "—"}`);
  }
  const coordinates = diagnostics.coordinates;
  if (coordinates) {
    details.push(`${text.coordinates}: ${coordinates.lon}, ${coordinates.lat}`);
    if (Number.isFinite(coordinates.accuracy)) details.push(`${text.accuracy}: ±${Math.round(coordinates.accuracy)} ${text.meters}`);
    if (coordinates.timestamp != null) details.push(`${text.timestamp}: ${new Date(coordinates.timestamp).toISOString()}`);
    if (coordinates.provider) details.push(`${text.provider}: ${coordinates.provider}`);
  }
  if (diagnostics.trigger !== "page-ip") {
    details.push(`${text.options}: enableHighAccuracy=${GPS_OPTIONS.enableHighAccuracy}, timeout=${GPS_OPTIONS.timeout}ms, maximumAge=${GPS_OPTIONS.maximumAge}ms, accuracyMode=${GPS_OPTIONS.accuracyMode}`);
    const modeRead = coordinates?.accuracyModeRead ?? error?.accuracyModeRead;
    if (modeRead != null) details.push(`${text.modeRead}: ${modeRead}`);
    if (diagnostics.userActivation != null) details.push(`${text.activation}: ${diagnostics.userActivation}`);
    if (diagnostics.origin) details.push(`${text.origin}: ${diagnostics.origin}`);
    if (diagnostics.userAgent) details.push(`${text.browserInfo}: ${diagnostics.userAgent}`);
  }
  return { message: parts.join(" "), details: details.join("\n"), summary: text.details, warning: !!error || diagnostics.source === "ip" };
}
