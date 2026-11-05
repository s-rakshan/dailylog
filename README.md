# Daily Log

Simple monthly project sheets on your phone. Offline PWA — everything stays in this browser.

## Run locally

Open `index.html` via any static server (needed for the service worker):

```bash
python3 -m http.server 8080 --directory /workspace/dailylog
```

## Files

- `index.html` / `styles.css` / `app.js` — app
- `docx.js` — offline Word export
- `sw.js` + `manifest.webmanifest` — installable offline PWA
- `icons/` — app icons
- `tests/run.js` — Playwright phone-viewport smoke test

## Not published

Local box copy only. Do not push until Rakshan says okay.
