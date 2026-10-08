import { classifyCity, type CityPlace, type CityScale, type CityProfile } from "./city-profile";
import { cityWeatherMarkup, cityRainGroundMarkup } from "./city-weather";

const scales = {
  high: { min: 112, max: 280, width: 52, gap: 12, cars: 5, people: 5 },
  medium: { min: 65, max: 162, width: 70, gap: 16, cars: 4, people: 4 },
  low: { min: 34, max: 78, width: 88, gap: 24, cars: 3, people: 3 }
};

function randomFor(seed: string) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function buildings(scale: CityScale, random: () => number, distant: boolean, density: CityProfile["density"], lczClass?: number): string {
  const config = scales[scale];
  const baseline = distant ? 306 : 328;
  let markup = "";
  for (let x = -30; x < 1480;) {
    const width = Math.round((lczClass === 8 ? 140 : config.width) * (.7 + random() * .7));
    const height = Math.round((config.min + random() * (config.max - config.min)) * (distant ? .8 : 1));
    const y = baseline - height;
    const pitched = scale === "low" && lczClass !== 8 && random() > .35;
    markup += `<g class="city-building ${distant ? "building-far" : "building-near"}">
      <rect class="building-wall" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"/>
      <rect class="building-side" x="${x + width - 10}" y="${y}" width="10" height="${height}"/>
      <path class="building-roof" d="M${x - 2} ${y} ${pitched ? `L${x + width / 2} ${y - 17} L${x + width + 2} ${y}Z` : `h${width + 4}v4h-${width + 4}Z`}"/>`;
    if (!distant) {
      for (let wy = y + 13; wy < baseline - 14; wy += 17) {
        for (let wx = x + 9; wx < x + width - 14; wx += 15) {
          markup += `<rect class="building-window${random() > .66 ? " window-lit" : ""}" x="${wx}" y="${wy}" width="6" height="8" rx=".7"/>`;
        }
      }
      if (scale === "high" && height > 220) {
        markup += `<path class="building-antenna" d="M${x + width / 2} ${y}v-22"/>`;
      }
      markup += `<rect class="building-door" x="${x + width / 2 - 5}" y="${baseline - 17}" width="10" height="17"/>`;
      if (scale !== "high" && lczClass !== 8) {
        markup += `<path class="shop-awning" d="M${x + 5} ${baseline - 21}h${width - 17}l4 7h-${width - 9}Z"/>`;
      }
    }
    markup += "</g>";
    const gap = density === "compact" ? 4 : density === "open" ? 32 : density === "sparse" ? 78 : config.gap;
    x += width + gap + random() * 12;
  }
  return markup;
}

function tree(x: number, size: number): string {
  return `<g transform="translate(${x} 342) scale(${size})">
    <ellipse class="street-shadow" cx="0" cy="0" rx="23" ry="4"/>
    <path class="tree-trunk" d="M-3 0v-49h6V0Z"/>
    <g class="tree-crown"><ellipse class="tree-leaf" cx="0" cy="-57" rx="21" ry="29"/>
      <ellipse class="tree-leaf" cx="-12" cy="-48" rx="17" ry="21"/>
      <ellipse class="tree-leaf tree-leaf-light" cx="11" cy="-60" rx="15" ry="22"/>
      <path class="tree-snow" d="M-20-63Q-12-88 3-86Q19-82 21-64Q9-70 0-68Q-12-73-20-63Z"/>
    </g>
  </g>`;
}

function lamp(x: number): string {
  return `<g transform="translate(${x} 343)"><path class="street-pole" d="M0 0v-82q0-9 9-9h16"/>
    <ellipse class="lamp-glow" cx="23" cy="-78" rx="39" ry="28"/>
    <path class="lamp-housing" d="M14-93h22l5 6H10Z"/>
    <path class="lamp-light" d="M14-87h22v3H14Z"/></g>`;
}

