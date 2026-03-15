# Vault Account UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Vite-style layout and interaction refresh for the vault account page, including desktop-only pointer affordance on clickable custom surfaces.

**Architecture:** Keep business logic unchanged and refactor only presentation/interaction layers in the account page component tree. Use a phased approach: test foundation, shell/layout updates, interaction surface updates, then verification. Apply shared visual rules consistently without introducing broad global style churn.

**Tech Stack:** React, TypeScript, Vite, Tailwind utility classes, Vitest + Testing Library (new for this app), pnpm workspace tooling.

---

**Spec reference:** `docs/superpowers/specs/2026-03-15-vault-layout-interaction-design.md`

## File Structure Map

- Modify: `apps/vault/src/pages/Account.tsx`
  - Responsibility: top-level account page layout shell and section rhythm.
- Modify: `apps/vault/src/components/account/AccountHeader.tsx`
  - Responsibility: hero hierarchy and logout action layout consistency.
- Modify: `apps/vault/src/components/account/AccountSidebar.tsx`
  - Responsibility: sidebar card framing and readability rhythm.
- Modify: `apps/vault/src/components/account/AccountList.tsx`
  - Responsibility: list spacing and empty-state hierarchy.
- Modify: `apps/vault/src/components/account/AccountCard.tsx`
  - Responsibility: selection-state clarity, segmented content, desktop pointer policy.
- Modify: `apps/vault/src/components/account/AddAccountSection.tsx`
  - Responsibility: import/create surface consistency and clickable affordance.
- Modify: `apps/vault/src/components/account/ConfigImportExport.tsx`
  - Responsibility: dialog hierarchy and desktop pointer on custom click targets.
- Create: `apps/vault/vitest.config.ts`
  - Responsibility: component test runner config.
- Create: `apps/vault/src/test/setup.ts`
  - Responsibility: testing library and DOM matcher setup.
- Create: `apps/vault/src/components/account/__tests__/AccountCard.interaction.test.tsx`
  - Responsibility: TDD coverage for card click behavior and desktop pointer class.
- Create: `apps/vault/src/components/account/__tests__/AddAccountSection.affordance.test.tsx`
  - Responsibility: TDD coverage for desktop pointer affordance on custom clickable areas.
- Create: `apps/vault/src/components/account/__tests__/AccountLayout.shell.test.tsx`
  - Responsibility: TDD coverage for account page shell hierarchy and key class hooks.

## Chunk 1: Test Foundation + Shell Layout

### Task 1: Add Test Foundation For Vault App

**Files:**

- Create: `apps/vault/vitest.config.ts`
- Create: `apps/vault/src/test/setup.ts`
- Modify: `apps/vault/package.json`

- [ ] **Step 1: Discover active TypeScript config for vault tests**
      Run:
- `ls apps/vault/tsconfig.json`
- `rg "references|extends|types" apps/vault/tsconfig.json tsconfig.json`
  Expected: identify the concrete tsconfig file where `types` should be updated (`apps/vault/tsconfig.app.json` for browser tests in this app).

- [ ] **Step 2: Write the failing test command (expected missing config)**
      Run: `pnpm --filter @alixex/vault exec vitest run`
      Expected: FAIL with missing Vitest configuration/dependencies.

- [ ] **Step 3: Add test dependencies and scripts**
      Update `apps/vault/package.json`:
- Add dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- Add scripts: `test`, `test:run`.
- Add `vitest/globals` to the `types` array in `apps/vault/tsconfig.app.json`.
- Install with one concrete command so lockfile resolves exact versions:
  - `pnpm --filter @alixex/vault add -D vitest @testing-library/react @testing-library/jest-dom jsdom`

- [ ] **Step 4: Add minimal Vitest config and setup file**
      `apps/vault/vitest.config.ts` should include:
- `environment: "jsdom"`
- `setupFiles: ["./src/test/setup.ts"]`
- `globals: true`

`apps/vault/src/test/setup.ts` should include:

- `import "@testing-library/jest-dom/vitest"`

- [ ] **Step 5: Run test command to verify framework boots**
      Run: `pnpm --filter @alixex/vault test:run`
      Expected: PASS with 0 tests before Chunk 1 test file is added, then PASS with discovered tests.
      If this fails, verify `vitest.config.ts`, `tsconfig.app.json` types, and installed dev dependencies before continuing.

- [ ] **Step 6: Commit**
      Run:
      `git add apps/vault/package.json apps/vault/vitest.config.ts apps/vault/src/test/setup.ts`
      `git commit -m "test(vault): add vitest component testing foundation"`

### Task 2: TDD Page Shell Rhythm And Hierarchy

