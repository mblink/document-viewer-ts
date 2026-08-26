---
name: using-superpowers
description: Use when starting any task in this repo to determine which skills apply. Establishes the skill-invocation workflow, routing by task type, and the red flags that mean you are rationalizing your way out of a skill.
---

# Using Superpowers

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill applies to what you are doing, invoke it.
IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
</EXTREMELY-IMPORTANT>

## What makes this repo different

This is a **library**, not an app. Three consequences shape every task:

1. **Every export is a public API.** `dist/` and `styles/` are the published surface (`package.json` `files`). A rename in `base.ts` is a breaking change for consumers, and `styles/styles.css` is keyed to class names `base.ts` assigns at runtime — see `conventions`.
2. **Correctness here is about *lifecycle*, not data.** There are no codecs, no reducers, no forms. The bug class this library keeps hitting is *resources that outlive their owner*: render tasks, listeners, workers. See `viewer-lifecycle`.
3. **The only test harness is a real browser.** There are no unit tests and no mocks — Playwright drives the built example in Chromium, Firefox and WebKit. See `playwright-testing`.

## Type safety still governs

Make illegal states unrepresentable; let the compiler prove correctness; never defeat the type system. `tsconfig.json` is strict including `noUncheckedIndexedAccess`, and **lint is a second compiler** — CI runs `--max-warnings 0`, so a `warn` rule fails the build exactly like an error. Never add a disable comment; change the code. See `cdd` and `conventions`.

## Skill Routing Table

| Task type | Skills to invoke |
| --- | --- |
| Any change to `src/base.ts` | `viewer-lifecycle`, `cdd`, `conventions` |
| Render, cancel, teardown, resize, zoom | `viewer-lifecycle` |
| pdf.js upgrade or API migration | `viewer-lifecycle`, `playwright-testing`, `releasing` |
| Writing/editing TypeScript | `cdd`, `conventions` |
| The React wrapper (`Viewer.tsx`, `index.tsx`) | `viewer-lifecycle`, `cdd` |
| Adding or changing a test | `playwright-testing` |
| A lint rule fires, or editing `eslint.config.mjs` | `conventions` |
| Debugging | `systematic-debugging` |
| Publishing, versioning, consumer impact | `releasing` |
| Completing work | `verification-before-completion` |

## Skill Priority

1. **Process skills first** — they determine HOW: `systematic-debugging` for bugs.
2. **Domain skills second** — `viewer-lifecycle`, `cdd`, `conventions`, `playwright-testing`.
3. **Always end with** `verification-before-completion` when code changed.

## Red Flags — Stop, You're Rationalizing

| Thought | Reality |
| --- | --- |
| "It's a one-line change to `base.ts`" | `base.ts` is the whole viewer and every line is lifecycle-adjacent. Read `viewer-lifecycle`. |
| "The tests pass, so the fix works" | A race test that passes may be passing *without* the fix. Run the negative control — see `playwright-testing`. |
| "It's just a lint warning" | CI runs `--max-warnings 0`. A warning is a build failure. |
| "A disable comment will fix this" | Never. Change the code. Existing config-level `off`s are deliberate and documented; they are not precedent. |
| "I'll add a guard after the await to be safe" | Guards you must remember are the bug. Model the lifecycle so you can't forget — `viewer-lifecycle`. |
| "I only changed the React wrapper" | The wrapper owns teardown. Getting it wrong leaks a pdf.js worker per mount. |
| "I'll verify in Chromium, the others will be fine" | Three browsers are three engines. `npm test` runs all three for a reason. |
| "This doesn't need a formal skill" | If a skill exists, use it. |

## Skill Types

**Rigid** (`verification-before-completion`, `systematic-debugging`): follow exactly, don't adapt away the discipline.

**Flexible** (`viewer-lifecycle`, `cdd`, `conventions`, `playwright-testing`, `releasing`): adapt the principles to context.

## User Instructions

Instructions say WHAT, not HOW. "Fix X" doesn't mean skip the workflow.
