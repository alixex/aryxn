# Vault Account Page Layout & Interaction Optimization Design

Date: 2026-03-15
Scope: apps/vault account page and account-related components
Status: Proposed and user-approved (approach A)

## 1. Goals

1. Align overall visual direction with vite.dev-style clarity and momentum while staying within existing design tokens.
2. Improve information hierarchy and scanning efficiency across account list, sidebar, and action panels.
3. Improve interaction quality with consistent state feedback (hover, active, disabled, loading).
4. Enforce desktop-only pointer affordance on clickable regions; mobile does not require pointer cursor.
5. Keep business logic unchanged; focus on layout and interaction polish.

## 2. Non-goals

1. No wallet logic changes (import/export algorithm, account creation logic, decryption, persistence).
2. No localization key restructuring unless required for UX copy clarity.
3. No backward-compatibility work for legacy visual styles.

## 3. Design Principles

1. Strong visual hierarchy: Hero > primary action region > supporting information.
2. Minimal but expressive: reduced visual noise, higher clarity.
3. Intentional motion: short, meaningful transitions only.
4. Predictable interactions: consistent click/focus/active behavior everywhere.

## 3.1 Token Mapping (Current -> Target)

1. Card shell:
   - Current: `bg-card/84`, `border-border/90`, heavy mixed shadows
   - Target: `bg-card/88`, `border-border/70`, single soft shadow tone
2. Interactive hover border:
   - Current: inconsistent `hover:border-primary/35` usage
   - Target: shared hover border at `hover:border-primary/40`
3. Active state:
   - Current: mostly color-only emphasis
   - Target: left marker + border + surface tint (`bg-primary/8` equivalent via existing utility mix)
4. Caption/secondary text:
   - Current: `text-xs` and `text-muted-foreground` mixed inconsistently
   - Target: `text-xs text-muted-foreground` for metadata and `text-sm` for body copy

## 4. Layout Architecture

## 4.1 Top-level Page Structure

Target file: apps/vault/src/pages/Account.tsx

1. Keep a hero-like page header with stronger separation from body content.
2. Main body uses a dominant content column and a supporting sidebar column.
3. Refine spacing rhythm:
   - Section gaps: `gap-8` desktop, `gap-6` mobile
   - Card gaps: `gap-6` desktop, `gap-4` mobile
   - Internal component gaps: `gap-3` to `gap-4`
4. Responsive behavior:
   - `< lg`: single-column flow, order = header -> list/tabs -> add account -> sidebar cards
   - `>= lg`: two-column flow with primary content first and sidebar second
   - `< sm`: reduce horizontal paddings by one step and keep actions full-width where applicable

## 4.2 Primary Content Column

1. Account card area remains the core focus.
2. Chain tabs become clearer pill navigation with stronger active state.
3. Account list cards use segmented content blocks:
   - Identity row
   - Address + quick actions
   - Asset section
   - Sensitive/management actions
4. Add account area sits below list with matching card language.

## 4.3 Sidebar Column

Target file: apps/vault/src/components/account/AccountSidebar.tsx

1. Vault info card: concise, high legibility, stronger key-value contrast.
2. Security info card: list readability and spacing improved.
3. Config import/export card adopts the same visual rhythm as other cards.

## 5. Interaction Design

## 5.1 State System

States standardized across account UI:

1. default
2. hover
3. active/selected
4. disabled
5. loading

Rules:

1. Active account uses both structural and color cues.
2. Hover never relies on color alone; combine subtle elevation/border shift.
3. Loading actions always show a progress indicator and disable re-trigger.

### 5.1.1 Error/Success Matrix

1. Unlock failure:
   - Signal: inline password error + toast
   - Action state: submit re-enabled after response
2. Import config parse failure:
   - Signal: toast error + reset file input
   - Action state: import button stays disabled until file is re-selected
3. Import wrong password:
   - Signal: inline error near password field + result panel failure summary
4. Export password mismatch:
   - Signal: inline error and blocked export action
5. Delete account failure:
   - Signal: toast error and dialog remains open for retry