**Files:**

- Create: `apps/vault/src/components/account/__tests__/AccountLayout.shell.test.tsx`
- Modify: `apps/vault/src/pages/Account.tsx`
- Modify: `apps/vault/src/components/account/AccountHeader.tsx`
- Modify: `apps/vault/src/components/account/AccountSidebar.tsx`

- [ ] **Step 1: Write failing tests for shell hierarchy hooks**
      Test assertions should cover:
- account page has stable hooks for hero container and content grid using exact ids `data-testid="account-hero"` and `data-testid="account-content-grid"`.
- sidebar section remains rendered in unlocked path using exact id `data-testid="account-sidebar"`.
- header keeps title/subtitle semantic grouping and logout action region exists in unlocked path.
- responsive class strategy test scope: assert class presence only (`grid-cols-1` baseline and `lg:` split class). Visual alignment is validated manually in Chunk 3.
  Example assertions:
- `expect(screen.getByTestId("account-hero")).toBeInTheDocument()`
- `expect(screen.getByTestId("account-content-grid").className).toMatch(/grid-cols-1/)`
- `expect(screen.getByTestId("account-content-grid").className).toMatch(/lg:/)`

- [ ] **Step 2: Run targeted test to verify failure**
      Run: `pnpm --filter @alixex/vault test:run -- AccountLayout.shell.test.tsx`
      Expected: FAIL due to missing/changed structural classes/hooks.

- [ ] **Step 3: Implement minimal shell updates**
      Implement approved layout updates in:
- `Account.tsx`: apply spec section 4.1 spacing rhythm and responsive tiering (`<640`, `640-1023`, `>=1024`).
- `AccountHeader.tsx`: apply spec section 6.2 hierarchy and logout placement.
- `AccountSidebar.tsx`: apply spec section 6.6 card-shell and readability updates.
- breakpoint utility strategy: use existing Tailwind breakpoints in code (`sm`, `lg`) to represent mobile/tablet/desktop tiers from the spec.

Breakpoint mapping (explicit):

1. `<640` -> base classes (no prefix)
2. `640-1023` -> `sm:` classes (tablet tier)
3. `>=1024` -> `lg:` classes (desktop tier)

Note: full visual breakpoint validation is executed in Chunk 3 Task 5 (manual runtime validation), not in Chunk 1.
Note: accessibility polish from spec section 7.1 (focus-visible and aria refinements) is implemented in Chunk 2 where clickable surface updates are made.

Design-to-implementation quick map for this task:

1. Spec 4.1 spacing rhythm -> shell section gaps use mobile-first classes with desktop expansion (`gap-6`, `lg:gap-8`).
2. Spec 4.1 responsive tiers -> maintain single-column baseline and desktop split at `lg`.
3. Spec 6.2 header hierarchy -> keep title/subtitle block grouped and logout region separated.
4. Spec 4.4 sidebar column -> keep vault info and security cards readable with consistent card-shell spacing.

Token mapping quick table:

1. `Account.tsx` shell cards: move toward `bg-card/88` and `border-border/70`.
2. `AccountHeader.tsx` interactive action zone: ensure hover border intent aligns with `hover:border-primary/40` direction.
3. `AccountSidebar.tsx` cards: align with same card-shell token direction used in main column.

Scope guard for Chunk 1:

1. Allowed modifications: `Account.tsx`, `AccountHeader.tsx`, `AccountSidebar.tsx`, test foundation files, shell test file.
2. Do not modify in Chunk 1: `AccountCard.tsx`, `AccountList.tsx`, `AddAccountSection.tsx`, `ConfigImportExport.tsx`.
3. Do not create in Chunk 1: `AccountCard.interaction.test.tsx` and `AddAccountSection.affordance.test.tsx` (these belong to Chunk 2).

- [ ] **Step 4: Run test and type check**
      Run:
- `pnpm --filter @alixex/vault test:run -- AccountLayout.shell.test.tsx`
- `pnpm --filter @alixex/vault type-check`
- `pnpm --filter @alixex/vault build`
  Expected: PASS test and PASS type-check.

Manual quick check:

- verify keyboard tab order still follows visual flow after shell layout changes:
  - tab focus reaches header action before list region actions
  - focus does not skip sidebar interactive controls in unlocked state

- [ ] **Step 5: Commit**
      Run:
      `git add apps/vault/src/pages/Account.tsx apps/vault/src/components/account/AccountHeader.tsx apps/vault/src/components/account/AccountSidebar.tsx apps/vault/src/components/account/__tests__/AccountLayout.shell.test.tsx`
      `git commit -m "feat(vault): refresh account page shell and hero hierarchy"`

