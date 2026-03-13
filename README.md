# libre-convert

Browser-based document and image to PDF conversion powered by LibreOffice WASM.

## Supported formats

- Word to PDF: `DOC`, `DOCX`, `ODT`, `RTF`, `TXT`
- Excel to PDF: `XLS`, `XLSX`, `ODS`, `CSV`
- PowerPoint to PDF: `PPT`, `PPTX`, `ODP`
- Image to PDF: `PNG`, `JPG`, `JPEG`, `GIF`, `BMP`

All supported formats can be exported with either a vertical or horizontal PDF page layout.

## Scripts

- `npm run dev`: local development with the headers required for `SharedArrayBuffer`.
- `npm run build`: production build for a root deployment.
- `npm run build:pages`: production build for GitHub Pages under `/libre-convert/`.
- `npm run fetch:zeta-runtime`: download the ZetaOffice runtime into `public/vendor/zetaoffice/latest/`.
- `npm run build:pages:self-hosted`: download the runtime and build a Pages deploy that serves it from this site instead of the ZetaOffice CDN.
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

### Self-hosted runtime on deploy

The GitHub Pages workflow now downloads the ZetaOffice runtime during the build and publishes it alongside the app under `vendor/zetaoffice/latest/`.

Notes:

- This removes the runtime dependency on `cdn.zetaoffice.net` for deployed builds.
- First-time visitors still need to download the runtime once; the browser cannot avoid transferring those bytes.
- The runtime is large, so self-hosted deploy artifacts are substantially bigger than the app code alone.

Notes:

- The first visit can reload once while the service worker takes control.
- The site still needs a secure context, so production hosting must use HTTPS.
- If a browser blocks service workers or does not support the required isolation features, conversion will remain unavailable.
