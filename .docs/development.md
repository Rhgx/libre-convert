# Development

Requires Node.js 26 or newer. CI runs on Node 26.

```sh
npm install
npm run dev          # http://localhost:5173, serves the isolation headers itself
npm run lint         # ESLint
npm test             # unit and component tests (Vitest)
npm run build        # production build for a root deployment
npm run build:pages  # production build for https://<user>.github.io/libre-convert/
npm run preview      # serves the last build on http://localhost:4173
```

The service worker is only registered in production builds, so use `npm run build && npm run preview` to test offline behaviour.

## End-to-end test

```sh
npx playwright install chromium   # once
npm run test:e2e
```

The test builds the app, converts generated DOCX, XLSX, PPTX and PNG files with the real LibreOffice runtime, and checks page sizes for every layout, the ZIP download and merging. It needs network access to the ZetaOffice CDN.

## Deployment

`.github/workflows/deploy-pages.yml` runs lint, unit tests and the Pages build on every push and pull request, and deploys `main` to GitHub Pages. In the repository settings, set **Pages > Source** to **GitHub Actions**.
