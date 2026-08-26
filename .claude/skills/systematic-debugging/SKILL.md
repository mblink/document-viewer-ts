---
name: systematic-debugging
description: Structured debugging workflow for the viewer. Use when fixing bugs, investigating errors, or diagnosing unexpected rendering behavior. Rigid skill — follow exactly.
---

# Systematic Debugging

The compiler is your first diagnostic tool. The browser is your second. Guessing is not on the list.

## Phase 1: Classify

Run `npm run build` and `npm run lint:no-fix` before looking at runtime behavior.

| Category | First action |
| --- | --- |
| Type error | Read the full error chain; find the root mismatch, not the last frame |
| Lint violation | Read the **rule name**, then `conventions` — several rules here are deliberately configured and the config explains why |
| Rendering bug | Which layer? canvas, text layer, or controls. They fail differently — see the table below |
| Lifecycle bug | Go straight to `viewer-lifecycle`. Symptoms: duplicate DOM, stale content, errors after teardown |
| Consumer-only bug | Reproduce in `example/` first. If it will not reproduce, the bug is in the consumer's wiring — usually `workerSrc` or `wasmUrl` |

## Phase 2: Locate the layer

The viewer has three independent failure surfaces. Identify which one before forming a hypothesis:

| Symptom | Layer | Where to look |
| --- | --- | --- |
| Blank/garbled canvas, `Cannot use the same canvas...` | Render | `renderPage` / `displayPage` — the single-task slot and the chain |
| Text misaligned, unselectable, or doubled | Text layer | `scaleTextLayer`, `textLayerGeneration`, and the scale custom properties in `styles/styles.css` — compare against `node_modules/pdfjs-dist/web/pdf_viewer.css` |
| Wrong page number, controls out of sync | Controls | `requestedPage` vs what the DOM shows |
| 404s for `.wasm` / `_nowasm_fallback.js` | Asset wiring | `wasmUrlFor`, and the consumer's static mounts |
| Works on the first page, breaks after navigation | Lifecycle | Superseded renders — `viewer-lifecycle` |
| Works alone, breaks with two viewers on a page | Lifecycle | Module-level state; the teardown `WeakMap` |

Useful instruments, in order of cost:

```bash
npx playwright test --project=chromium -g "<name>" --headed   # watch it happen
npx playwright test --project=chromium -g "<name>" --debug    # step through
npx playwright show-report                                    # traces from the last run
npm run serve-example                                         # poke at :8080 by hand
```

Attach listeners before the action, not after — the spec's `collectErrors` exists because pdf.js reports these faults as **async rejections**, which arrive after the assertion you were about to make. Give them time to land (`settle`) before asserting their absence.

## Phase 3: One hypothesis at a time

1. Form a **single** hypothesis about the root cause.
2. Make **one** minimal change.
3. Re-run the specific check. Did *that* symptom resolve?
4. YES → Phase 4. NO → **revert** and form a new hypothesis.
5. Keep a log so you do not retry a dead end.

### 3+ failed hypotheses — STOP

You are attacking the wrong problem. Do not continue guessing. Instead: re-read the original error from scratch, question whether the *model* is wrong rather than the logic, and ask the human for context.

### Race conditions do not respond to inspection

If the symptom is timing-dependent, reading the code harder will not settle it. **Reproduce it deterministically first** — dispatch events synchronously rather than awaiting each one (`page.keyboard.press` awaits a round-trip and will hide the overlap you are hunting). Only then change code. A fix for a race you could not reproduce is a guess wearing a fix's clothes.

## Phase 4: Fix, then make the class impossible

1. **Can this bug become a type constraint?** If the bug was a reachable illegal state, change the model so it is unrepresentable. That kills the whole class, not this instance. See `cdd`.
2. If it is genuinely runtime-only (a wrong calculation, an off-by-one), add a Playwright regression test — and prove it fails without the fix (`playwright-testing`).
3. Run the full gate per `verification-before-completion`.

## Anti-patterns

- "Let me try one more thing" after 3 failures — stop
- Adding a `try/catch` or a null guard to make a symptom disappear without knowing why it fired
- Silencing a lint rule that is reporting a real defect
- Fixing a race by adding a delay
- Claiming a race is fixed without a negative control
- "I'll check types after I confirm the fix works" — check types first, they are faster than you are