## Chunk 2: Core Interaction Surfaces

### Task 3: TDD AccountCard Selection + Desktop Pointer Policy

**Files:**

- Create: `apps/vault/src/components/account/__tests__/AccountCard.interaction.test.tsx`
- Modify: `apps/vault/src/components/account/AccountCard.tsx`
- Modify: `apps/vault/src/components/account/AccountList.tsx`

- [ ] **Step 1: Write failing tests for interaction behavior**
      Tests should verify:
- clicking non-button area triggers `onSelect`.
- clicking nested button does not trigger `onSelect`.
- clickable card root includes desktop pointer class (`md:cursor-pointer`).
- active state exposes structural marker cue.
- account card root keeps focus-visible class path (keyboard navigability baseline).

- [ ] **Step 2: Run targeted tests and confirm fail**
      Run: `pnpm --filter @alixex/vault test:run -- AccountCard.interaction.test.tsx`
      Expected: FAIL for at least one interaction/pointer assertion.

- [ ] **Step 3: Implement minimal component changes**
      Update:
- `AccountCard.tsx`: segmented layout blocks, active cue set, desktop pointer class, preserve event guard.
- `AccountList.tsx`: empty-state hierarchy polish and spacing consistency.
- apply motion defaults from spec section 5.2 for hover/reveal while honoring reduced-motion behavior.

Motion placement map:

1. Page reveal motion: `Account.tsx` shell entry wrappers.
2. Card hover motion: `AccountCard.tsx` interactive root.
3. Dialog motion: handled in Task 4B (`ConfigImportExport.tsx`).

- [ ] **Step 4: Run tests and type check**
      Run:
- `pnpm --filter @alixex/vault test:run -- AccountCard.interaction.test.tsx`
- `pnpm --filter @alixex/vault type-check`
  Expected: PASS test and PASS type-check.

- [ ] **Step 5: Commit**
      Run:
      `git add apps/vault/src/components/account/AccountCard.tsx apps/vault/src/components/account/AccountList.tsx apps/vault/src/components/account/__tests__/AccountCard.interaction.test.tsx`
      `git commit -m "feat(vault): improve account card interaction hierarchy"`

### Task 3.1: Shared Utility Audit Checkpoint

**Files:**

- Modify: `apps/vault/src/components/account/AccountCard.tsx` (optional)
- Modify: `apps/vault/src/components/account/AccountList.tsx` (optional)

- [ ] **Step 1: Audit repeated visual patterns before new edits**
      Run:
- `rg "bg-card/|border-border/|md:cursor-pointer|transition-all" apps/vault/src/components/account`
  Expected: identify whether 3+ components share identical class clusters.

- [ ] **Step 2: Decide extraction vs local classes**
      Decision rule:
- if repeated pattern appears in 3+ components, extract minimal shared helper.
- otherwise keep component-local classes.

- [ ] **Step 3: Commit only if extraction is introduced**
      Run (if needed):
      `git add apps/vault/src/components/account/*`
      `git commit -m "refactor(vault): extract shared account ui class patterns"`

### Task 4A: TDD AddAccount Clickable Affordance

**Files:**

- Create: `apps/vault/src/components/account/__tests__/AddAccountSection.affordance.test.tsx`
- Modify: `apps/vault/src/components/account/AddAccountSection.tsx`

- [ ] **Step 1: Write failing tests for affordance policy**
      Tests should verify:
- custom clickable chain cards/chips include desktop pointer class.
- create-chain cards include desktop pointer class.
- custom clickable controls retain focus-visible support.

- [ ] **Step 2: Run targeted tests to verify failure**
      Run: `pnpm --filter @alixex/vault test:run -- AddAccountSection.affordance.test.tsx`
      Expected: FAIL for missing desktop pointer affordance and/or expected hooks.

- [ ] **Step 3: Implement minimal UI changes**
      Update:
- `AddAccountSection.tsx`: consistent chips/cards layout, desktop pointer on custom clickable surfaces, focus-visible preservation.

- [ ] **Step 4: Run tests, lint, and type check**
      Run:
- `pnpm --filter @alixex/vault test:run -- AddAccountSection.affordance.test.tsx`
- `pnpm --filter @alixex/vault lint`
  Expected: PASS tests and PASS lint/type checks.

- [ ] **Step 5: Commit**
      Run:
      `git add apps/vault/src/components/account/AddAccountSection.tsx apps/vault/src/components/account/__tests__/AddAccountSection.affordance.test.tsx`
      `git commit -m "feat(vault): align add-account clickable affordance"`

### Task 4B: TDD ConfigImportExport Dialog Hierarchy + Error Feedback

