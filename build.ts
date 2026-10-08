import { rm, mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build as buildJavaScript } from "esbuild";
import { bundle as bundleCss } from "lightningcss";
import { minify as minifyHtml } from "html-minifier-terser";

const rootDir = resolve(import.meta.dirname);
const sourceDir = resolve(rootDir, "src");
const outputDir = resolve(rootDir, "dist");

// Windows previews can hold dist as their working directory. Keep the directory
// itself and clean its generated contents so a running preview can be rebuilt.
await mkdir(outputDir, { recursive: true });
const generatedPaths = (await readdir(outputDir)).map(name => resolve(outputDir, name));
if (generatedPaths.some(path => dirname(path) !== outputDir)) throw new Error("Invalid build output path");
await Promise.all(generatedPaths.map(path => rm(path, { recursive: true, force: true })));

await Promise.all([
  buildJavaScript({
    entryPoints: [resolve(sourceDir, "script.ts")],
    outdir: outputDir,
    format: "esm",
    splitting: true,
    chunkNames: "chunks/[name]-[hash]",
    bundle: true,
    minify: true,
    legalComments: "linked",
    charset: "utf8",
    target: ["es2020"]
  }),

  (async () => {
    const result = bundleCss({
      filename: resolve(sourceDir, "style.css"),
      minify: true,
      sourceMap: false,
      targets: {
        chrome: 80 << 16,
        firefox: 78 << 16,
        safari: 14 << 16
      }
    });
    await writeFile(resolve(outputDir, "style.css"), result.code);
  })(),

  (async () => {
    const html = await readFile(resolve(sourceDir, "index.html"), "utf8");
    const minified = await minifyHtml(html, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: false,
      sortAttributes: true,
      sortClassName: true,
      useShortDoctype: true
    });
    await writeFile(resolve(outputDir, "index.html"), minified, "utf8");
  })(),

  copyFile(resolve(sourceDir, "robots.txt"), resolve(outputDir, "robots.txt")),
  copyFile(resolve(sourceDir, "location-test.html"), resolve(outputDir, "location-test.html")),
  copyFile(resolve(sourceDir, "sitemap.xml"), resolve(outputDir, "sitemap.xml")),
  copyFile(resolve(sourceDir, "favicon.png"), resolve(outputDir, "favicon.png")),
  copyFile(resolve(sourceDir, "github-svgrepo-com.svg"), resolve(outputDir, "github-svgrepo-com.svg")),
  copyFile(resolve(rootDir, "node_modules/geotiff/LICENSE"), resolve(outputDir, "geotiff-license.txt"))
]);

console.log(`Build complete: ${outputDir}`);
