# RMS Call Tracker

A static Fire/EMS incident tracker backed by Firebase Authentication and Firestore.

## Files to publish

Upload all files in this folder to the root of the GitHub repository:

- `index.html` — incident entry, history, CSV import/export, and statistics
- `main.js` — application and Firebase logic
- `ems-dispositions.js` — shared EMS disposition options and formatting
- `styles.css` — shared interface styles
- `config.html` — configuration screen
- `kiosk.html` — read-only statistics display
- `icon.png` — application icon

If GitHub Pages is enabled for the repository, the main tracker opens at the site root. The supporting screens are available at `/config.html` and `/kiosk.html`.

## Firebase requirements

Anonymous Authentication must be enabled in the `pleasant-fire` Firebase project. Firestore must allow the intended users to access the `artifacts/pleasant-township-app/public/data` path.

The Firebase web configuration in these static files identifies the Firebase project; it is not an administrator secret. Access control must be enforced with Firebase Authentication and Firestore Security Rules.

Before public deployment, review the Firestore rules carefully. In particular, do not grant unrestricted public writes to incident or configuration data. If configuration changes should be limited to administrators, enforce that in Security Rules rather than relying on the unlinked `config.html` address.

## Deployment note

This version uses Tailwind's browser CDN to keep deployment file-only. It works on GitHub Pages, but the browser console will show Tailwind's production advisory. For a larger or long-term deployment, the next maintenance step should be compiling Tailwind into a local minified stylesheet so the app is less dependent on third-party CDNs.

## CSV format

Imports expect these columns in this order:

`Incident #, Date/Time, Nature, Address, Type, Units, Mutual Aid, Disposition, Notes`

EMS and Both calls allow multiple dispositions. Select all that apply in the new-call or edit form. Multiple selections use a semicolon in the existing Disposition column, for example `TRANSPORT; 2ND RUN`. Older single-disposition records remain supported. Filters match any selected disposition; disposition statistics count each selection, while crew totals count each incident once.

Date/time values must use `MM/DD/YYYY HH:MM` with 24-hour time. Incident numbers must follow `YYPL#####` or `YYHT#####`. Invalid rows are skipped and counted in the confirmation message.

## Verification

Run `node --test tests/ems-dispositions.test.mjs` for disposition compatibility and text/CSV formatting checks.

Run `node tests/ems-dispositions.browser.cjs` with Playwright available to Node and Microsoft Edge installed for the browser workflow checks. Set `PLAYWRIGHT_CHANNEL` to use another installed Chromium channel. These checks substitute sample data for Firebase, exercise creation, editing, validation, filters, CSV export/import, and both statistics screens, and never write to the live database.
