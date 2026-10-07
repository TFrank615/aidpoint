const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const csv = fs.readFileSync(path.join(__dirname, '../fd.addresses.csv'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = (body, status = 200) => ({ ok: status === 200, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) });

// External browser libraries and DOM are mocked; execute the app's actual event handlers.
function boot({ protocol = 'http:', fetch = async () => { throw new Error('Unexpected request'); }, stationFetch = async () => response(csv), parse } = {}) {
    const elements = new Map();
    function element(id = '') {
        const classes = new Set();
        const node = {
            value: '', disabled: id === 'search-button', files: [], textContent: '', style: {}, children: [], events: {},
            classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
            addEventListener(name, callback) { this.events[name] = callback; },
            appendChild(child) { this.children.push(child); },
            set innerHTML(value) { this.markup = value; this.children = []; },
            get innerHTML() { return this.markup || ''; }
        };
        return node;
    }
    const document = {
        addEventListener(name, callback) { this.ready = callback; },
        getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
        createElement: () => element(), createDocumentFragment: () => element()
    };
    const map = { setView() { return this; }, fitBounds() {}, removeLayer() {} };
    const L = {
        map: () => map, tileLayer: () => ({ addTo() {} }), divIcon: options => options,
        marker: location => ({ addTo() { return this; }, bindPopup() { return this; }, openPopup() { return this; }, getLatLng: () => ({ lat: location[0], lng: location[1] }) })
    };
    const Papa = { parse: parse || ((source, options) => {
        // Fixture adapter for these station files; PapaParse's CSV implementation is outside this test.
        const lines = source.trim().split(/\r?\n/);
        const fields = lines.shift().split(',').map(options.transformHeader);
        const data = lines.filter(line => line.trim()).map(line => {
            const match = line.match(/^([^,]*),"(.*)","(.*)"$/);
            if (!match) throw new Error('Invalid test fixture');
            return Object.fromEntries(fields.map((field, index) => [field, match[index + 1]]));
        });
        return { data, meta: { fields }, errors: [] };
    }) };
    vm.runInNewContext(code, { document, window: { location: { protocol } }, L, Papa, fetch: (url, options) => url === './fd.addresses.csv' ? stationFetch(url, options) : fetch(url, options), AbortController, setTimeout, clearTimeout, console: { error() {}, warn() {} } });
    document.ready();
    return { get: id => document.getElementById(id), elements };
}

test('there is no upload control, Google Sheets URL, or embedded station copy', () => {
    assert.doesNotMatch(html, /station-file-input|bundled-station-csv|docs\.google\.com|loadSelectedStationFile/);
});

test('opening HTML directly explains how to load the local CSV', () => {
    const app = boot({ protocol: 'file:' });
    assert.equal(app.get('search-button').disabled, true);
    assert.match(app.get('status-message').textContent, /Open Start AidPoint\.cmd/);
});

test('served app fetches the adjacent CSV without caching', async () => {
    const requests = [];
    const app = boot({ stationFetch: async (url, options) => { requests.push([url, options.cache]); return response(csv); } });
    await settle();
    assert.deepEqual(requests, [['./fd.addresses.csv', 'no-store']]);
    assert.match(app.get('status-message').textContent, /Loaded 42 stations/);
    assert.equal(app.get('search-button').disabled, false);
});

test('refreshing uses the updated station file', async () => {
    const app = boot({ stationFetch: async () => response('department,address,coordinates\nNEW STATION,"123 Main St","39.9,-83.8"') });
    await settle();
    assert.match(app.get('status-message').textContent, /Loaded 1 stations/);
});

test('Enter cannot search while station data is unavailable', async () => {
    let requests = 0;
    const app = boot({ stationFetch: async () => { requests++; return response('', 404); } });
    app.get('address-street-input').value = '350 N Fountain Ave';
    app.get('address-street-input').events.keypress({ key: 'Enter' });
    await settle();
    assert.equal(requests, 1);
    assert.equal(app.get('search-button').disabled, true);
    assert.match(app.get('status-message').textContent, /Could not load fd\.addresses\.csv/);
});

test('invalid coordinates prevent searching with an empty station list', async () => {
    const app = boot({ stationFetch: async () => response('department,address,coordinates\nBAD STATION,"123 Main St","999,-83.8"') });
    await settle();
    assert.match(app.get('status-message').textContent, /no valid stations/);
    assert.equal(app.get('search-button').disabled, true);
});

test('search ranks valid driving routes and ignores unreachable stations', async () => {
    const app = boot({ fetch: async url => {
        if (url.includes('nominatim')) return response([{ lat: '39.92', lon: '-83.81', display_name: 'Springfield' }]);
        return response({ code: 'Ok', durations: [[120, 60, ...Array(40).fill(null)]], distances: [[1609, 804, ...Array(40).fill(null)]] });
    } });
    app.get('address-street-input').value = '350 N Fountain Ave';
    await settle();
    await app.get('search-button').events.click();
    const rows = app.get('results-list').children[0].children;
    assert.equal(rows.length, 2);
    assert.match(rows[0].innerHTML, /1 min drive/);
    assert.match(rows[1].innerHTML, /2 min drive/);
    assert.equal(app.get('search-button').disabled, false);
});

test('routing failure preserves a useful service error', async () => {
    const app = boot({ fetch: async url => url.includes('nominatim')
        ? response([{ lat: '39.92', lon: '-83.81', display_name: 'Springfield' }]) : response('', 503) });
    app.get('address-street-input').value = '350 N Fountain Ave';
    await settle();
    await app.get('search-button').events.click();
    assert.match(app.get('status-message').textContent, /Routing service is unavailable \(HTTP 503\)/);
    assert.equal(app.get('search-button').disabled, false);
});

test('Clear cancels an active search and prevents stale results; Enter cannot duplicate it', async () => {
    let signal;
    let finish;
    let requests = 0;
    const app = boot({ fetch: (url, options) => { requests++; signal = options.signal; return new Promise(resolve => { finish = resolve; }); } });
    app.get('address-street-input').value = '350 N Fountain Ave';
    await settle();
    const search = app.get('search-button').events.click();
    app.get('address-street-input').events.keypress({ key: 'Enter' });
    assert.equal(requests, 1);
    app.get('clear-button').events.click();
    assert.equal(signal.aborted, true);
    finish(response([{ lat: '39.92', lon: '-83.81', display_name: 'Springfield' }]));
    await search;
    assert.equal(app.get('results-list').children.length, 0);
    assert.equal(app.get('search-button').disabled, false);
    assert.equal(app.get('address-street-input').value, '');
    assert.equal(app.get('status-message').textContent, 'Enter an incident address to begin.');
});


test('local server serves the CSV, manifest, and platform icons without exposing other files', async () => {
    const { createServer } = require('../server.cjs');
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
        const stationResponse = await fetch(base + '/fd.addresses.csv');
        assert.equal(stationResponse.status, 200);
        assert.equal(stationResponse.headers.get('cache-control'), 'no-store');
        assert.equal(await stationResponse.text(), csv);
        const pageResponse = await fetch(base + '/');
        assert.equal(await pageResponse.text(), html);
        const manifestResponse = await fetch(base + '/manifest.webmanifest');
        assert.equal(manifestResponse.status, 200);
        assert.match(manifestResponse.headers.get('content-type'), /application\/manifest\+json/);
        const manifest = await manifestResponse.json();
        assert.equal(manifest.name, 'AidPoint');
        assert.equal(manifest.short_name, 'AidPoint');
        assert.equal(manifest.display, 'standalone');
        assert.ok(manifest.icons.some(icon => icon.purpose.split(' ').includes('maskable')));
        const appleLink = html.match(/<link rel="apple-touch-icon" sizes="(\d+)x\d+" href="([^"]+)"/);
        assert.ok(appleLink);
        assert.match(html, /<link rel="manifest" href="\.\/manifest.webmanifest">/);
        const icons = [...manifest.icons, { src: appleLink[2], sizes: `${appleLink[1]}x${appleLink[1]}` }];
        for (const icon of icons) {
            const iconResponse = await fetch(new URL(icon.src, base + '/'));
            assert.equal(iconResponse.status, 200, icon.src);
            assert.equal(iconResponse.headers.get('content-type'), 'image/png');
            const image = Buffer.from(await iconResponse.arrayBuffer());
            assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
            assert.equal(`${image.readUInt32BE(16)}x${image.readUInt32BE(20)}`, icon.sizes);
            assert.equal(image[25], 2, 'Icons must use opaque RGB pixels');
        }
        const privateResponse = await fetch(base + '/server.cjs');
        assert.equal(privateResponse.status, 404);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
