export type CityScale = "high" | "medium" | "low";

export interface UrbanForm {
  // Observed LCZ class for the local area, with a traceable data source.
  // Geocoding names, administrative levels and population are not morphology.
  lczClass: number;
  source: string;
  referenceYear?: number;
  sampleRadiusM?: number;
  sampleCount?: number;
  classShare?: number;
}

export interface CityPlace {
  lat: number;
  lon: number;
  name: string;
  searchName?: string;
  country: string;
  state?: string;
  featureCode?: string;
  population?: number;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  localNames?: Record<string, string>;
  urbanForm?: UrbanForm;
}

export interface CityProfile {
  scale: CityScale;
  reason: "lcz" | "default";
  density: "compact" | "open" | "sparse" | "mixed";
}

// LCZ 1/4: compact/open high-rise; 2/5: mid-rise; 3/6: low-rise.
// LCZ 7/8/9 are lightweight, large, and sparsely built low-rise forms.
// Industrial and natural classes have no unambiguous height tier here.
const lczBuildingScale: Partial<Record<number, CityScale>> = {
  1: "high", 2: "medium", 3: "low", 4: "high", 5: "medium", 6: "low",
  7: "low", 8: "low", 9: "low"
};

export function normalizeCityName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[\s'’.-]/g, "").replace(/市$/, "");
}

export function distanceKm(a: Pick<CityPlace, "lat" | "lon">, b: Pick<CityPlace, "lat" | "lon">): number {
  const radians = Math.PI / 180;
  const lat = Math.sin((b.lat - a.lat) * radians / 2);
  const lon = Math.sin((b.lon - a.lon) * radians / 2);
  const h = lat * lat + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * lon * lon;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function classifyCity(place: CityPlace): CityProfile {
  const form = place.urbanForm;
  if (form && Number.isInteger(form.lczClass) && typeof form.source === "string" && form.source.trim()) {
    const scale = lczBuildingScale[form.lczClass];
    if (scale) return { scale, reason: "lcz", density: form.lczClass <= 3 || form.lczClass === 7 ? "compact"
      : form.lczClass === 9 ? "sparse" : "open" };
  }
  // No building observations: use a generic illustrated street, not a guess
  // based on administrative rank, city name, country or population.
  return { scale: "medium", reason: "default", density: "mixed" };
}

export function fromOpenMeteo(place): CityPlace {
  return {
    lat: place.latitude, lon: place.longitude, name: place.name, searchName: place.name,
    country: place.country_code || "", state: place.admin1 || place.admin2 || "",
    featureCode: place.feature_code, population: place.population,
    admin1: place.admin1, admin2: place.admin2, admin3: place.admin3, admin4: place.admin4
  };
}

export function mergeCityMetadata(primary: CityPlace, supplement: CityPlace): CityPlace {
  const merged = { ...primary };
  for (const key of ["featureCode", "population", "admin1", "admin2", "admin3", "admin4", "urbanForm"] as const) {
    if (supplement[key] !== undefined && supplement[key] !== null) Object.assign(merged, { [key]: supplement[key] });
  }
  return merged;
}

export function mergePlaceSources(sources: CityPlace[][]): CityPlace[] {
  const places: CityPlace[] = [];
  for (const place of sources.flat()) {
    // Close coordinates and the same name identify a duplicate. Keep distant
    // namesakes even if their administrative labels happen to be identical.
    const names = [place.name, place.searchName].filter(Boolean).map(normalizeCityName);
    const existing = places.find(candidate => candidate.country === place.country
      && distanceKm(candidate, place) < 8
      && [candidate.name, candidate.searchName].filter(Boolean).some(name => names.includes(normalizeCityName(name))));
    if (existing) Object.assign(existing, mergeCityMetadata(existing, place));
    else places.push({ ...place });
  }
  return places;
}