function car(index: number): string {
  const reverse = index % 2 === 1;
  // Keep each lane's speed constant so its staggered cars never catch one another.
  const duration = reverse ? 31 : 24;
  const size = reverse ? .9 : .78;
  return `<g class="city-car car-${index % 3}${reverse ? " car-reverse" : ""}" style="--travel-duration:${duration}s;--travel-delay:-${duration * (.12 + index * .16)}s;--park-x:${180 + index * 260}px">
    <g transform="translate(0 ${reverse ? 394 : 359}) scale(${reverse ? -size : size} ${size})">
      <ellipse class="street-shadow" cx="0" cy="1" rx="38" ry="5"/>
      <path class="car-body" d="M-33-6v-9q0-5 6-5h7l9-12h22l13 12h8q7 0 7 7v7Z"/>
      <path class="car-glass" d="M-16-21l7-9h9v9Zm20 0v-9h6l10 9Z"/>
      <rect class="car-headlight" x="31" y="-17" width="7" height="5" rx="1"/>
      <rect class="car-taillight" x="-34" y="-17" width="4" height="5" rx="1"/>
      <path class="headlight-beam" d="M38-17l87-7v24L38-12Z"/>
      <g class="car-wheel"><circle cx="-21" cy="-6" r="7"/><circle cx="24" cy="-6" r="7"/></g>
      <g class="wheel-hub"><circle cx="-21" cy="-6" r="3"/><circle cx="24" cy="-6" r="3"/></g>
    </g>
  </g>`;
}

function pedestrian(index: number): string {
  const reverse = index % 2 === 1;
  const duration = 100 + index * 17;
  // A full gait advances 20 SVG units over the 1640-unit city-travel route.
  const walkDuration = duration * 20 / 1640;
  const walkDelay = -walkDuration * (.12 + index * .31);
  const leg = (side: "front" | "back") => `<g class="person-leg person-limb-${side}" transform="translate(${side === "front" ? .8 : -.8} -9.8)">
    <g class="person-thigh"><path class="person-limb" d="M0 0v5.6"/>
      <g transform="translate(0 5.6)"><g class="person-shin"><path class="person-limb" d="M0 0v5.6"/>
        <g transform="translate(0 5.6)"><g class="person-foot"><path class="person-shoe" d="M-1 0h3"/></g></g>
      </g></g>
    </g>
  </g>`;
  const arm = (side: "front" | "back") => `<g class="person-arm-${side} person-limb-${side}" transform="translate(0 -21)">
    <g class="person-arm-swing">
      <g class="person-arm-walking"><path class="person-limb" d="M0 0l.5 4.5 1.8 4"/><circle class="person-skin" cx="2.3" cy="8.5" r="1.1"/></g>
      ${side === "front" ? '<g class="person-arm-holding"><path class="person-limb" d="M0 0l4 4-4 2"/><circle class="person-skin" cx="0" cy="6" r="1.1"/></g>' : ""}
    </g>
  </g>`;
  return `<g class="city-person${reverse ? " person-reverse" : ""}" style="--travel-duration:${duration}s;--travel-delay:-${duration * (.16 + index * .18)}s;--park-x:${265 + index * 215}px;--walk-duration:${walkDuration}s;--walk-delay:${walkDelay}s;--walk-opposite-delay:${walkDelay - walkDuration / 2}s">
    <g transform="translate(0 340) scale(${reverse ? -1 : 1} 1)">
      <ellipse class="street-shadow person-walk-shadow" cx="0" cy="2" rx="9" ry="2"/>
      <g class="person-body">
        ${arm("back")}${leg("back")}${leg("front")}
        <circle class="person-skin" cx=".7" cy="-27" r="3.5"/>
        <path class="person-skin" d="M3-28l2 2H3Z"/>
        <path class="person-coat" d="M-3-21q4-3 8 0l-1 12H-4Z"/>
        ${arm("front")}
        <g class="person-umbrella"><path class="umbrella-canopy" d="M-14-31q14-20 28 0q-5-4-9 0q-5-4-9 0q-5-4-10 0Z"/>
          <path class="umbrella-handle" d="M0-32v19q0 4 4 2"/></g>
      </g>
    </g>
  </g>`;
}

