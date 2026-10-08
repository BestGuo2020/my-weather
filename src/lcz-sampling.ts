import type { UrbanForm } from "./city-profile";

export const LCZ_SOURCE = "https://zenodo.org/records/8419340";
export const LCZ_REFERENCE_YEAR = 2018;
export const LCZ_SAMPLE_RADIUS_M = 500;

export interface RasterGrid {
  width: number;
  height: number;
  origin: number[];
  resolution: number[];
}

export interface SampleWindow {
  window: [number, number, number, number];
  centreX: number;
  centreY: number;
  metresX: number;
  metresY: number;
}

export function lczSampleWindow(lat: number, lon: number, grid: RasterGrid): SampleWindow | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const [originX, originY] = grid.origin, [resolutionX, resolutionY] = grid.resolution;
  if (!(resolutionX > 0) || !(resolutionY < 0)) throw new Error("Unsupported LCZ grid orientation");
  const centreX = (lon - originX) / resolutionX - .5;
  const centreY = (lat - originY) / resolutionY - .5;
  if (centreX < -.5 || centreY < -.5 || centreX >= grid.width - .5 || centreY >= grid.height - .5) return null;
  const metresX = resolutionX * 111320 * Math.cos(lat * Math.PI / 180);
  const metresY = Math.abs(resolutionY) * 111320;
  if (!(metresX > 0) || !(metresY > 0)) return null;
  const dx = Math.ceil(LCZ_SAMPLE_RADIUS_M / metresX), dy = Math.ceil(LCZ_SAMPLE_RADIUS_M / metresY);
  return { centreX, centreY, metresX, metresY, window: [
    Math.max(0, Math.floor(centreX) - dx), Math.max(0, Math.floor(centreY) - dy),
    Math.min(grid.width, Math.ceil(centreX) + dx + 1), Math.min(grid.height, Math.ceil(centreY) + dy + 1)
  ] };
}

export function summarizeLcz(values: ArrayLike<number>, sample: SampleWindow): UrbanForm | null {
  const [left, top, right, bottom] = sample.window;
  const width = right - left;
  if (values.length !== width * (bottom - top)) throw new Error("Unexpected LCZ sample size");
  const counts = new Array<number>(18).fill(0);
  let total = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (Math.hypot((x - sample.centreX) * sample.metresX, (y - sample.centreY) * sample.metresY) > LCZ_SAMPLE_RADIUS_M) continue;
      const value = Number(values[(y - top) * width + x - left]);
      if (!Number.isInteger(value) || value < 1 || value > 17) continue;
      counts[value] += 1;
      total += 1;
    }
  }
  if (!total) return null;
  // Preserve natural cover: do not turn a predominantly water/forest region
  // into a high-rise city merely because a few nearby pixels contain buildings.
  const built = counts.slice(1, 11).reduce((sum, count) => sum + count, 0);
  const classes = built > total / 2 ? Array.from({ length: 10 }, (_, i) => i + 1)
    : Array.from({ length: 7 }, (_, i) => i + 11);
  const centreIndex = Math.round(sample.centreY - top) * width + Math.round(sample.centreX - left);
  const centreClass = Number(values[centreIndex]);
  const lczClass = classes.sort((a, b) => counts[b] - counts[a]
    || Number(b === centreClass) - Number(a === centreClass) || a - b)[0];
  return { lczClass, source: LCZ_SOURCE, referenceYear: LCZ_REFERENCE_YEAR,
    sampleRadiusM: LCZ_SAMPLE_RADIUS_M, sampleCount: total, classShare: counts[lczClass] / total };
}
