# AGENTS.md

## Cursor Cloud specific instructions

**Libre Convert** is a fully client-side React + Vite SPA that converts documents and images to PDF in the browser using LibreOffice WASM. There is no backend, database, or Docker dependency.

### Running the app

- `npm run dev` starts the Vite dev server on port 5173 with cross-origin isolation headers required for `SharedArrayBuffer` / LibreOffice WASM.
- See `README.md` for all available scripts.

### Testing

- **Unit/component tests:** `npm test` (Vitest + jsdom). All 27 tests should pass.
- **Lint:** `npm run lint` (TypeScript type-check via `tsc --noEmit`).
- **E2E tests:** `npm run test:e2e` (Playwright, Chromium only). Requires `npx playwright install --with-deps chromium` first. Note: as of the current codebase, the E2E tests fail because they look for a heading element (`getByRole('heading', ...)`) that does not exist in the rendered UI — this is a pre-existing test issue, not an environment problem.

### Gotchas

- Image-to-PDF conversion runs in pure JS and works without LibreOffice WASM. Document conversion (DOCX, XLSX, PPTX, etc.) requires the LibreOffice WASM runtime (`zetajs`), which downloads ~300 MB of assets on first use and needs `SharedArrayBuffer` (provided by COOP/COEP headers from the dev server).
- The `npm run build` output goes to `dist/`. The `npm run preview` command serves this build on port 4173.