export function citySceneMarkup(scale: CityScale, seed: string, density: CityProfile["density"] = "mixed", lczClass?: number): string {
  const random = randomFor(seed);
  const config = scales[scale];
  const carIndices = Array.from({ length: config.cars }, (_, i) => i);
  const weatherTop = scale === "high" ? 24 : scale === "medium" ? 118 : 204;
  return `<svg class="city-panorama" viewBox="0 0 1440 430" preserveAspectRatio="xMidYMax slice" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="city-weather-clip"><rect x="0" y="${weatherTop}" width="1440" height="${392 - weatherTop}"/></clipPath>
      <linearGradient id="city-weather-gradient" x1="0" y1="${weatherTop}" x2="0" y2="392" gradientUnits="userSpaceOnUse">
        <stop stop-color="white" stop-opacity="0"/><stop offset=".14" stop-color="white"/>
        <stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <mask id="city-weather-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="430">
        <rect width="1440" height="430" fill="url(#city-weather-gradient)"/>
      </mask>
    </defs>
    <g class="city-haze"><path d="M0 309Q180 270 360 290T720 281T1080 288T1440 273V430H0Z"/></g>
    ${cityWeatherMarkup("far", seed, weatherTop)}
    <g class="city-distant">${buildings(scale, random, true, density, lczClass)}</g>
    ${cityWeatherMarkup("mid", seed, weatherTop)}
    <g class="city-near">${buildings(scale, random, false, density, lczClass)}</g>
    <path class="city-ground" d="M0 325H1440V430H0Z"/>
    <path class="city-sidewalk" d="M0 332H1440V349H0Z"/>
    <path class="sidewalk-edge" d="M0 348H1440"/>
    <path class="city-road" d="M0 352H1440V402H0Z"/>
    <path class="road-marking" d="M0 376H1118m68 0H1440"/>
    <path class="road-edge" d="M0 398H1440"/>
    <path class="road-crossing" d="M1127 357h50m-50 9h50m-50 9h50m-50 9h50m-50 9h50"/>
    <g class="road-reflection"><path d="M120 389h190m290-28h150m210 26h180"/></g>
    ${cityRainGroundMarkup(seed)}
    ${cityWeatherMarkup("near", seed, weatherTop)}
    <g class="street-furniture">${[84, 354, 650, 980, 1260].map(x => lamp(x)).join("")}
      <g transform="translate(843 344)"><path class="street-pole" d="M0 0v-63"/>
        <path class="street-sign" d="M-30-64H24l10 10-10 10H-30Z"/>
        <path class="sign-arrow" d="M-19-54h38m-6-5 6 5-6 5"/>
      </g>
      <g transform="translate(1100 344)"><path class="street-pole" d="M0 0v-61"/>
        <rect class="traffic-housing" x="-6" y="-73" width="13" height="31" rx="4"/>
        <circle class="traffic-red" cx=".5" cy="-65" r="3"/>
        <circle class="traffic-amber" cx=".5" cy="-57" r="3"/>
        <circle class="traffic-green" cx=".5" cy="-49" r="3"/>
      </g>
    </g>
    <g class="city-people">${Array.from({ length: config.people }, (_, i) => pedestrian(i)).join("")}</g>
    <g class="city-trees">${(density === "compact" ? [228, 913] : [30, 228, 500, 738, 913, 1207, 1393]).map((x, i) => tree(x, .75 + i % 3 * .13)).join("")}</g>
    <g class="city-traffic">
      <g class="traffic-lane-far">${carIndices.filter(i => i % 2 === 0).map(car).join("")}</g>
      <g class="traffic-lane-near">${carIndices.filter(i => i % 2 === 1).map(car).join("")}</g>
    </g>
    <path class="street-snow" d="M0 329H1440v4H0Zm0 18H1440v3H0Z"/>
  </svg>`;
}

export function renderCityScene(container: HTMLElement, place: CityPlace): void {
  const profile = classifyCity(place);
  const seed = `${place.country}|${place.lat.toFixed(2)}|${place.lon.toFixed(2)}`;
  const lczClass = profile.reason === "lcz" ? place.urbanForm.lczClass : undefined;
  const key = `${profile.scale}|${profile.density}|${lczClass || ""}|${seed}`;
  document.body.dataset.cityScale = profile.scale;
  container.dataset.cityReason = profile.reason;
  container.dataset.cityDensity = profile.density;
  container.dataset.lczClass = String(place.urbanForm?.lczClass || "");
  container.dataset.lczSource = place.urbanForm?.source || "";
  container.dataset.lczYear = String(place.urbanForm?.referenceYear || "");
  if (container.dataset.sceneKey === key) return;
  container.dataset.sceneKey = key;
  // Only generated numbers and static shapes enter SVG; API-provided names never enter HTML.
  container.innerHTML = citySceneMarkup(profile.scale, seed, profile.density, lczClass);
}
