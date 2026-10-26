import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasWeight } from './src/ui/iconWeights.ts';

function versionInfo(): Plugin {
  const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version as string;
  return {
    name: 'sambungdulur-version',
    transformIndexHtml() { return [{ tag: 'meta', attrs: { name: 'application-version', content: version }, injectTo: 'head' }]; },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, ...(process.env.GITHUB_SHA ? { commit: process.env.GITHUB_SHA } : {}) }) });
    },
  };
}

/** OCR assets are served from this application, never a third-party CDN. */
function kkAssets(): Plugin {
  const files: Record<string, string> = {
    'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
    'ind.traineddata.gz': 'node_modules/@tesseract.js-data/ind/4.0.0/ind.traineddata.gz',
    'worker.min.js.LICENSE.txt': 'node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt',
    'tesseract-LICENSE.txt': 'node_modules/tesseract.js/LICENSE.md',
    'core-LICENSE.txt': 'node_modules/tesseract.js-core/LICENSE',
    'pdfjs-LICENSE.txt': 'node_modules/pdfjs-dist/LICENSE',
  };
  for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
    const name = `tesseract-core-${variant}.wasm.js`;
    files[name] = `node_modules/tesseract.js-core/${name}`;
  }
  return {
    name: 'sambungdulur-local-ocr',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = req.url?.split('?')[0].split('/kk-assets/')[1];
        if (!key || !files[key]) return next();
        res.setHeader('Content-Type', key.endsWith('.js') ? 'application/javascript' : 'application/gzip');
        res.end(readFileSync(resolve(files[key])));
      });
    },
    generateBundle() {
      for (const [name, path] of Object.entries(files)) this.emitFile({ type: 'asset', fileName: `kk-assets/${name}`, source: readFileSync(resolve(path)) });
    },
  };
}

/**
 * Generates dist/sw.js after the bundle is written: a cache-first service worker that
 * precaches every emitted asset (JS, CSS, sql.js WASM, icons), so the app works offline
 * after the first visit. The cache name is derived from the asset list, so a new build
 * replaces the old cache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'sambungdulur-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const assets = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const files = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-monochrome-512.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', ...assets];
      const unique = [...new Set(files)];
      const hash = createHash('sha256').update('static-assets-v2\n').update(unique.join('\n'));
      for (const asset of Object.values(bundle)) if (asset.type === 'asset' && asset.fileName.startsWith('kk-assets/')) hash.update(asset.source);
      const version = hash.digest('hex').slice(0, 12);
      const source = `// Generated at build time. Precaches the app shell for offline use.
const CACHE = 'sambungdulur-${version}';
const FILES = ${JSON.stringify(unique)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('sambungdulur-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    // Static same-origin assets have no personalized variants. Preview servers may add
    // Vary: Origin, whereas cache.addAll and module imports use different Origin headers.
    caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}


/**
 * Phosphor ships six weights in every icon module. The app only draws the weights listed in
 * src/ui/iconWeights.ts, so the others are dropped from the bundle; this keeps the icon set lighter
 * than the lucide icons it replaced.
 */
function phosphorWeights(): Plugin {
  return {
    name: 'sambungdulur-phosphor-weights',
    apply: 'build',
    transform(code, id) {
      const m = /@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/](\w+)\.es\.js$/.exec(id);
      if (!m) return null;
      const keep = (w: string) => hasWeight(m[1], w);
      // Each weight is one `[ "name", <element> ]` entry of the module's Map.
      const out = code
        .replace(/\[\s*"(\w+)",[\s\S]*?\n {2}\],?/g, (entry, weight: string) => (keep(weight) ? entry : ''))
        // Paths are drawn on a 256-unit grid at 16-20 px: one decimal is far below a device pixel.
        .replace(/\bd: "([^"]+)"/g, (_, d: string) => `d: "${d.replace(/-?\d*\.\d+/g, (n) => String(Math.round(+n * 10) / 10))}"`);
      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [phosphorWeights(), react(), kkAssets(), versionInfo(), serviceWorker()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
