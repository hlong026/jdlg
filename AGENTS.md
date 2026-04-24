# Karpathy-Inspired Coding Guidelines

These guidelines apply to the entire repository.

## 1. Think Before Coding

- Do not silently guess when requirements are ambiguous.
- State key assumptions before making non-trivial changes.
- If multiple interpretations are possible, surface them instead of picking one invisibly.
- If the requested approach looks overcomplicated, push back with a simpler option.

## 2. Simplicity First

- Implement the smallest change that solves the actual problem.
- Do not add speculative abstractions, configurability, or future-proofing unless requested.
- Prefer straightforward code over clever code.
- If a solution can be materially shorter and clearer, simplify it.

## 3. Surgical Changes

- Touch only the files and lines needed for the task.
- Do not refactor unrelated code while making a targeted fix.
- Match the surrounding style unless the task explicitly asks for a broader cleanup.
- Clean up dead code only when your own change made it dead.

## 4. Goal-Driven Execution

- Define a concrete success condition before implementing non-trivial work.
- Prefer verifiable outcomes such as builds, tests, or reproducible checks.
- For multi-step tasks, keep a short plan and verify each step.
- Do not stop at implementation if verification is practical in the current environment.

## 5. Local Commit Requirement

- After completing each task, create a local git commit in this repository.
- Commit messages must be written in Chinese.
- Keep each commit scoped to the task that was actually completed.

