# AidPoint

AidPoint helps dispatchers and fire/EMS personnel find the nearest mutual aid resources to an incident location.

Double-click **Start AidPoint.cmd** to open AidPoint in your browser. Keep the launcher window open while using the app. Node.js is required and is already installed on this computer.

Update `fd.addresses.csv` in this directory whenever needed, then refresh the browser page. The app reads the current file on every page load with caching disabled.

The map highlights Clark County with a blue outline, a white halo, and a very light blue fill. `clark-county-boundary.geojson` contains the official [U.S. Census Bureau county boundary](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1) (January 1, 2026 vintage; GEOID 39023). The supplied township file contains ten individual township boundaries; the county layer avoids displaying internal township or municipal edges as the county border. The outline stays on the map when searches are cleared.

The street-address field includes guidance to enter the street address first and add the city if the correct location is not found.

The launcher starts a server accessible only on this computer. It serves the HTML, CSV, app icons, and app manifest. Browsers require this to automatically read the CSV; opening `index.html` directly displays instructions to use the launcher. Google Sheets and embedded station copies are no longer used.

CSV columns must be `department,address,coordinates`. Quote any address containing commas, and quote coordinates as `"latitude,longitude"`. Invalid or missing coordinates are skipped.

An internet connection is still needed for the map, browser libraries, address lookup, and driving estimates.

The app includes an iPhone Home Screen icon and Android icons, including an adaptive icon, with the name **AidPoint**. The app manifest requests a standalone window. See `icon-design.md` for the artwork prompt and platform references. Deploy the HTML, CSV, county boundary GeoJSON, manifest, and three icon PNG files together when hosting the app.

For phone use, AidPoint needs a phone-accessible web address; the desktop launcher address is limited to this computer. Use HTTPS when hosting it for installation. Home Screen metadata does not provide offline maps or routing, and no service worker caches station data.

A small **Visits** badge appears at the bottom of the search panel. It uses [Hits](https://github.com/silentsoft/hits) to store a shared hit total, so it works on GitHub Pages without a server or account setup. It starts counting when added; it cannot recover past visits and is a hit estimate, not a count of unique people. Localhost previews use a separate preview counter. If the badge cannot load, it stays hidden and searches continue normally. Only the fixed site identifier is used; incident addresses are not part of the counter request, and the badge sends no page referrer.

For the hosted site, upload the updated `index.html` to the GitHub repository and let its normal deployment finish. No additional counter files are needed. Counter statistics are available at [Hits: AidPoint](https://hits.sh/615it.com/aidpoint/).

Run the behavior checks with `node --test tests/station-locator.test.cjs`. These checks use mocked browser libraries and network responses; they do not verify live external services.
