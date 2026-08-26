---
name: releasing
description: Publishing this package and what changing it does to consumers — entry points, the -legacy version scheme, peer dependencies, required consumer wiring, and how BondLink consumes it via a yarn patch. Use when versioning, publishing, or changing anything in the public surface.
---

# Releasing

## The published surface

`files: ["dist", "styles"]` — nothing else ships. Two consequences:

- **`styles/styles.css` is published verbatim.** It is never built or bundled, and it is keyed to class names `base.ts` assigns at runtime. It is as much a public API as the exports.
- **`dist/` is generated.** It is gitignored, so what is on disk locally may not match the branch.

## Entry points must match what the build produces

```
module  -> dist/es2020/index.js   (ESM)
types   -> dist/es2020/index.d.ts
```

**This package is ESM-only, and that is forced, not a preference.** `src/base.ts` imports `pdfjs-dist/legacy/build/pdf.mjs`, and pdf.js 6 ships the legacy build as `.mjs` with no CommonJS counterpart and no `exports` map. A `require()`-emitting build of this source cannot import it — TypeScript rejects it outright under `module: node16` (TS1479), and the only way to make it compile is `moduleResolution: node10`, which is deprecated in TS 6, removed in TS 7, and would emit a `require()` of an ESM file regardless. There is deliberately **no `main` field**: a CJS entry here could only ever be a broken one.

If a consumer needs CJS, the answer is a bundler on their side, not a second build target here.

**Every declared entry point must be produced by `npm run build`.** This is the trap: the build script and the entry points live in different parts of `package.json` and nothing checks them against each other. Dropping a build target while leaving its entry declared publishes a package whose `require()` resolves to a file that does not exist — and no test catches it, because the tests exercise the example bundle, not the package entry points.

After any change to `build`, `outDir`, or the entry fields, verify by listing the output:

```bash
npm run clean && npm run build && ls dist/*
```

and confirm every path named in `main`/`module`/`types` is present.

## Versioning

- The **`-legacy` suffix** is not a prerelease tag in spirit — it records that this build targets pdf.js's **legacy** bundle (`pdfjs-dist/legacy/build/pdf.mjs`). Keep it.
- Bump **major** for: a renamed or removed export, a renamed CSS class, a changed teardown contract, a raised `pdfjs-dist` peer floor, or a raised `engines.node`.
- `peerDependencies`: `pdfjs-dist >= 6.0.0` is **required**; `react` / `react-dom` are **optional**. Raising the pdf.js floor is a breaking change for consumers even when no signature moves.

## Publishing

```bash
npm run prepublishOnly    # clean + build + test (3 browsers) + lint --max-warnings 0
```

npm runs this automatically on publish. Run it yourself first — it is the same gate CI uses, and it is the only thing standing between a local `dist/` and the registry. See `verification-before-completion`.

## What consumers must do

A consumer cannot just install this package. It must also:

1. **Serve the matching legacy worker** and pass its URL as `workerSrc`.
2. **Copy `pdfjs-dist/wasm` next to that worker.** `wasmUrl` is derived from `workerSrc`; pdf.js 6 loads its JBIG2/OpenJPEG/QCMS decoders *and their plain-JS fallbacks* from there, and the default is page-relative so it 404s on nested routes.
3. **Import `styles/styles.css`.**
4. **Call the returned teardown** when unmounting.

Anything here that changes belongs in `README.md` in the same commit — it is the only place consumers learn about it. `server.cjs` mirrors the same wiring for the example and is the reference implementation.

## How BondLink consumes it

BondLink pins this package in `web/package.json`. While a fix is unreleased it consumes a **Yarn patch** against the published version:

```
"document-viewer-ts": "patch:document-viewer-ts@npm%3A1.0.0-legacy#~/.yarn/patches/document-viewer-ts-npm-1.0.0-legacy-6f5571633e.patch"
```

That patch edits **built `dist/` output**, not source — so it is blind to anything the build changes, and it silently rots when this package publishes a new version. It is a bridge, not a destination.

**Publishing a release lets BondLink drop the patch entirely** and pin a plain version. When you cut a release that supersedes a patch, say so, so the consumer side gets cleaned up rather than carrying a stale patch that no longer applies to the version it names.

Before releasing a change BondLink depends on, check the built shape against what the patch expects:

```bash
cat dist/es2020/base.d.ts
```

## Checklist

- [ ] `npm run prepublishOnly` green
- [ ] Every path in `main` / `module` / `types` exists under `dist/`
- [ ] Version bumped correctly, `-legacy` suffix kept
- [ ] `README.md` updated if consumer wiring changed
- [ ] Renamed CSS classes reflected in `styles/styles.css` and the specs (`conventions`)
- [ ] Peer floors reviewed — a raised floor is a major bump
- [ ] If this supersedes a consumer patch, flag it for removal
