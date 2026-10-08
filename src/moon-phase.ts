import { getMoonIllumination, getMoonPosition } from "suncalc";

const phaseNames = ["new", "waxing-crescent", "first-quarter", "waxing-gibbous",
  "full", "waning-gibbous", "last-quarter", "waning-crescent"] as const;

export interface MoonProfile {
  phase: number;
  fraction: number;
  waxing: boolean;
  rotation: number;
  name: typeof phaseNames[number];
}

export function moonProfile(date: Date = new Date(), coordinates?: { lat: number; lon: number }): MoonProfile {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid moon date");
  const illumination = getMoonIllumination(date);
  const fraction = Math.max(0, Math.min(1, illumination.fraction));
  const phase = ((illumination.phase % 1) + 1) % 1;
  let rotation = illumination.waxing ? 0 : 180;
  if (coordinates && Number.isFinite(coordinates.lat) && Math.abs(coordinates.lat) <= 90
      && Number.isFinite(coordinates.lon) && Math.abs(coordinates.lon) <= 180) {
    const position = getMoonPosition(date, coordinates.lat, coordinates.lon);
    // SunCalc v2 uses degrees, anticlockwise from the zenith. SVG uses clockwise
    // degrees; our unrotated bright limb points right (90 degrees from the zenith).
    rotation = -(illumination.angle - position.parallacticAngle) - 90;
  }
  rotation = ((rotation % 360) + 540) % 360 - 180;
  return { phase, fraction, waxing: illumination.waxing, rotation,
    name: phaseNames[Math.round(phase * 8) % 8] };
}

export function moonLitPath(fraction: number): string {
  if (!Number.isFinite(fraction)) throw new RangeError("Invalid moon illumination");
  const lit = Math.max(0, Math.min(1, fraction));
  if (lit === 0) return "";
  // An elliptical terminator gives the requested projected illuminated area,
  // from a thin crescent through a straight quarter to a gibbous/full disk.
  const radius = Number((48 * Math.abs(1 - 2 * lit)).toFixed(4));
  const terminator = radius === 0 ? "L50 2" : `A${radius} 48 0 0 ${lit < .5 ? 0 : 1} 50 2`;
  return `M50 2A48 48 0 0 1 50 98${terminator}Z`;
}

export function moonDiscMarkup(profile: MoonProfile): string {
  return `<svg class="moon-disc" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <circle class="moon-dark" cx="50" cy="50" r="48"/>
    <path class="moon-light" d="${moonLitPath(profile.fraction)}" transform="rotate(${profile.rotation.toFixed(3)} 50 50)"/>
  </svg>`;
}

export function renderMoonPhase(containers: HTMLElement[], profile: MoonProfile): void {
  const key = `${profile.fraction.toFixed(5)}|${profile.rotation.toFixed(2)}`;
  const markup = moonDiscMarkup(profile);
  for (const container of containers) {
    container.dataset.moonPhase = profile.name;
    container.dataset.moonFraction = profile.fraction.toFixed(5);
    if (container.dataset.moonKey === key) continue;
    container.dataset.moonKey = key;
    container.innerHTML = markup;
  }
}