**Files:**

- Create: `apps/vault/src/components/account/__tests__/ConfigImportExport.dialog.test.tsx`
- Modify: `apps/vault/src/components/account/ConfigImportExport.tsx`

- [ ] **Step 1: Write failing tests for dialog affordance and feedback**
      Tests should verify:
- password visibility custom toggles include desktop pointer class.
- import file trigger region includes desktop pointer class.
- wrong-password path renders inline error state hook.
- result summary supports collapsed and expanded detail states.

- [ ] **Step 2: Run targeted tests and confirm fail**
      Run: `pnpm --filter @alixex/vault test:run -- ConfigImportExport.dialog.test.tsx`
      Expected: FAIL for missing one or more target behaviors.

- [ ] **Step 3: Implement minimal UI-only changes**
      Update:
- `ConfigImportExport.tsx`: dialog hierarchy, pointer affordance on custom click targets, inline feedback hooks, result summary expand/collapse behavior.
- Keep import/export business logic unchanged.

- [ ] **Step 4: Mid-chunk pointer policy checkpoint**
      Run:
      `rg "md:cursor-pointer" apps/vault/src/components/account/ConfigImportExport.tsx apps/vault/src/components/account/AddAccountSection.tsx`
      Expected: custom desktop-clickable surfaces are covered before final verification.

- [ ] **Step 5: Run tests, lint, and type check**
      Run:
- `pnpm --filter @alixex/vault test:run -- ConfigImportExport.dialog.test.tsx`
- `pnpm --filter @alixex/vault lint`
  Expected: PASS tests and PASS lint/type checks.

- [ ] **Step 6: Commit**
      Run:
      `git add apps/vault/src/components/account/ConfigImportExport.tsx apps/vault/src/components/account/__tests__/ConfigImportExport.dialog.test.tsx`
      `git commit -m "feat(vault): polish config dialogs and error feedback affordance"`

## Chunk 3: End-to-End Verification + Handoff

### Task 5: Full Verification And Regression Sweep

**Files:**

- Modify: `docs/superpowers/specs/2026-03-15-vault-layout-interaction-design.md` (optional, only if implementation-driven clarifications are needed)

- [ ] **Step 1: Run full account component test suite**
      Run: `pnpm --filter @alixex/vault test:run -- src/components/account/__tests__`
      Expected: PASS all account-related tests.

- [ ] **Step 2: Run project quality gates**
      Run:
- `pnpm --filter @alixex/vault type-check`
- `pnpm --filter @alixex/vault lint`
  Expected: PASS with no new errors.

- [ ] **Step 3: Run pointer policy grep check**
      Run:
      `rg "md:cursor-pointer" apps/vault/src/components/account apps/vault/src/pages/Account.tsx`
      Expected: All custom desktop-clickable surfaces represented; no mobile-forced pointer-only policy.

- [ ] **Step 3.1: Run token mapping consistency audit**
      Run:
      `rg "bg-card/|border-border/|hover:border-primary/|bg-primary/" apps/vault/src/components/account apps/vault/src/pages/Account.tsx`
      Expected: updated classes align with target token direction from the approved spec.

- [ ] **Step 4: Manual runtime validation**
      Run:
      `pnpm --filter @alixex/vault dev`
      Validate:
- desktop and mobile layout tiers
- account select/copy/sensitive actions
- add/import/create flows
- config import/export dialogs
- desktop pointer policy (custom clickable regions)

Explicit scenario checklist:

1. select active/inactive account and confirm active cue state.
2. copy address on multiple account cards.
3. trigger wrong-password import and verify inline + toast feedback.
4. exercise create/import account flows.
5. verify config export/import dialogs and close behaviors in idle/loading states.
6. verify desktop pointer policy on custom clickable regions.

Accessibility checklist during manual validation:

1. focus-visible state is visible on keyboard navigation.
2. tab order follows visual flow.
3. labeled inputs (or aria-label) remain present for password/alias/key fields.
4. dialog initial focus and Escape close behavior are correct when not loading.

- [ ] **Step 5: Commit verification artifacts if any**
      Run:
      `git add -A`
      `git commit -m "chore(vault): verify account ui optimization rollout"`

## Execution Notes

1. Keep each task self-contained; do not combine multiple tasks into one commit.
2. Preserve existing wallet/account business logic and data flow.
3. If a file exceeds manageable size during edits, extract only the repeated visual helper patterns (YAGNI).
4. Prefer `md:cursor-pointer` on custom clickable wrappers; do not force pointer on mobile.

Plan complete and saved to `docs/superpowers/plans/2026-03-15-vault-account-ui-optimization.md`. Ready to execute?
