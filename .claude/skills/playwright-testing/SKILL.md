---
name: playwright-testing
description: Playwright testing patterns for the viewer — negative controls for race regressions, collecting async errors, the no-mocking stance, and the DOM contract the specs assert on. Use when writing, changing, or reviewing anything under tests/.
---

# Playwright Testing

`tests/pdfViewer.spec.ts` is the entire test suite. It drives the **built example** in Chromium, Firefox and WebKit against a real PDF — there are no unit tests, no jsdom, and no mocks.

## Why there are no unit tests

Everything worth testing here is browser behavior: canvas rendering, layout-dependent text positioning, event timing, worker loading. A unit test with a faked pdf.js would assert that the fake behaves like the fake. **Do not add one to avoid the cost of a browser test** — if a behavior cannot be observed in a browser, question whether it is a behavior.

The corollary: the tests are slower and more valuable than unit tests. Treat a flaky one as a real signal, not a nuisance to retry away.

## The negative control — non-negotiable for race and leak tests

**A regression test for a race is worthless until you have watched it fail.** These tests can pass for reasons unrelated to the fix, and a green suite then certifies nothing.

The procedure, every time you add or modify one:

1. Write the test. Confirm it passes with the fix in place.
2. **Revert the fix** (comment out the serialization, the generation check, the teardown — whatever the test guards).
3. Re-run. **It must fail**, and fail for the reason you expect.
4. Restore the fix. Re-run. It must pass.
5. Only now is the test evidence.

This is not hypothetical. A held-key test in this suite originally passed *without* the fix, because `page.keyboard.press` awaits a round-trip per press and so never produced the overlap it claimed to test. It only became a real test once the presses were dispatched in one synchronous burst.

## Reproducing races deterministically

Awaiting each interaction serializes it and hides the very overlap you are testing. To produce genuine concurrency:

```ts
// Auto-repeat while a key is held: one synchronous burst, no round-trips.
await doc1.evaluate((el, n) => {
  for (let i = 0; i < n; i++) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
}, 8);
```

`click({ noWaitAfter: true })` in a tight loop serves the same purpose for buttons. The rule: **if the harness waits for stability between actions, you are testing the serial path.**

## Asserting the absence of an error

pdf.js reports these faults as **async rejections**, which arrive *after* the assertion you were about to make. Reading the error array too early gives you an empty array and a false pass. So:

- Attach listeners **before** the action (`collectErrors` subscribes to `pageerror` and `console` errors).
- **Let them settle** before asserting absence — the suite's `settle` helper waits 2s.
- Filter for the specific fault (`sameCanvasError`) rather than asserting no errors at all; unrelated console noise should not fail the suite, and a broad assertion invites someone to weaken it later.

## Assert the invariant, not the incident

Prefer assertions that stay true for the right reason:

```ts
await expect(doc1.locator('.text-layer > .textLayer')).toHaveCount(1);  // exactly one — a leak shows up as N
await expect(pageNumber).toHaveValue('9');                              // intent won over completion order
```

`toHaveCount(1)` catches both duplication and disappearance. `toBeAttached()` alone would pass with five stacked layers — which was the bug.

## Assertions that cannot fail

Every one of these was written here, passed, and proved worthless under a negative control. Check a new assertion against this list before trusting it.

| Assertion | Why it can't fail |
| --- | --- |
| `expect(layers).toHaveCount(1)` | `scaleTextLayer` ends in `replaceChildren`, so the count is exactly 1 by construction — no matter what the generation guard does. |
| Counting opaque pixels to prove the canvas painted | pdf.js creates its context with `alpha: false` **and** fills the whole canvas white before executing a single operator, so alpha is always 255 and a blank page scores the same as a rendered one. Sample a region known to contain glyphs and count non-white pixels. |
| Counting container children to detect a leaked listener | The leaked handler writes to *detached* nodes — the input, the canvas, the text layer are all off the DOM — so nothing is ever appended back and the count stays 0 either way. |
| Asserting no errors at all on the example page | It embeds a live Microsoft Office viewer for its `.doc`, which throws CSP violations, font failures and XML parse errors of its own. Filter for the specific fault. |

The shared root cause: **the assertion measures something the code guarantees for an unrelated reason.** Ask what single line you would delete to make it fail — if you can't name one, it isn't a control.

Not every guard can be covered. The text-layer generation guard has no failing control at all under pdf.js 6: the layer is sized by CSS, so a superseded resize run landing last produces identical geometry *and* identical content. Say so rather than writing an assertion that merely passes.

## The DOM contract

The specs assert on the same runtime-assigned class names that `styles/styles.css` is keyed to: `.textLayer` (pdf.js's own), `.text-layer`, `.page-container`, `.page-number-input`, `.prev-button`, `.next-button`, `.zoom-select`, and the `#doc-1` / `#doc-1-canvas` ids from the example. **Renaming any of them means updating `base.ts`, `styles.css`, and this spec together** — the compiler cannot see any of these edges.

## Naming

Name a test for the behavior it verifies, not the mechanism you hope it exercises. "serves the wasm decoders beside the worker" is honest about testing the server mount; "serves the wasm decoders rather than 404ing" would overclaim, since it does not exercise the URL derivation. An overclaiming name is worse than no test — it stops someone from writing the real one.

## Running

```bash
npm test                                                       # all three engines
npx playwright test --project=chromium                         # one engine
npx playwright test --project=chromium -g "controls work"      # one test
npx playwright test --headed / --debug                         # watch / step
npx playwright show-report                                     # traces (on-first-retry)
```

Notes: browsers are not vendored (`npx playwright install` first); the fixture PDF is fetched over the network; and `reuseExistingServer` is on locally, so a stray `node server.cjs` will serve a **stale bundle** — `pkill -f 'node server'` when results look impossible.

## Anti-patterns

- A race test added without running the negative control
- `waitForTimeout` used as a fix for flakiness rather than to let async rejections settle
- Asserting `toBeAttached()` where the bug is duplication — use `toHaveCount`
- Awaiting each interaction in a test whose whole point is overlap
- Mocking pdf.js
- Testing only Chromium because it is fastest — engines differ in promise scheduling, which is exactly where these bugs live
- Weakening an assertion to make CI green
