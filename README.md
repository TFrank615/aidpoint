# AidPoint

AidPoint helps dispatchers and fire/EMS personnel find the nearest mutual aid resources to an incident location.

Double-click **Start AidPoint.cmd** to open AidPoint in your browser. Keep the launcher window open while using the app. Node.js is required and is already installed on this computer.

Update `fd.addresses.csv` in this directory whenever needed, then refresh the browser page. The app reads the current file on every page load with caching disabled.

The launcher starts a server accessible only on this computer. It serves the HTML, CSV, app icons, and app manifest. Browsers require this to automatically read the CSV; opening `index.html` directly displays instructions to use the launcher. Google Sheets and embedded station copies are no longer used.

CSV columns must be `department,address,coordinates`. Quote any address containing commas, and quote coordinates as `"latitude,longitude"`. Invalid or missing coordinates are skipped.

An internet connection is still needed for the map, browser libraries, address lookup, and driving estimates.

The app includes an iPhone Home Screen icon and Android icons, including an adaptive icon, with the name **AidPoint**. The app manifest requests a standalone window. See `icon-design.md` for the artwork prompt and platform references. Deploy the HTML, CSV, manifest, and three icon PNG files together when hosting the app.

For phone use, AidPoint needs a phone-accessible web address; the desktop launcher address is limited to this computer. Use HTTPS when hosting it for installation. Home Screen metadata does not provide offline maps or routing, and no service worker caches station data.

Run the behavior checks with `node --test tests/station-locator.test.cjs`. These checks use mocked browser libraries and network responses; they do not verify live external services.
