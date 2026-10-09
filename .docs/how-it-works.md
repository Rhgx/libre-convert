# How it works

Everything runs in the browser. There is no backend; files are never uploaded.

## Conversion

- **Documents, spreadsheets, presentations and drawings** are written into the in-memory filesystem of the [ZetaOffice](https://zetaoffice.net/) LibreOffice WASM runtime. A script running inside LibreOffice's own worker thread (`src/conversion/office.worker.ts`) loads the file, applies the page layout and exports a PDF.
- **Images** skip LibreOffice entirely (`src/conversion/pdf.ts`). JPEG and PNG are embedded into the PDF without re-encoding. Other formats, and photos with an EXIF rotation, are drawn through a canvas first so they come out upright.

## Page layout

- **Original** exports each file with its own page setup, untouched.
- **Portrait / Landscape** for documents and spreadsheets changes the page styles inside LibreOffice before export, keeping the paper size (A4, Letter, ...). Text re-flows natively, so links, bookmarks and selectable text survive. Landscape spreadsheets are also scaled to fit all columns on one page width.
- **Portrait / Landscape** for slides, drawings and images places each page onto an A4 sheet in that orientation, since their content can't re-flow.

## The LibreOffice runtime

- About 50 MB (compressed), downloaded from the ZetaOffice CDN the first time a document is added. Booting starts right away, before Convert is clicked.
- ZetaOffice only publishes a "latest" build, so the version can't be pinned. The service worker caches the runtime once and never revalidates it, which keeps each browser on the build it first downloaded and matched to the vendored `zeta.js`. To force everyone onto a fresh download, rename `RUNTIME_CACHE` in `public/sw.js`.
- `public/vendor/zetajs/1.2.0/` holds the zetajs glue code. See its README for where it came from and what was changed.

## Cross-origin isolation

LibreOffice WASM needs `SharedArrayBuffer`, which browsers only enable on [cross-origin isolated](https://web.dev/articles/coop-coep) pages (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`).

- The Vite dev and preview servers send these headers themselves (`vite.config.ts`).
- GitHub Pages can't, so `public/sw.js` adds them to every response. On the first visit the page reloads once, after the service worker takes control.
- The same service worker caches the app (network first) and the runtime (cache first), which is what makes the site work offline.

## Project layout

```text
src/
  main.tsx                 entry, service worker registration
  App.tsx, styles.css      the whole UI
  conversion/
    convert.ts             entry point: routes images and documents, LibreOffice client
    office.worker.ts       runs inside the LibreOffice thread: load, set layout, export
    pdf.ts                 pdf-lib helpers: images, page fitting, merging (lazy loaded)
    formats.ts             supported extensions and file naming
public/
  sw.js                    cross-origin isolation headers and offline cache
  vendor/zetajs/           vendored zetajs runtime glue
e2e/                       Playwright test with generated DOCX/XLSX/PPTX fixtures
```

Unit tests sit next to the code they cover (`*.test.ts`).
