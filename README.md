# My Weather

[简体中文](./README.zh-CN.md)

A lightweight, responsive weather page with animated weather scenes, multilingual UI, location-aware search, and ambiguity handling for places that share the same name.

![My Weather dashboard](./docs/images/weather-dashboard.png)

## Features

- Current temperature, weather condition, feels-like temperature, humidity, wind speed, and daily low/high
- Animated scenes for clear skies, clouds, rain, snow, thunderstorms, and mist
- Layered, rotating snowflakes with light, moderate, and heavy snowfall variants
- Day and night presentation based on the selected location
- Search powered by OpenWeather and Open-Meteo geocoding
- Disambiguation menu for places with identical names
- Relevance filtering that prioritizes exact place-name matches over fuzzy matches
- Browser geolocation with IP-based fallback
- Chinese, English, Spanish, French, and Japanese interfaces
- Synthesized weather ambience using the Web Audio API
- Fullscreen mode, responsive layout, and reduced-motion support
- Automatic weather refresh every 12 minutes

## Location Search

Enter a city or place name in the search field and press <kbd>Enter</kbd> or select the search button.

For more precise results, append a two-letter ISO country code:

```text
La Rinconada,CL
Northampton,GB
Longhua,CN
```

When several places match, the page displays their administrative region, country, and country code. Select the intended location before weather data is loaded.

![Location disambiguation menu](./docs/images/location-disambiguation.png)

OpenWeather returns at most five geocoding results, so the app supplements its results with Open-Meteo and removes duplicate or weakly related candidates. Weather conditions are fetched by the selected coordinates.

## Controls

| Control | Purpose |
| --- | --- |
| Search | Search for a city, district, or named place |
| Location | Use browser geolocation; falls back to an approximate IP location when needed |
| Language | Switch between Chinese, English, Spanish, French, and Japanese |
| Sound | Toggle synthesized weather ambience |
| Fullscreen | Enter or leave fullscreen mode |
| GitHub | Open the project repository |

Location and fullscreen features depend on browser support and permissions. IP-based positioning is approximate and may resolve to a nearby city.

## Getting Started

### Requirements

My Weather is a static website built with HTML, CSS, and JavaScript. **Node.js is not required to run or deploy the application.**

- Without Node.js, deploy the contents of `src/` directly to any static web server.
- Node.js 18 or newer and npm are only required when you want to generate the minified production files in `dist/`.
- Visitors only need a modern browser.

### Build an optimized version

```bash
npm install
npm run build
```

This step bundles and minifies the source files. The optimized site is generated in `dist/`.

If Node.js is unavailable, skip this step and use `src/` as the website root instead.

### Preview locally

```bash
npm run preview
```

Then open:

```text
http://127.0.0.1:4173/
```

The preview command serves the production build without caching. To preview the unbuilt source, serve `src/` with any static web server.

## OpenWeather API Key

The weather and OpenWeather geocoding requests use the `API_KEY` constant in `src/script.js`.

To use your own key:

1. Create an account at [OpenWeather](https://openweathermap.org/).
2. Generate an API key.
3. Replace the `API_KEY` value in `src/script.js`.
4. Rebuild the project with `npm run build`.

## Project Structure

```text
.
├── docs/
│   └── images/             # README screenshots
├── raw/                    # Original/reference implementation
├── src/
│   ├── index.html          # Page structure
│   ├── script.js           # Weather, geocoding, UI, audio, and effects
│   ├── style.css           # Layout, weather scenes, and responsive styles
│   └── tokens.css          # Design tokens
├── build.mjs               # Production build pipeline
├── package.json
├── README.md
└── README.zh-CN.md
```

The build pipeline uses:

- [esbuild](https://esbuild.github.io/) for JavaScript
- [Lightning CSS](https://lightningcss.dev/) for CSS
- [html-minifier-terser](https://github.com/terser/html-minifier-terser) for HTML

## Data Sources and Credits

- Weather data: [OpenWeather](https://openweathermap.org/)
- Geocoding: [OpenWeather](https://openweathermap.org/) and [Open-Meteo](https://open-meteo.com/)
- Design and development: [BestGuo2020](https://www.bestguo.top)

Open-Meteo geocoding data is based on GeoNames. Review each provider's attribution, rate-limit, and licensing requirements before deploying the project commercially.

## License

No license is currently declared in this repository. Unless a license is added, normal copyright restrictions apply.
