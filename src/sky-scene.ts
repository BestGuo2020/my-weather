export type SkyMode = "clear" | "few" | "scattered" | "broken" | "overcast" | "rain" | "snow" | "storm" | "mist";
export interface SkyProfile { mode: SkyMode; cover: number; cloudCount: number; }

export function skyProfile(type: string, weatherId: number, cloudCover?: unknown): SkyProfile {
  const fallback = type === "clear" ? 0 : type === "clouds" ? ({ 801: 18, 802: 40, 803: 70, 804: 100 }[weatherId] ?? 70)
    : type === "thunderstorm" ? 100 : type === "rain" || type === "drizzle" ? 90 : type === "snow" ? 85 : 0;
  const cover = typeof cloudCover === "number" && Number.isFinite(cloudCover)
    ? Math.round(Math.max(0, Math.min(100, cloudCover))) : fallback;
  const mode: SkyMode = type === "thunderstorm" ? "storm" : type === "rain" || type === "drizzle" ? "rain"
    : type === "snow" ? "snow" : type === "atmosphere" ? "mist"
    : cover === 0 ? "clear" : cover <= 25 ? "few" : cover <= 50 ? "scattered" : cover <= 84 ? "broken" : "overcast";
  const cloudCount = mode === "clear" ? 0 : mode === "few" ? 2 : mode === "scattered" ? 4
    : mode === "broken" ? 6 : mode === "overcast" ? 8 : mode === "mist" ? (cover > 50 ? 3 : cover > 0 ? 1 : 0)
    : Math.min(9, Math.max(mode === "storm" ? 4 : 3, Math.ceil(cover / (mode === "snow" ? 18 : 13))));
  return { mode, cover, cloudCount };
}

export function skyCloudMarkup(profile: SkyProfile): string {
  const dense = ["overcast", "rain", "storm"].includes(profile.mode);
  const width = profile.mode === "few" ? 13 : profile.mode === "scattered" ? 18
    : profile.mode === "broken" || profile.mode === "snow" ? 26 : profile.mode === "storm" ? 43 : 34;
  const positions = [8, 73, -12, 47, 27, 93, 61, -25, 39];
  const clouds = Array.from({ length: profile.cloudCount }, (_, index) => {
    const cloudWidth = width * (.8 + index % 3 * .13);
    const top = 3 + index % 4 * 6;
    const duration = 110 + index * 13;
    return `<span class="sky-cloud" style="--cloud-width:${cloudWidth.toFixed(1)}vw;--cloud-left:${positions[index]}%;--cloud-top:${top}%;--cloud-duration:${duration}s;--cloud-delay:-${index * 19 + 11}s">
      <svg viewBox="0 0 240 110" aria-hidden="true" focusable="false">
        <defs><linearGradient id="sky-cloud-${index}" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="var(--sky-cloud-light)"/><stop offset="1" stop-color="var(--sky-cloud-base)"/>
        </linearGradient></defs>
        <g fill="url(#sky-cloud-${index})">
          <ellipse cx="61" cy="72" rx="47" ry="25"/><ellipse cx="${97 + index % 3 * 5}" cy="${dense ? 40 : 51}" rx="42" ry="${dense ? 34 : 29}"/>
          <ellipse cx="143" cy="52" rx="41" ry="32"/><ellipse cx="185" cy="74" rx="42" ry="22"/>
          <ellipse cx="118" cy="78" rx="91" ry="23"/>
        </g>
      </svg>
    </span>`;
  }).join("");
  return `<span class="sky-veil"></span>${clouds}`;
}

export function renderSkyScene(container: HTMLElement, profile: SkyProfile): void {
  document.body.dataset.sky = profile.mode;
  document.body.dataset.cloudCover = String(profile.cover);
  container.style.setProperty("--sky-cover", String(profile.cover / 100));
  const key = `${profile.mode}|${profile.cloudCount}`;
  if (container.dataset.skyKey === key) return;
  container.dataset.skyKey = key;
  container.innerHTML = skyCloudMarkup(profile);
}
