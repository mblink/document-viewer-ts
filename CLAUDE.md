# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`document-viewer-ts` — a small npm library that renders PDF, MS Office, and text documents in the browser. It ships two entry points from one implementation: an `init(workerSrc)` function for vanilla HTML/JS pages, and a React `<Viewer />` component. Published files are `dist/` (built) and `styles/` (shipped as-is).

## Commands

```bash
npm run build            # tsc -> dist/es2020 (ESM + .d.ts)
npm test                 # playwright test (all three browser projects)
npm run lint             # eslint --fix
npm run lint:no-fix
npm run serve-example    # build the example and serve it on :8080
npm run prepublishOnly   # clean + build + test + lint --max-warnings 0 — this is exactly what CI runs
```

Run a single test: `npx playwright test --project=chromium -g "controls work"`.

Notes:
- Node >= 20.19.0 (`engines`, and CI pins Node 22). ESLint 10 sets that floor.
- CI runs `npm run prepublishOnly`, so **lint warnings fail the build** (`--max-warnings 0`) even though most rules in `eslint.config.mjs` are set to `warn`.
- `dist/` and `build/` are gitignored, but `example/example.ts` imports from `../dist/es2020`, so the example build runs `npm run build` first.
- The Playwright tests fetch a real PDF from `raw.githubusercontent.com`, so `npm test` needs network access.
- Browsers are not vendored: `npx playwright install` before the first run.

## Architecture

**`src/base.ts` is the whole viewer.** It is framework-agnostic and builds the entire UI imperatively with `document.createElement` — there is no template or JSX for the viewer chrome. `src/Viewer.tsx` and `init()` are thin adapters onto it.

The single contract between all layers is a container element carrying `class="viewer-container"`, a unique `id`, and `data-document-url`:

- `init(workerSrc)` (vanilla path) queries every `.viewer-container` on the page — once immediately and again on `window.load` — and calls `renderDocument(workerSrc)` on each.
- `<Viewer documentId documentUrl workerSrc />` (React path) renders that same div and calls `renderDocument(workerSrc)` on it in an effect.

`renderDocument(workerSrc)(containerDiv)` reads `data-document-url`, adds the `document-viewer-ts` class, dispatches on the lowercased file extension (query string stripped), and **returns a teardown function**:

| Extension | Renderer | Mechanism |
|---|---|---|
| `pdf` | `renderPDF` | pdf.js into a `<canvas>` plus a positioned text layer |
| `doc(x)`, `ppt(x)`, `xls(x)`, and friends | `renderDocx` | iframe to `view.officeapps.live.com` (external service — the document URL must be publicly reachable) |
| `txt` | `renderTxt` | `<embed>` |
| anything else | `renderErrorMessage` | inline error div |

### Lifecycle — the part that is easy to get wrong

Every render owns resources that must be released, and several past bugs came from not releasing them:

- `renderPDF` returns `{ promise, destroy }`. `destroy()` cancels the in-flight `RenderTask`, removes the resize listener, and destroys the `PDFDocumentLoadingTask` (which also tears down its worker).
- `renderDocument` keeps a module-level `WeakMap` of container → teardown and calls the previous teardown before re-rendering, because `init()` renders each container twice (immediately and on `load`) and React StrictMode mounts twice.
- **One canvas, one render at a time.** pdf.js tracks live render tasks per canvas in an internal WeakSet and throws `Cannot use the same canvas during multiple render() operations` if a second render claims a canvas the first still holds. `currentRenderTask` is that single slot; `renderChain` serializes callers; `requestedPage` lets superseded requests drop out instead of queueing a redundant render. `RenderingCancelledException` is the expected outcome of a superseded render and is swallowed; anything else reaches `handleError`.
- **One resize listener, not one per page.** It reads a mutable `currentPage` slot and bumps `textLayerGeneration`, so only the newest text-layer run is allowed to touch the DOM.

### PDF rendering specifics

- **One page at a time.** `displayPage(n)` re-renders the same single canvas; there is no continuous scroll. Navigation is the prev/next buttons, the page-number input, and ArrowLeft/ArrowRight (the container sets `tabIndex` and focuses itself on click).
- **Zoom and scaling** run through `getZoomVal`, which is the trickiest part of the file. It derives a scale from the container width and the selected zoom percentage, writes it to the `--scale-factor` CSS custom property on the container (**pdf.js's `TextLayer` requires this variable** — omitting it breaks text positioning), and multiplies by `PDFtoCSSConvert` (96/72) for the canvas viewport.
- **The text layer is re-rendered, not re-scaled**, by `scaleTextLayer` — on zoom change and on `window` resize — because its geometry depends on the rendered canvas's `offsetWidth`.
- Imports come from `pdfjs-dist/legacy/build/pdf.mjs` (the legacy build). The package version carries a `-legacy` suffix to match.
- **`wasmUrl` must be set.** pdf.js 6 loads its JBIG2/OpenJPEG/QCMS decoders — and the plain-JS fallbacks beside them — from `wasmUrl`, whose default is page-relative and so 404s on any nested route. `wasmUrlFor` derives it from `GlobalWorkerOptions.workerSrc`, so consumers must copy `pdfjs-dist/wasm` next to the worker they serve.
- `isEvalSupported` is gone: pdf.js 6 removed the eval-based code path entirely, so the option no longer exists (and there is no `eval`/`new Function` left in the shipped build).

## CSS coupling

`styles/styles.css` is keyed entirely to class names that `base.ts` assigns at runtime (`wrapper`, `canvas-container`, `page-container`, `text-layer`, `viewer-controls`, `page-number-input`, `zoom-select`, `lds-ring`, `error-message`, `txt-embed`), scoped under `.document-viewer-ts`, plus pdf.js's own `.textLayer` classes. **Renaming a class in `base.ts` requires updating `styles.css` and `tests/pdfViewer.spec.ts`**, which asserts on those same class names. The stylesheet is not built or bundled — it is published verbatim and imported by consumers.

## Testing setup

Playwright drives the built example (`playwright.config.ts` starts `npm run serve-example` on :8080 and reuses a running one locally). `server.js` mounts the example, the built bundle, `pdfjs-dist/legacy/build` (the worker), and `pdfjs-dist/wasm` at `/wasm`.

The race regressions are only meaningful if they fail without the fix — when touching the serialization in `displayPage`, verify that by removing it and re-running, not by assuming.

## Conventions

- Single quotes, `sort-imports` is on (named import members must be alphabetized, uppercase first), and `@typescript-eslint/no-explicit-any` is deliberately off.
- `@typescript-eslint/no-floating-promises` is an **error**: fire-and-forget renders are the bug class this library keeps hitting. Use `void` only where the promise genuinely carries its own `.catch`.
- `tsconfig.json` is strict, including `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch` — indexed access returns `T | undefined`, hence the optional chaining around extension parsing.
- Rendering helpers are curried (`renderDocument(workerSrc)(div)`, `handleError(div)(err)`, `skipPage(direction)()`); follow that style when adding new ones.
- `pdfjs-dist` is a required peer dependency; `react`/`react-dom` are optional peers, so nothing outside `Viewer.tsx` may import React.
