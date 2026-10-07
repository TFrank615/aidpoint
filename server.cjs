const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');

function createServer() {
    const files = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/index.html': ['index.html', 'text/html; charset=utf-8'],
        '/fd.addresses.csv': ['fd.addresses.csv', 'text/csv; charset=utf-8'],
        '/clark-county-boundary.geojson': ['clark-county-boundary.geojson', 'application/geo+json; charset=utf-8'],
        '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'],
        '/icon-192.png': ['icon-192.png', 'image/png'],
        '/icon-512.png': ['icon-512.png', 'image/png'],
        '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8']
    };
    return http.createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end();
            return;
        }
        let route;
        try {
            route = new URL(request.url, 'http://localhost').pathname;
        } catch {
            response.writeHead(400).end();
            return;
        }
        const file = Object.hasOwn(files, route) ? files[route] : null;
        if (!file) {
            response.writeHead(404).end('Not found');
            return;
        }
        try {
            const body = await fs.readFile(path.join(__dirname, file[0]));
            response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
            response.end(request.method === 'HEAD' ? undefined : body);
        } catch (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Could not read local file.');
        }
    });
}

if (require.main === module) {
    const server = createServer();
    server.on('error', error => { console.error(`Could not start AidPoint: ${error.message}`); process.exitCode = 1; });
    server.listen(0, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${server.address().port}`;
        console.log(`AidPoint: ${url}`);
        console.log('Edit fd.addresses.csv and refresh the page to load changes.');
        console.log('Keep this window open while using AidPoint. Press Ctrl+C to stop.');
        if (process.argv.includes('--open')) {
            execFile('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true }, error => {
                if (error) console.log(`Open ${url} in your browser.`);
            });
        }
    });
}

module.exports = { createServer };
