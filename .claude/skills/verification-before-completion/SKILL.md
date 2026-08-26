---
name: verification-before-completion
description: Use before declaring any task complete, claiming the viewer works, or asserting a change is correct. Requires fresh command output as evidence. Rigid skill — non-negotiable.
---

# Verification Before Completion

NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

Executing the command, reading the whole output, and checking the exit code — that is the evidence. "It should work" is not.

## The Gate

```bash
npm run prepublishOnly
```

That is `clean && build && test && lint --max-warnings 0` — **exactly what CI runs**, and exactly what npm runs before a publish. If it is green, you are done. If you have not run it, you are not done.

While iterating, the cheaper checks in order of speed:

| Check | Command | Catches |
| --- | --- | --- |
| Types | `npm run build` | Everything the compiler can prove |
| Lint | `npm run lint:no-fix -- --max-warnings 0` | The second compiler — see `conventions` |
| One test | `npx playwright test --project=chromium -g "<name>"` | Fast feedback on one behavior |
| Full suite | `npm test` | All three browser engines |

Run the full gate before claiming completion regardless of how many cheap checks passed.

## Three traps specific to this repo

**1. A stale dev server silently serves an old bundle.** `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so a `node server.cjs` left running from an earlier session gets reused and serves a **stale `build/`** — tests then fail (or pass) against code you did not write. If results look impossible, kill strays first:

```bash
pkill -f 'node server'
```

Because `prepublishOnly` starts with `clean`, running the full gate is also the reliable way to prove you are testing the current source.

**2. `npm test` needs network and installed browsers.** The specs fetch a real PDF from `raw.githubusercontent.com`, and browsers are not vendored — `npx playwright install` before the first run. A failure here is environmental, not a regression; say so rather than "fixing" code.

**3. A passing race test proves nothing on its own.** See `playwright-testing` — for any test guarding a race or a leak, the evidence is that it **fails without the fix**, not that it passes with it.

## Red Flags — Stop and Verify

- "This should work" → run the build
- "The changes look complete" → run the full gate
- "Types pass so lint will too" → they are different tools; run both
- "It passed in Chromium" → WebKit and Firefox schedule promises differently; run all three
- Many changes without checking → pause and verify incrementally

## Evidence Table

| Claim | Required evidence | Not sufficient |
| --- | --- | --- |
| Types pass | `npm run build` exits 0 | "It compiled earlier" |
| Lint clean | `--max-warnings 0` exits 0 | "Only warnings" |
| Tests pass | `npm test` — all three projects, count reported | "Chromium was green" |
| Race/leak fixed | Test fails with the fix reverted, passes with it | "The test passes" |
| Ready to publish | `npm run prepublishOnly` exits 0 | Any subset of the above |
| Consumer unaffected | Built `dist/*.d.ts` shape checked against the consumer — see `releasing` | "It's backwards compatible" |

## The Bottom Line

Run the commands. Read the output. Report what it actually said — including failures and anything you skipped. Then claim completion.
