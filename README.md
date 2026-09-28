# Stillwater Fishing Radar

Stillwater is a mobile-first freshwater fishing companion for the United States and Mexico. It combines point weather forecasts with transparent, evidence-informed rules to suggest bite windows, casting zones, and presentations for bass, carp, catfish, and bluegill.

Recommendations are planning aids—not biological surveys, safety advice, or guarantees of catches. The app does not claim a species is present at a selected water.

## Run locally

Double-click **Open Stillwater.command**, or run:

```bash
cd "/Users/bennysmacbook/Documents/Doodle"
python3 -m http.server 4173
```

Open <http://127.0.0.1:4173/FishingRadar.html>. A local HTTP server is required for the service worker; `file://` is unsupported.

## Automated checks

The deterministic scoring checks have no package dependencies:

```bash
node tests/scoring.test.mjs
```

They cover score bounds, confidence bands, activity grades, and representative calm/sunny versus windy/cloudy lure rankings.

## Architecture

- `FishingRadar.html` — semantic application shell
- `app.js` — current map, storage, weather, scoring, and UI orchestration
- `pwa.js`, `service-worker.js`, `manifest.webmanifest` — installation, updates, caching, and offline shell
- `styles.css` plus feature CSS files — responsive presentation
- `icons/` — product-owned vector application icon

The next maintainability phase should extract `app.js` into ES modules for map, weather, species, scoring, lure data, storage, localization, and UI. This phase avoids a risky rewrite while establishing schemas and reliability boundaries.

## Data sources and privacy

- Weather: Open-Meteo forecast API.
- Map/search: OpenStreetMap tiles and Nominatim search.
- Recommendations: transparent heuristic rules based on general freshwater angling knowledge. Scores are computed, not scientific probabilities.
- Water temperature is not measured in this version; references are estimates and labeled accordingly.

Saved waters, preferences, and cached forecasts remain in browser storage. Exact saved coordinates are not sent to analytics. A selected coordinate is sent to Open-Meteo for its requested forecast; map and search requests contact their stated providers.

## Offline and deployment

The installable PWA precaches its shell and runtime-caches successful weather/search responses. New forecasts, searches, and uncached map tiles require connectivity. Deploy cheaply as a static HTTPS site with Cloudflare Pages, GitHub Pages, or Netlify. For commercial scale, replace public Nominatim and public tile endpoints with a compliant hosted or self-hosted provider.

See `PRIVACY.md`, `TERMS.md`, and `DATA_SOURCES.md`. These require legal review before a paid release.