6. Success states:
   - Signal: toast success + visual state reset on relevant forms/dialogs
7. Network timeout or transient API failure:
   - Signal: toast error + keep retry path visible for repeatable actions
   - Action state: loading cleared and controls re-enabled
8. Mid-execution cancellation or dialog close:
   - Signal: no success toast, preserve last stable UI state
   - Action state: require explicit user re-trigger

### 5.1.2 Desktop/Mobile Feedback Policy

1. Desktop: keep inline form errors and allow supplemental toast.
2. Mobile: keep inline form errors for active forms; toast is supplemental and never the only validation channel.

## 5.2 Motion System

1. Page section reveal:
   - Animation: `opacity 0 -> 1`, `translateY(8px) -> translateY(0)`
   - Duration: `220ms`
   - Easing: `cubic-bezier(0.22, 1, 0.36, 1)`
2. Card hover:
   - Animation: `translateY(-2px)` + border emphasis
   - Duration: `140ms`
   - Easing: `ease-out`
3. Dialog transitions:
   - Overlay: fade in/out `160ms`
   - Content: fade + scale `0.98 -> 1` in `180ms`
4. Error hints:
   - Opacity reveal with slight vertical motion (`4px`)
   - Duration: `160ms`
5. Respect reduced motion:
   - If `prefers-reduced-motion`, disable movement transforms and keep fade-only transitions.

## 5.3 Pointer Affordance Policy

User-mandated rule:

1. Desktop web clickable surfaces should show pointer cursor.
2. Mobile does not require pointer cursor.

Implementation strategy:

1. Use desktop-scoped utility class `md:cursor-pointer` on clickable non-button containers.
2. Native `button` and `input` elements rely on default browser pointer behavior; only add `md:cursor-pointer` if a reset class removed that behavior.
3. For custom clickable elements (`div`, `label`, icon wrappers), require both `md:cursor-pointer` and keyboard-accessible behavior.
4. Use `cursor-default` or no cursor override on mobile-only behavior; do not force pointer below `md`.

Examples of clickable regions to enforce:

1. Account card container select behavior.
2. Chain selection pills and create-chain cards.
3. Upload/select file trigger region in config import/export.
4. Password visibility toggles where rendered as custom controls.

## 6. Component-level Changes

## 6.1 apps/vault/src/pages/Account.tsx

1. Refine page shell spacing and visual rhythm.
2. Strengthen tabs shell and card framing.
3. Keep business handlers unchanged.

## 6.2 apps/vault/src/components/account/AccountHeader.tsx

1. Hero-like typography and subtitle hierarchy.
2. Better separation between title block and logout action.
3. Desktop pointer consistency for action controls.

## 6.3 apps/vault/src/components/account/AccountList.tsx

1. Improve empty state visual hierarchy.
2. Keep card stack spacing consistent with updated rhythm.

## 6.4 apps/vault/src/components/account/AccountCard.tsx

1. Refine selected vs non-selected styling.
2. Stronger internal segmentation for readability.
3. Desktop pointer for clickable card container.
4. Preserve event propagation guards for nested controls.

## 6.5 apps/vault/src/components/account/AddAccountSection.tsx

1. Rework import/create tab presentation to match design language.
2. Chain selector chips and create-chain cards get stronger interaction feedback.
3. Desktop pointer on all clickable custom surfaces.

## 6.6 apps/vault/src/components/account/AccountSidebar.tsx

1. Align card visual style with main column.
2. Improve readability of vault id and security bullets.

## 6.7 apps/vault/src/components/account/ConfigImportExport.tsx

1. Keep existing flow logic; refine layout hierarchy in export/import dialogs.
2. Strengthen affordance for file selection area.
3. Ensure desktop pointer for custom clickable regions and icon controls.

### 6.7.1 Dialog Layout Target

1. Header block: icon, title, short description with consistent spacing (`gap-2`/`gap-3`).
2. Security notice: compact info panel with three bullet points and stronger visual grouping.
3. Password field area: single-column with inline validation message directly below field.
4. Primary action row: cancel and confirm actions grouped with clear visual priority.
5. Import result summary: success/failure panel with counts and first error line visible without expansion.

