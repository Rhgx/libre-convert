# libre-convert

Browser-based document-to-PDF conversion powered by LibreOffice WASM.

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

### Important limitation

The UI can be deployed to GitHub Pages, but the in-browser LibreOffice runtime will not function there.

This app requires cross-origin isolation:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

GitHub Pages does not let you configure those response headers, so `SharedArrayBuffer` stays unavailable and conversion is blocked at runtime. For a working production deployment, host the built `dist/` output on a platform where you control response headers.
