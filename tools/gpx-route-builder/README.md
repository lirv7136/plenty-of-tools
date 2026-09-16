# GPX Route Builder & Personal Heatmap

Vanilla browser app using self-hosted Leaflet 1.9.4 and Leaflet.heat 0.2.0 (including simpleheat). Their BSD licences and SHA-256/source manifest are in `static/`. No build dependencies, accounts, GPX uploads, browser storage or geolocation.

Open GPX 1.0/1.1 tracks or routes, select activity overlays, inspect the recorded-point heatmap, and edit/export a route. Separate track/route segments stay separate for rendering, distance calculation and export. Elevation is preserved on copied points, and removed when a point is moved; timestamps are not exported. Distances use spherical haversine (mean Earth radius 6,371,008.8 m), without elevation adjustment. Longitude display is unwrapped across the antimeridian.

The route editor offers click-to-add, coordinate entry, draggable points, undo/redo (80 snapshots), reverse, close loop and new segments. Export creates a GPX 1.1 track; no snapping, geocoding, routing service or navigation instructions are involved. Heat intensity depends on sampling frequency and repeated nearby points, not time spent. Examples are fictional.

Limits: 20 files, 10 MiB per file, 50,000 total imported points, 500 editable points. GPX with only waypoints is rejected. Coordinates outside Web Mercator latitude ±85.05112878° or longitude ±180° are rejected explicitly. XML DTDs/entities, malformed XML and invalid coordinates are rejected. Multi-file imports are atomic: any invalid file leaves the existing activity set unchanged. Names render with textContent.

The default grid draws locally. Street tiles are fetched only after opting in, from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible attribution and standard browser caching/referrer behaviour. There is no tile prefetch, download or offline cache. Turning tiles off stops further tile requests; requests already sent cannot be recalled. Importing GPX while street tiles are enabled can change the visible area and thus trigger tile requests. Files themselves never leave the device. A loaded page works offline with the grid; first loading the site still requires its assets.

References: [GPX 1.1 schema](https://www.topografix.com/GPX/1/1/), [Leaflet](https://leafletjs.com/reference.html), [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat), [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

Validation:

```sh
python3 build.py
node --test tests/gpx-route-builder.test.cjs
# Serve dist at localhost:8765, then:
node tests/gpx-route-builder.browser.cjs
```