Result panel interaction details:

1. Default collapsed state shows status badge, imported counts, and first error line.
2. `Show details` expands a bounded scroll area listing full errors.
3. `Hide details` returns to collapsed summary.
4. Expanded/collapsed state resets when the dialog closes.

## 7. Accessibility and Usability Considerations

1. Maintain keyboard navigation and focus visibility for all controls.
2. Keep color-contrast-safe combinations based on current token system.
3. Avoid motion overload; transitions remain fast and optional-feeling.
4. Preserve semantic button/input usage when possible; avoid div-as-button unless necessary.

### 7.1 Accessibility Checklist (Implementation)

1. Focus ring:
   - All interactive controls must expose visible `focus-visible` styles with at least 2px equivalent contrast outline.
2. Keyboard support:
   - Tab order follows visual order; Enter/Space activate custom triggers.
3. Labels:
   - Password, alias, key input fields keep explicit labels or `aria-label` when visual labels are hidden.
4. Dialog behavior:
   - Initial focus lands on first actionable element.
   - Escape closes dialog unless action is loading.
5. Announcements:
   - Error and success toasts remain supplemental; critical form errors also appear inline.

## 8. Testing and Verification Plan

1. Visual verification on breakpoints:
   - mobile (`<640`), tablet (`640-1023`), desktop (`>=1024`)
2. Interaction verification:
   - card selection
   - copy address
   - show sensitive info
   - create/import account
   - config export/import flow
3. Pointer policy verification:
   - desktop: clickable custom regions show pointer
   - mobile: pointer not required
4. Regression check:
   - no wallet logic regressions
   - no dialog open/close regressions

## 8.1 Pointer Policy Verification Checklist

1. `AccountCard` clickable shell has `md:cursor-pointer`.
2. Custom toggles and clickable wrappers in add/import sections have `md:cursor-pointer`.
3. File-select trigger zone in config import has `md:cursor-pointer`.
4. Mobile rendering does not force pointer-specific class below `md`.

## 8.2 Verification Method and Acceptance Criteria

1. Verification method:
   - Manual runtime QA for each modified component interaction.
   - Lint/typecheck for touched files.
2. Pass criteria:
   - No new TypeScript or lint errors in touched files.
   - No console/runtime errors in listed interaction flows.
   - Active account remains visually distinguishable using marker + border + surface tint.
   - Pointer checklist passes on desktop and pointer is not forced below `md`.
3. Manual scenario checklist:
   - Select active/inactive account and validate state transitions.
   - Copy address from multiple account cards.
   - Trigger wrong-password import and verify inline + toast feedback.
   - Open/close dialogs in idle and loading states.
   - Verify file trigger affordance and pointer policy on desktop.

## 8.3 Shared Utility Audit

1. Before implementation, audit whether repeated style patterns require shared extraction.
2. Keep styles component-local if repetition is below 3 components.
3. If extraction is needed, create one minimal shared utility for card shell/motion/pointer patterns only.

## 9. Risks and Mitigations

1. Risk: styling changes obscure active/inactive states.
   - Mitigation: combine border, background, and marker cues.
2. Risk: pointer policy applied inconsistently.
   - Mitigation: component checklist and targeted grep review for cursor classes.
3. Risk: over-styling decreases readability.
   - Mitigation: keep typography and spacing decisions constrained and systematic.

## 10. Implementation Sequence (high-level)

1. Phase 1: layout shell and hierarchy
   - `Account.tsx`, `AccountHeader.tsx`, `AccountSidebar.tsx`
2. Phase 2: core interaction surfaces
   - `AccountCard.tsx`, `AccountList.tsx`, tabs and empty states
3. Phase 3: form and dialog refinement
   - `AddAccountSection.tsx`, `ConfigImportExport.tsx`
4. Phase 4: verification and polish
   - pointer checklist, interaction regression, visual pass

This remains one project scope but is intentionally phased to reduce risk and keep each unit independently reviewable.
