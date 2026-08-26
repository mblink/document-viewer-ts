---
name: conventions
description: Code style, the ESLint flat config and why its rules are set the way they are, and the invisible coupling between base.ts, styles.css and the specs. Use when writing TypeScript here, when a lint rule fires, or when editing eslint.config.mjs.
---

# Conventions

## Style

- **Single quotes** (`avoidEscape`, template literals allowed), semicolons, 2-space indent.
- **`sort-imports` is on** — named members within a braces group must be alphabetized, uppercase first. This bites on every new import; let `npm run lint` fix it.
- **Curried helpers.** `renderDocument(workerSrc)(div)`, `handleError(div)(err)`, `skipPage(direction)()`. Follow the style when adding one.
- **No `console`** (`no-console` is on) — and nothing in `src/` should log in normal operation. Errors surface in the DOM via `renderErrorMessage`.
- **`@typescript-eslint/no-explicit-any` is deliberately off**, because pdf.js's own types leak `any`. This is not licence to reach for `any` in your own code — see `cdd`.
- `tsconfig.json` is strict, including `noUncheckedIndexedAccess` (indexed access yields `T | undefined`, hence the optional chaining around extension parsing), `noFallthroughCasesInSwitch`, and `noImplicitReturns`.

## Lint is the second compiler

CI runs `npm run prepublishOnly`, which ends in `eslint --max-warnings 0`. **Most rules are set to `warn`, and every one of them fails the build.** There is no such thing as "just a warning" here.

**Never add a disable comment.** `reportUnusedDisableDirectives` is on, so stale ones are themselves errors. When a rule rejects your code, change the code. The `off`s already in `eslint.config.mjs` are deliberate, documented decisions made with the whole file in view — they are not precedent for silencing a rule at a call site.

### The rules that exist because of a real bug

| Rule | Level | Why |
| --- | --- | --- |
| `@typescript-eslint/no-floating-promises` | **error** | A discarded render promise is what let the canvas race go unnoticed. Use `void` only where the promise carries its own `.catch`. |
| `require-atomic-updates` | **error** | Interleaved `await`-then-assign in the render chain is exactly this rule's subject. |
| `no-void` | `warn` (`allowAsStatement`) | `void` is permitted as a statement — deliberately paired with the rule above. |
| `@typescript-eslint/no-unnecessary-condition` | `warn` | On only because cancellation is an `AbortSignal`. A mutable boolean flag gets narrowed to `false` by TypeScript, and the rule then reports the lifecycle guards as dead code — which is why it used to be off. |

### The deliberate `off`s

- `@typescript-eslint/no-explicit-any` — pdf.js types.
- `@typescript-eslint/no-unsafe-member-access` / `no-unsafe-return` / `unbound-method` / `restrict-template-expressions` — same root cause.
- `no-fallthrough`, `no-redeclare`, `no-shadow`, `no-unused-vars` — off in favour of the typed `@typescript-eslint` equivalents. Don't re-enable the base rule alongside its TS counterpart; you get double reports.

When you change a rule, put the *reason* in the config next to it, not in a commit message. Keep each comment adjacent to the rule it describes — a rationale that drifts above an unrelated rule is worse than none.

## The couplings the compiler cannot see

Three edges in this repo have no type-level connection. Changing one side silently breaks the others:

1. **`base.ts` class names → `styles/styles.css`.** The stylesheet is keyed entirely to class names assigned at runtime (`wrapper`, `canvas-container`, `page-container`, `text-layer`, `viewer-controls`, `page-number-input`, `zoom-select`, `lds-ring`, `error-message`, `txt-embed`), scoped under `.document-viewer-ts`, plus pdf.js's own `.textLayer`. The stylesheet is published verbatim — never built, never bundled.
2. **`base.ts` class names → `tests/pdfViewer.spec.ts`.** The specs assert on those same names.
3. **`base.ts` exports → consumers.** `dist/` is the public API; see `releasing`.

**Renaming a class means editing all three.** Grep before you rename.

## React is optional

`react` / `react-dom` are **optional** peer dependencies. Nothing outside `src/Viewer.tsx` may import React — a stray import breaks every vanilla-JS consumer at bundle time. `pdfjs-dist` is a required peer (`>=6.0.0`); imports come from the **legacy** build (`pdfjs-dist/legacy/build/pdf.mjs`), which is why the package version carries a `-legacy` suffix.

## Comments

Comments explain a **constraint someone would otherwise undo** — a pdf.js quirk, a load-bearing ordering, a deliberate omission. They do not narrate what the code does, and they do not tell the story of how it got here. State the constraint, not the incident.
