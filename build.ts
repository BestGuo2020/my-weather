import { rm, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build as buildJavaScript } from "esbuild";
import { bundle as bundleCss } from "lightningcss";
import { minify as minifyHtml } from "html-minifier-terser";

const rootDir = resolve(import.meta.dirname);
const sourceDir = resolve(rootDir, "src");
const outputDir = resolve(rootDir, "dist");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await Promise.all([
  buildJavaScript({
    entryPoints: [resolve(sourceDir, "script.ts")],
    outfile: resolve(outputDir, "script.js"),
    bundle: true,
    minify: true,
    legalComments: "none",
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
  copyFile(resolve(sourceDir, "sitemap.xml"), resolve(outputDir, "sitemap.xml")),
  copyFile(resolve(sourceDir, "favicon.png"), resolve(outputDir, "favicon.png")),
  copyFile(resolve(sourceDir, "github-svgrepo-com.svg"), resolve(outputDir, "github-svgrepo-com.svg"))
]);

console.log(`Build complete: ${outputDir}`);
