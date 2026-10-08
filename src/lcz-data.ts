import { fromUrl, type GeoTIFFImage } from "geotiff";
import { lczSampleWindow, summarizeLcz } from "./lcz-sampling";
import type { UrbanForm } from "./city-profile";

let imagePromise: Promise<GeoTIFFImage> | null = null;

async function openRaster(): Promise<GeoTIFFImage> {
  if (!imagePromise) {
    imagePromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        // v3's factory declaration omits the documented blocked-source fields;
        // the remote-source implementation accepts them and bounds its cache.
        const remoteOptions = { allowFullFile: false, maxRanges: 0, blockSize: 65536, cacheSize: 32 };
        const tiff = await fromUrl("/api/lcz-raster", remoteOptions, controller.signal);
        const image = await tiff.getImage();
        if (image.getGeoKeys()?.GeographicTypeGeoKey !== 4326 || image.getSamplesPerPixel() !== 1) {
          throw new Error("Unexpected LCZ raster metadata");
        }
        return image;
      } finally { clearTimeout(timeout); }
    })().catch(error => { imagePromise = null; throw error; });
  }
  return imagePromise;
}

export async function lookupLcz(lat: number, lon: number, signal: AbortSignal): Promise<UrbanForm | null> {
  if (signal.aborted) throw new Error("LCZ request aborted");
  const image = await openRaster();
  if (signal.aborted) throw new Error("LCZ request aborted");
  const sample = lczSampleWindow(lat, lon, {
    width: image.getWidth(), height: image.getHeight(), origin: image.getOrigin(), resolution: image.getResolution()
  });
  if (!sample) return null;
  const values = await image.readRasters({ window: sample.window, samples: [0], interleave: true, signal });
  return summarizeLcz(values as ArrayLike<number>, sample);
}
