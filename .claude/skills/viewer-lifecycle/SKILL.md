---
name: viewer-lifecycle
description: The resource and cancellation rules in src/base.ts — the one-canvas-one-render invariant, superseded renders, text-layer generations, teardown, and pdf.js asset wiring. Use for any change to rendering, navigation, zoom, resize, teardown, or the React wrapper.
---

# Viewer Lifecycle

Almost every defect this library has shipped came from the same class: **a resource that outlived its owner.** A render task still holding a canvas, a listener still bound to a destroyed viewer, a text layer from a page the user already left. Nothing about these is caught by the type checker today, so the rules below are the safety net — read them before touching `base.ts`.

## The invariants

These are the properties that must hold. The mechanism enforcing them may change; these do not.

1. **One canvas, one live render.** pdf.js tracks live render tasks per canvas in an internal `WeakSet` and throws `Cannot use the same canvas during multiple render() operations` if a second render claims a canvas the first still holds. There is exactly one `<canvas>` per viewer and one page rendered at a time.
2. **A superseded render must not touch the DOM.** Not the canvas, not the text layer, not the page-number input. It has been overtaken; its output is wrong by definition.
3. **A cancelled render is a normal outcome, not an error.** `RenderingCancelledException` is expected every time a user navigates faster than a render completes. It is swallowed. Anything else reaches `handleError`.
4. **Teardown releases everything, exactly once.** In-flight render task, resize listener, the `PDFDocumentLoadingTask` (which owns a **worker** — leaking it leaks a thread).
5. **A container renders once.** `init()` calls into the viewer twice (immediately and again on `window.load`), and React StrictMode mounts effects twice. Re-rendering a container must tear down the previous render first.
6. **The user's intent wins over completion order.** The page shown must be the last page requested, not whichever render happened to finish last.

## How they are enforced today

| Invariant | Mechanism |
| --- | --- |
| 1, 2 | A single render-task slot plus a promise chain that serializes callers. `displayPage` cancels the in-flight task **synchronously** so the next link can claim the canvas |
| 2, 6 | `requestedPage` records the latest request; a chain link whose page is stale drops out instead of rendering |
| 2 | `textLayerGeneration` — each text-layer run captures a generation and only writes to the DOM if it is still the newest |
| 3 | `isCancelled`, checked in the chain's `catch` — covers both `RenderingCancelledException` and the `AbortError` raised by `signal.throwIfAborted()` |
| 4 | An `AbortController`. `destroy()` is just `controller.abort()`; each resource registers its own release on the signal, and every listener is added with `{ signal }` so the DOM removes it |
| 5 | A module-level `WeakMap` of container → teardown. A teardown that is no longer the map's entry returns immediately — it belongs to a render that was already released, and re-running it would blank the live one |
| 5 | A module-level `WeakMap` of container → teardown; the previous teardown runs before a re-render |

Two details that look like style but are load-bearing:

- **The cancel in `displayPage` is synchronous, before the chain link is queued.** Cancelling inside the `.then` is too late — the canvas is still held when the next render tries to claim it.
- **The text layer is rebuilt into a detached fragment and swapped in.** Two concurrent runs that each cleared and refilled the live container is what garbled it on resize. Build detached, check you are still current, then `replaceChildren`.

## The rules you must follow

- **Every `await` in a render path is a suspension point where the world may have changed.** After it, you may be torn down, superseded, or both. Call `signal.throwIfAborted()` rather than returning early: a throw unwinds into the funnel that already handles cancellation, whereas an early `return` silently skips the rest of the function.
- **Register listeners with `{ signal }`, never bare.** The listeners on `containerDiv` are the dangerous ones — that element is owned by the *caller* and outlives the viewer, so a bare listener retains the whole dead closure (document proxy, canvas backing store, text content) for the life of the page.
- **One listener per viewer, not one per page view.** A `resize` handler registered per page means N pages produce N handlers all rewriting the layer on a single resize. Register once, read a mutable current-page slot.
- **Never fire a render without handling its rejection.** `@typescript-eslint/no-floating-promises` is an **error** here specifically because a discarded render promise is what let the canvas race go unnoticed. Use `void` only where the promise carries its own `.catch`.
- **Teardown is idempotent and must be safe to call at any point** — before load completes, mid-render, twice in a row.
- **The React effect must tear down and clear the container.** Its dependency array includes `workerSrc`, `documentUrl` and `documentId`: changing any of them is a *different document*, so the old one must be destroyed, not reused.

## pdf.js asset wiring

Two things must be right or the viewer fails in ways that look like code bugs:

- **`workerSrc`** is supplied by the consumer. Imports come from `pdfjs-dist/legacy/build/pdf.mjs`, so the worker must be the matching **legacy** build.
- **`wasmUrl`** is derived from `workerSrc` by `wasmUrlFor`. pdf.js 6 loads its JBIG2/OpenJPEG/QCMS decoders — *and the plain-JS fallbacks beside them* — from `wasmUrl`, whose default is page-relative and therefore 404s on any nested route. Consumers must copy `pdfjs-dist/wasm` next to the worker they serve. `server.js` mirrors this for the example.

The scale custom properties are likewise not optional. `getZoomVal` writes `--scale-factor`, but that is only the **input**: pdf.js 6 sizes each span from `--total-scale-factor` (derived in CSS as `calc(var(--scale-factor) * var(--user-unit))`) via `--text-scale-factor` and a per-span `--font-height`, and positions it with `--scale-x`/`--rotate`. `styles/styles.css` owns that derivation because it is a fork of pdf.js's own text-layer CSS — when upgrading pdf.js, diff it against `node_modules/pdfjs-dist/web/pdf_viewer.css`, which is the authoritative copy. Miss it and the layer silently renders every span at 16px.

## Reviewing a change here

Ask, in order:

1. Does this add an `await` in a render path? What is unguarded after it?
2. Does it add a listener, task, or worker? Where is it released, and is that release reachable from teardown?
3. Can two of these run concurrently? Which one wins, and does the loser touch the DOM?
4. Does it add a fire-and-forget promise? Who catches it?
5. Does it change a class name or a public export? Then `styles/styles.css`, `tests/pdfViewer.spec.ts`, and consumers are all in scope — see `conventions` and `releasing`.

## Anti-patterns

- Adding a guard after an `await` "to be safe" without knowing what it protects — if you cannot name the interleaving, you do not yet understand the change
- Fixing an overlap with a timeout or a delay
- Registering a listener inside a per-page code path
- Swallowing an error broadly to make a cancellation warning disappear — narrow it to *cancellation* or you will hide real faults
- Rendering into the live text-layer container instead of a detached fragment
- Assuming teardown only runs after a successful load
