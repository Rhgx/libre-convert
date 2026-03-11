# libre-convert

Browser-based document and image to PDF conversion powered by LibreOffice WASM.

## Scripts

- `npm run dev`: local development with the headers required for `SharedArrayBuffer`.
- `npm run build`: production build for a root deployment.
- `npm run build:pages`: production build for GitHub Pages under `/libre-convert/`.
- `npm test`: unit and component tests.
- `npm run test:e2e`: Playwright tests.

## GitHub Pages

This repo includes a Pages deployment workflow at [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml). It builds the app with a base path of `/libre-convert/`, which matches a repository Pages URL like:

`https://<user>.github.io/libre-convert/`

### Required repository settings

1. Push the workflow to the default branch.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.

### Cross-origin isolation on Pages

The LibreOffice WASM runtime needs cross-origin isolation:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

For local development, Vite serves those headers directly. For GitHub Pages and other static hosts, this repo ships a `coi-serviceworker.js` bootstrap that re-serves app assets with the required headers so `SharedArrayBuffer` can become available after the first load.

Notes:

- The first visit can reload once while the service worker takes control.
- The site still needs a secure context, so production hosting must use HTTPS.
- If a browser blocks service workers or does not support the required isolation features, conversion will remain unavailable.
