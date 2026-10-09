# zetajs 1.2.0 (vendored)

`zeta.js` and `zetaHelper.js` from [zetajs 1.2.0](https://www.npmjs.com/package/zetajs) (`source/`), MIT licensed (see `LICENSE`).

They are served as static files because `zetaHelper.js` locates `zeta.js` relative to its own URL and is re-imported by URL inside the LibreOffice worker, which a bundler would break.

Local change: `zetaHelper.js` filters a few noisy runtime log lines (`zetaSuppressedLogPatterns` at the top). `zeta.js` is unmodified.
