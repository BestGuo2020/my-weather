export type WeatherDepth = "far" | "mid" | "near";

const depthConfig = {
  far: { rain: [8, 14, 22], snow: [10, 18, 26], bottom: 306, opacity: .32, line: .7, flake: .8, rainSeconds: 1.6, snowSeconds: 14 },
  mid: { rain: [10, 18, 28], snow: [14, 24, 36], bottom: 330, opacity: .5, line: .9, flake: 1.2, rainSeconds: 1.25, snowSeconds: 11 },
  near: { rain: [10, 20, 34], snow: [10, 18, 30], bottom: 392, opacity: .72, line: 1.1, flake: 1.7, rainSeconds: .95, snowSeconds: 8 }
};

function seededRandom(seed: string) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value = Math.imul(value, 1664525) + 1013904223 | 0;
    return (value >>> 0) / 4294967296;
  };
}

function tier(index: number, totals: number[]): string {
  return index < totals[0] ? "" : index < totals[1] ? " particle-moderate" : " particle-heavy";
}

function rainLandings(seed: string, top: number) {
  const random = seededRandom(`${seed}|rain-ground`);
  const config = depthConfig.near;
  return Array.from({ length: config.rain[2] }, (_, index) => {
    const x = Number((40 + random() * 1360).toFixed(1));
    const y = Number((354 + random() * 38).toFixed(1));
    const drift = Number((12 + random() * 12).toFixed(1));
    // The drop lands 65% through a shared cycle; the rest is splash decay.
    const duration = (config.rainSeconds * (.82 + random() * .36) / .65).toFixed(3);
    const delay = (-random() * Number(duration)).toFixed(3);
    const length = Number((5 + random() * 5).toFixed(1));
    const radius = (1.5 + random() * 1.5).toFixed(1);
    const bandStart = index < config.rain[0] ? 0 : index < config.rain[1] ? config.rain[0] : config.rain[1];
    return { index, x, y, top, drift, fall: y - top, duration, delay, length, radius,
      className: tier(index, config.rain), ripple: index - bandStart < 4 };
  });
}

function landingDropMarkup(landing: ReturnType<typeof rainLandings>[number]): string {
  const tail = (landing.drift / landing.fall * landing.length).toFixed(2);
  return `<g class="city-rain-drop city-rain-impact${landing.className}" data-rain-index="${landing.index}"
    style="--particle-x:${(landing.x - landing.drift).toFixed(1)}px;--particle-top:${landing.top}px;--particle-fall:${landing.fall.toFixed(1)}px;--particle-drift:${landing.drift}px;--particle-duration:${landing.duration}s;--particle-delay:${landing.delay}s;--particle-opacity:${depthConfig.near.opacity}">
    <path d="M-${tail} -${landing.length}L0 0" stroke-width="${depthConfig.near.line}"/>
  </g>`;
}

// All distances are local SVG units. Rain and snow never use viewport heights
// or widths, and remain attached to the city when its layout or LCZ form changes.
export function cityWeatherMarkup(depth: WeatherDepth, seed: string, top: number): string {
  const random = seededRandom(`${seed}|weather|${depth}`);
  const config = depthConfig[depth];
  const fall = config.bottom - top;
  const landings = depth === "near" ? rainLandings(seed, top) : [];
  const particles = (snow: boolean) => {
    const totals = snow ? config.snow : config.rain;
    return Array.from({ length: totals[2] }, (_, index) => {
      const x = (random() * 1440).toFixed(1);
      const duration = (snow ? config.snowSeconds : config.rainSeconds) * (.82 + random() * .36);
      const delay = (-random() * duration).toFixed(2);
      const size = snow ? config.flake * (.7 + random() * .6) : 5 + random() * 5;
      const drift = snow ? 7 + random() * 15 : 12 + random() * 12;
      // Keep consuming the original random sequence so snow placement stays stable.
      if (!snow && depth === "near") return landingDropMarkup(landings[index]);
      const shape = snow ? `<circle r="${size.toFixed(2)}"/>`
        : `<path d="M0 0l2 ${size.toFixed(1)}" stroke-width="${config.line}"/>`;
      return `<g class="${snow ? "city-snowflake" : "city-rain-drop"}${tier(index, totals)}"
        style="--particle-x:${x}px;--particle-top:${top}px;--particle-fall:${fall}px;--particle-drift:${drift.toFixed(1)}px;--particle-duration:${duration.toFixed(2)}s;--particle-delay:${delay}s;--particle-opacity:${config.opacity}">${shape}</g>`;
    }).join("");
  };
  // Foreground drops must remain visible until impact instead of fading above the road.
  const fade = ' mask="url(#city-weather-fade)"';
  return `<g class="city-weather city-weather-${depth}" clip-path="url(#city-weather-clip)"${depth === "near" ? "" : fade}>
    <g class="city-rain">${particles(false)}</g><g class="city-snow"${depth === "near" ? fade : ""}>${particles(true)}</g>
  </g>`;
}

export function cityRainGroundMarkup(seed: string, top: number): string {
  const ripples = rainLandings(seed, top).filter(landing => landing.ripple).map(landing => {
    return `<g transform="translate(${landing.x} ${landing.y})" class="${landing.className.trim()}" data-rain-index="${landing.index}">
      <ellipse class="city-ripple" rx="${landing.radius}" ry=".7"
        style="--particle-duration:${landing.duration}s;--particle-delay:${landing.delay}s"/>
    </g>`;
  }).join("");
  return `<g class="city-puddles">${[110, 386, 719, 1024, 1338].map((x, i) =>
    `<ellipse cx="${x}" cy="${i % 2 ? 365 : 388}" rx="${28 + i * 5}" ry="2.5"/>`).join("")}</g>
    <g class="city-rain city-rain-ground">${ripples}</g>`;
}
