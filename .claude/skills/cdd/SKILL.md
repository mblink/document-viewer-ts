---
name: cdd
description: Compiler Driven Development for this repo — making illegal viewer states unrepresentable in plain TypeScript. Use when writing, editing, or refactoring any code in src/, especially lifecycle state.
---

# Compiler Driven Development

Make the types carry the correctness. The compiler should reject a wrong change before any browser opens.

This repo has **no fp-ts, no io-ts, no codecs** — the tools are plain TypeScript: discriminated unions, branded types, `readonly`, exhaustive switches, and a strict `tsconfig` (`noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noImplicitReturns`). That is enough for everything below.

## Core principles

1. **Make illegal states unrepresentable.** Prefer a type that makes a bug impossible over a test that detects it.
2. **Parse, don't validate.** At a boundary, convert unknown input into a precise type *once*, and let everything downstream rely on it — rather than re-checking the same loose type at every use.
3. **The compiler is a refactoring guide.** Change the type first, then let the errors enumerate every site that must change. That list is exhaustive; your memory is not.
4. **Never defeat the type system.** No `as`, no `any` to silence an error, no non-exhaustive switch, no lint disable. If a change is awkward to type, the *model* is wrong — fix the model.
5. **Verify type claims with the compiler, not from memory.** Do not assert that an API exists or a narrowing holds; run `npm run build`.

## Why this matters more here than the file count suggests

`base.ts` coordinates a set of mutable slots — the in-flight task, the current page, the lifecycle flag, the generation counter — that are only correct *in combination*. Nothing in the current types says which combinations are legal, so the invariants live in `viewer-lifecycle` as prose and in guards you have to remember to write. **Every guard you must remember is a bug waiting for the one place you forget.**

That is exactly the pressure CDD relieves.

## The highest-value technique here: discriminated unions

Independent nullable slots multiply into states that cannot actually occur:

```ts
// Illegal combinations are representable: a task AND a current page,
// a current page after teardown, a task that outlived the document.
let currentRenderTask: RenderTask | null = null;
let currentPage: CurrentPage | null = null;
let destroyed = false;
```

One value whose type forbids them:

```ts
type Phase =
  | { readonly tag: 'idle' }
  | { readonly tag: 'rendering'; readonly task: RenderTask }
  | { readonly tag: 'ready'; readonly page: CurrentPage };
```

Now `rendering` and `ready` are exclusive, `task` only exists where it is meaningful, and a `switch` over `tag` is checked for exhaustiveness. Adding a fourth phase later produces compile errors at every site that must handle it — which is the point.

**Cancellation is a separate axis** from phase, and it is better modelled by an `AbortSignal` than by a boolean: it is the platform's own type for "this is over", `addEventListener(..., { signal })` makes the DOM release listeners for you, and `signal.throwIfAborted()` turns a guard you might forget into a throw that lands in the error path you already have.

## Other techniques worth reaching for

**Branded types** for values that are structurally identical but semantically different — the scale numbers in this file are a live example (a zoom percentage, a pdf.js scale, and a CSS scale factor are all `number`, and mixing them silently produces a wrong-sized page):

```ts
type Brand<A, B extends string> = A & { readonly __brand: B };
type ZoomPercent = Brand<number, 'ZoomPercent'>;
type PdfScale = Brand<number, 'PdfScale'>;
```

**Exhaustive dispatch** over the file-extension union rather than a `string` with a `default` that silently swallows new cases. `noFallthroughCasesInSwitch` is on; a `default` that hides a new variant defeats it.

**`readonly`** on anything you do not intend to mutate — the compiler then enforces the intent instead of a convention.

## Workflow

1. **Change the type first.** Do not touch the implementation yet.
2. **Run `npm run build`** and read every error. That is your task list.
3. **Fix each error semantically** — never by casting, widening, or `any`. An error you silence is a bug you moved.
4. **Check exhaustiveness** — a new union member should produce errors everywhere it is unhandled. If it does not, something is swallowing it.
5. **Verify** per `verification-before-completion`.

## Boundaries: where runtime checks belong

Runtime checks are for the edges where external data actually enters, and nowhere else:

- `data-document-url` read off a DOM element
- the file extension parsed out of a URL
- `workerSrc` handed in by the consumer
- anything coming back from pdf.js typed as `any` or loosely

Parse these **once**, at the edge, into a precise type. Do not re-check downstream — that is the defensive coding that hides which value was actually untrusted.

## Anti-patterns

| Pattern | Why it is wrong | Instead |
| --- | --- | --- |
| `as` to make an error go away | Moves the bug to runtime | Narrow with a type guard, or fix the model |
| `any` on a pdf.js value | Disables checking for everything downstream | Type the shape you actually use |
| A `default:` case that does nothing | Hides new variants forever | Exhaustive switch; let it fail to compile |
| Boolean parameters (`render(page, true)`) | Unreadable and unenforceable at the call site | A union: `'immediate' \| 'deferred'` |
| Parallel nullable slots kept in sync by hand | Illegal combinations are representable | One discriminated union |
| A comment explaining an invariant | Comments do not fail the build | Encode it in the type; keep the comment only for genuine non-obvious constraints |
| Re-validating the same value at every use | Obscures the real boundary | Parse once at the edge |

## Related

`viewer-lifecycle` (the invariants worth encoding), `conventions` (lint as the second compiler), `verification-before-completion` (the gate).
