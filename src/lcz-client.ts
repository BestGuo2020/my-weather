import type { UrbanForm } from "./city-profile";

type Lookup = (lat: number, lon: number, signal: AbortSignal) => Promise<UrbanForm | null>;
export function createLczClient(loadLookup: () => Promise<Lookup> = async () => (await import("./lcz-data")).lookupLcz) {
  const cache = new Map<string, { value: UrbanForm | null; expires: number }>();
  return {
    async read(lat: number, lon: number, signal: AbortSignal): Promise<UrbanForm | null> {
      if (signal.aborted) return null;
      const key = `${lat.toFixed(4)}|${lon.toFixed(4)}`;
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) return cached.value;
      const lookup = await loadLookup();
      if (signal.aborted) return null;
      const value = await lookup(lat, lon, signal);
      if (!signal.aborted) {
        if (cache.size >= 128) cache.delete(cache.keys().next().value);
        cache.set(key, { value, expires: Date.now() + (value ? 24 * 3600 * 1000 : 60 * 1000) });
      }
      return signal.aborted ? null : value;
    }
  };
}
