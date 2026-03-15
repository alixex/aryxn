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

## 4. Layout Architecture

## 4.1 Top-level Page Structure

Target file: apps/vault/src/pages/Account.tsx

1. Keep a hero-like page header with stronger separation from body content.
2. Main body uses a dominant content column and a supporting sidebar column.
3. Refine spacing rhythm:
   - Section gaps: large
   - Card gaps: medium
   - Internal component gaps: small
4. Keep single-column flow on mobile; preserve the same section order.

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

## 5.2 Motion System

1. Page section reveal: short fade + slight upward movement.
2. Card hover: tiny elevation and border emphasis only.
3. Dialog transitions: unified fade/scale style.
4. Error hints: non-jarring reveal; no aggressive shake effects.

## 5.3 Pointer Affordance Policy

User-mandated rule:

1. Desktop web clickable surfaces should show pointer cursor.
2. Mobile does not require pointer cursor.

Implementation strategy:

1. Add desktop-scoped pointer class on clickable non-button containers.
2. Keep native buttons with expected pointer semantics on desktop.
3. For icon-only controls rendered as button, ensure pointer on desktop and consistent focus states.

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

## 7. Accessibility and Usability Considerations

1. Maintain keyboard navigation and focus visibility for all controls.
2. Keep color-contrast-safe combinations based on current token system.
3. Avoid motion overload; transitions remain fast and optional-feeling.
4. Preserve semantic button/input usage when possible; avoid div-as-button unless necessary.

## 8. Testing and Verification Plan

1. Visual verification on mobile and desktop breakpoints.
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

## 9. Risks and Mitigations

1. Risk: styling changes obscure active/inactive states.
   - Mitigation: combine border, background, and marker cues.
2. Risk: pointer policy applied inconsistently.
   - Mitigation: component checklist and targeted grep review for cursor classes.
3. Risk: over-styling decreases readability.
   - Mitigation: keep typography and spacing decisions constrained and systematic.

## 10. Implementation Sequence (high-level)

1. Update page shell and section layout in Account.tsx.
2. Update AccountHeader and AccountSidebar for unified framing.
3. Update AccountCard and AccountList for core interaction clarity.
4. Update AddAccountSection and ConfigImportExport for actionable surfaces and dialog polish.
5. Run validation and targeted regression checks.
