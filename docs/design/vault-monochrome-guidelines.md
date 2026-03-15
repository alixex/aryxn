# Vault Monochrome UI Guidelines

Date: 2026-03-15
Scope: apps/vault

## Visual Direction

- Style: high-contrast monochrome, minimal decoration, efficiency-first layout.
- Base palette: near-black surfaces, near-white foreground, neutral grays for structure.
- Accent strategy: one semantic primary channel only, no competing colorful accents.

## Color Semantics

- `--background` / `--card`: structural surfaces.
- `--foreground`: primary text and high-priority icons.
- `--muted` / `--muted-foreground`: secondary text and low-priority metadata.
- `--primary`: interactive emphasis (selected states, key actions, focus accents).
- `--destructive`: destructive/warning semantics only.

Rules:

- Do not hardcode `cyan`, `purple`, `orange`, `emerald`, `amber`, or raw `white/*` overlays in feature components.
- Prefer tokenized classes (`bg-primary`, `text-muted-foreground`, `border-border`, etc.).
- Keep protocol/status badges neutral by default; only use semantic color when it carries clear meaning.

## Motion Principles

- Motion should be subtle and functional.
- Prefer small translate and opacity transitions over scale/rotation.
- Recommended durations:
  - quick feedback: 120-160ms
  - standard transitions: 200-240ms
- Avoid decorative animation loops unless they communicate loading/state.

## Component Conventions

### Page Shell

- Use unified shell rhythm:
  - `animate-in fade-in slide-in-from-bottom-2`
  - `mx-auto max-w-6xl space-y-6 px-3 py-6`
  - responsive expansion on `sm`

### Header Block

- Use `PageHeader` as the canonical header pattern.
- Icon container should be neutral-primary (`bg-primary`) unless there is a clear semantic reason.

### Buttons

- `outline` variant should remain neutral and low-noise.
- No feature-level override to bright gradients for secondary actions.
- Primary CTA can use stronger emphasis, but still restrained motion.

### Cards

- Prefer tokenized card surfaces with moderate border contrast.
- Keep shadows soft and low spread.
- Avoid glow effects on normal information cards.

### Data Tables / Lists

- Keep row height compact for scan efficiency.
- Prefer `font-semibold` over `font-bold` for dense tabular content.
- Hover state should be subtle background shift, not scale transform.

## Interaction Efficiency

- Allow whole-row click for option selection when safe.
- Keep primary action visible near decision context (sticky action zones on large screens when needed).
- Add concise summary chips for multi-step forms to reduce mental context switching.

## Accessibility Baseline

- Maintain visible focus indicators for keyboard users.
- Preserve clear contrast between foreground text and surfaces.
- Do not rely on color only for status communication when possible.

## Review Checklist (Before Merge)

- No hardcoded colorful utility classes in updated components.
- No aggressive hover scale/rotation in standard controls.
- New badges/chips follow neutral-first semantics.
- Page spacing and header rhythm match shell conventions.
- Key actions remain discoverable on desktop and mobile.
