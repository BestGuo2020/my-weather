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

// All distances are local SVG units. Rain and snow never use viewport heights
// or widths, and remain attached to the city when its layout or LCZ form changes.
export function cityWeatherMarkup(depth: WeatherDepth, seed: string, top: number): string {
  const random = seededRandom(`${seed}|weather|${depth}`);
  const config = depthConfig[depth];
  const fall = config.bottom - top;
  const particles = (snow: boolean) => {
    const totals = snow ? config.snow : config.rain;
    return Array.from({ length: totals[2] }, (_, index) => {
      const x = (random() * 1440).toFixed(1);
      const duration = (snow ? config.snowSeconds : config.rainSeconds) * (.82 + random() * .36);
      const delay = (-random() * duration).toFixed(2);
      const size = snow ? config.flake * (.7 + random() * .6) : 5 + random() * 5;
      const drift = snow ? 7 + random() * 15 : 12 + random() * 12;
      const shape = snow ? `<circle r="${size.toFixed(2)}"/>`
        : `<path d="M0 0l2 ${size.toFixed(1)}" stroke-width="${config.line}"/>`;
      return `<g class="${snow ? "city-snowflake" : "city-rain-drop"}${tier(index, totals)}"
        style="--particle-x:${x}px;--particle-top:${top}px;--particle-fall:${fall}px;--particle-drift:${drift.toFixed(1)}px;--particle-duration:${duration.toFixed(2)}s;--particle-delay:${delay}s;--particle-opacity:${config.opacity}">${shape}</g>`;
    }).join("");
  };
  return `<g class="city-weather city-weather-${depth}" clip-path="url(#city-weather-clip)" mask="url(#city-weather-fade)">
    <g class="city-rain">${particles(false)}</g><g class="city-snow">${particles(true)}</g>
  </g>`;
}

export function cityRainGroundMarkup(seed: string): string {
  const random = seededRandom(`${seed}|rain-ground`);
  const ripples = Array.from({ length: 12 }, (_, index) => {
    const x = (40 + random() * 1360).toFixed(1), y = (354 + random() * 38).toFixed(1);
    const duration = (.9 + random() * .8).toFixed(2), delay = (-random() * 2).toFixed(2);
    return `<g transform="translate(${x} ${y})" class="${tier(index, [4, 8, 12]).trim()}">
      <ellipse class="city-ripple" rx="${(3 + random() * 3).toFixed(1)}" ry="1.2"
        style="--ripple-duration:${duration}s;--ripple-delay:${delay}s"/>
    </g>`;
  }).join("");
  return `<g class="city-puddles">${[110, 386, 719, 1024, 1338].map((x, i) =>
    `<ellipse cx="${x}" cy="${i % 2 ? 365 : 388}" rx="${28 + i * 5}" ry="2.5"/>`).join("")}</g>
    <g class="city-rain city-rain-ground">${ripples}</g>`;
}
