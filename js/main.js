/*
 * main.js — App bootstrap. Loaded LAST, after every other script.
 *
 * By the time this runs, all the data and functions from the other files
 * already exist on the page, so we can safely:
 *   1. build the PWA manifest and attach it,
 *   2. paint the first screen,
 *   3. register the service worker for offline support.
 */

// ─── PWA manifest (built at runtime so the whole app stays self-contained) ──
const manifest = {
  name: "Dashboard",
  short_name: "Dashboard",
  start_url: ".",
  display: "standalone",
  background_color: "#0f0f0f",
  theme_color: "#0f0f0f",
  icons: [
    { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='112' fill='%230f0f0f'/%3E%3Ctext x='256' y='340' text-anchor='middle' font-size='280' font-family='system-ui'%3E%F0%9F%92%AA%3C/text%3E%3C/svg%3E", sizes: "512x512", type: "image/svg+xml" }
  ]
};
const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = URL.createObjectURL(manifestBlob);
document.head.appendChild(manifestLink);

// ─── First paint ────────────────────────────────────────────────────────────
render();

// ─── Service Worker (offline support) ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
