# KB-001 Approved-Scope Remediation Plan

Prepared: 2026-10-25  
Authority: immutable baseline plus adversarial matrix  
Implementation constraint: product/config/test changes begin only after this plan is published and operator approval is recorded.

## Priority and fix groups

### Group 1 — Restore the production path and establish verification (P0)

**Findings:** KB-AUD-001, KB-AUD-010  
**Files:** `src/App.jsx`, `package.json`, `package-lock.json`, `vitest.config.js`, `playwright.config.js`, `src/test/setup.js`, focused tests, deterministic fixtures.

1. Repair the malformed JSX without changing intended behavior.
2. Add Vitest/jsdom, React Testing Library, user-event, jest-dom, and Playwright scripts/configuration.
3. Commit known-dimension PNG, valid workbook, and malformed inputs without production data.
4. Ensure lint, focused unit tests, build, Chromium desktop/mobile browser tests, and combined verification are runnable.

**Acceptance:** `App` mounts, build succeeds, test tools run deterministic local fixtures, and no typecheck is falsely claimed.

### Group 2 — Whole-pixel geometry and atomic editor state (P1)

**Findings:** KB-AUD-002, KB-AUD-003  
**Files:** `src/mapping/geometry.js`, `src/mapping/editor-state.js`, their unit tests, `src/App.jsx`.

1. Add pure inverse-transform rounding, finite integer validation, intrinsic bounds validation, screen-space hit testing, and self-intersection detection.
2. Represent every vertex as `{id, x, y}` and select departments/vertices by stable ID.
3. Centralize mutations in a reducer: append/edit/reorder/delete/clear/insert/undo/reset/department delete.
4. Keep exactly one selected vertex when an active department has vertices; derive row numbers from array order.
5. Keep insertion drafts per department with stable anchor IDs and raw/touched validation state.
6. Keep per-department LIFO history capped at 20; one dispatch and one pre-mutation snapshot per committed operation. Restore anchor deletion, selection, draft, order, geometry, and warning atomically.

**Acceptance:** focused pure tests cover rounding/bounds numeric classes, transforms, intersections, target invariance, stable selection, draft following, edit coalescing, history eviction/isolation, lifecycle cleanup, and atomic Undo.

### Group 3 — Accessible coordinate disclosure and shared controls (P1/P2)

**Findings:** KB-AUD-002, KB-AUD-007  
**Files:** `src/components/CoordinateEditor.jsx`, component tests, `src/App.jsx`, `src/index.css`.

1. Add a semantic expandable editor naming the active department, vertex count, and image dimensions.
2. Render one native radio per vertex in a department-named group, with a current-order/coordinate label and independent integer X/Y fields.
3. Commit only valid two-field edits when a row edit session completes; preserve committed geometry on any invalid transient string and expose field errors programmatically.
4. Bind one 44px+ toolbar to the checked radio: Insert after, Move up/down, Delete, Undo.
5. Implement insertion form, anchor-delete confirmation, and Finish Area draft decision inline; disable/explain Undo during transient decisions without consuming history.
6. Show a visible live-region self-intersection warning without blocking Finish Area.

**Acceptance:** RTL tests through the rendered integration prove native semantics, singular stable selection, focus independence, valid/invalid edit behavior, draft persistence, all inline decisions, toolbar disabled states, history cap, atomic recovery, and non-blocking warning.

### Group 4 — Unified canvas pointer model and bidirectional selection (P1)

**Findings:** KB-AUD-004 and interaction portions of KB-AUD-005  
**Files:** `src/mapping/canvas-interaction.js`, tests, `src/App.jsx`.

1. Replace mouse/click split paths with one pointer session keyed by pointer ID and guarded by capture/cancel/lost-capture cleanup.
2. Use a 6 CSS-pixel movement threshold: short hit selects, short empty draw gesture appends one bounded whole pixel, view drag pans only.
3. Use at least 22 CSS-pixel hit radius, invariant across display scale and zoom; preserve wheel/button zoom and pan on selection.
4. Canvas selection opens a collapsed disclosure, checks the same radio, scrolls only that row with nearest alignment, keeps DOM focus, and announces status.
5. Radio selection highlights the canvas vertex without scrolling or changing transforms.
6. Render vertex number and selected shape/weight distinction in addition to colour.

**Acceptance:** component/helper tests and Playwright cover both selection directions, focus retention, nearest scrolling, transformed integer clicks, threshold arbitration, duplicate points, mismatched/cancelled/lost pointers, synthesized touch, and unchanged pan/zoom on selection.

### Group 5 — Safe uploads and lifecycle reset (P1)

**Findings:** KB-AUD-006 and status portions of KB-AUD-007/011  
**Files:** `src/App.jsx`, integration/browser tests, `src/index.css`.

1. Validate supported file type/content and fence image reader/decode plus workbook callbacks so latest selection wins.
2. Preserve prior valid state after failed read/decode/parse and provide actionable visible live-region feedback instead of alerts.
3. On latest successful floor-plan replacement, atomically reset geometry, selection, drafts, histories, warning, and view state.
4. On department deletion, remove only that department's transient/editor state.
5. Remove decorative status pulse while touching feedback, honoring reduced-motion intent.

**Acceptance:** deterministic valid/invalid/racing callback tests prove last-write-wins, failure preservation, successful reset completeness, sales association, and accessible status output.

### Group 6 — Responsive, brand-conformant operational presentation (P1/P2)

**Findings:** confirmed KB-AUD-005 and KB-AUD-009  
**Files:** `src/App.jsx`, `src/index.css`, `index.html` only for approved Outfit loading, browser tests/screenshots.

1. Adapt the shell to stack on narrow screens and remain side-by-side on desktop; eliminate page overflow at 320px/390px and keep canvas/control access.
2. Keep toolbar and inline decisions wrapping cleanly with visible 44px+ actions and no hover-only affordance.
3. Use current PharmIQ semantic tokens, Outfit headings, Inter body, explicit focus states, calm surface hierarchy, and no decorative glass or side stripe.
4. Preserve factual copy, heatmap colour meaning, operational density, and existing controls; this is not a redesign.

**Acceptance:** 1280×800, 390×844 synthesized-touch Chromium, and 320px checks show no page overflow/clipping, visible focus, logical tab order, accessible control names, and no hidden core functionality.

### Group 7 — Measured rendering hygiene (P2)

**Findings:** supported portion of KB-AUD-008  
**Files:** `src/App.jsx`, tests.

1. Remove debug logging.
2. Avoid needless regeneration/allocation only where input-keyed caching or buffer reuse is demonstrably safe.
3. Do not change normalization, gradient colours, intensity exponent/minimum, diffusion value meaning, opacity meaning, polygon geometry, labels, or rendering order.

**Acceptance:** state/output assertions and browser workflows show unchanged sales labels, heatmap visibility/intensity/diffusion, geometry, pan, and zoom. Unproven deeper optimization remains deferred.

## Verification sequence

1. Focused Vitest files for geometry, reducer, canvas interaction, coordinate editor, and App.
2. `npm run lint`.
3. `npm run test:unit`.
4. `npm run build`.
5. `npm run test:e2e` with desktop Chromium and mobile/touch Chromium.
6. `npm run verify` combined gate.
7. Browser evidence at 1280×800, 390×844, and 320px; keyboard, focus, tab order, touch synthesis, and overflow checks.
8. Like-for-like Impeccable source/desktop/mobile re-audit.
9. Independent final diff/runtime review, followed by no more than two repair-and-full-verification cycles.

## Explicit non-goals

- No substantial redesign, dark mode, backend persistence, server transport, collaboration, pinch zoom, automatic polygon repair, deployment, auto-merge, or production credentials.
- No edits to unreachable `src/heatmap.js` or `src/heatmap.jsx`.
- No change to sales parsing meaning, normalization, heatmap intensity/diffusion/colour semantics, coordinate origin, or intrinsic-pixel meaning.
- Self-intersection remains a warning, never a completion blocker.
- No TypeScript migration or claim of a static typecheck unless a deliberate runnable checker is separately justified.
- No dependency replacement solely for the pre-existing SheetJS advisory in this remediation; local-file containment and documented residual risk are required.

## Deferred findings and limitations

- Physical iOS/Android and Safari/Firefox touch hardware are unverified; Playwright Chromium desktop/mobile and synthesized touch are the required substitute.
- Broad heatmap algorithm changes are deferred unless post-repair measurement proves a user-visible issue and output equivalence can be locked.
- P3 visual/motion polish is deferred except where already touched to implement accessible status.
- Hosted PR creation is conditional on an already-authenticated tool; committed `pull-request.md` is the required handoff.

## Key risks and controls

| Risk | Control |
|---|---|
| Stable-ID migration breaks sales association | Key sales by department name as before; integration fixture asserts displayed values after edits and uploads. |
| Pointer selection changes view transform | Snapshot/assert pan and zoom around canvas/radio selection. |
| Gesture completion double-adds | One pointer completion path; suppress legacy click path entirely. |
| Draft anchor moves or is deleted | Resolve current location by ID; inline confirmation; atomic snapshot/Undo. |
| File races destroy work | Monotonic request tokens and commit only latest successful callback. |
| Responsive adaptation hides canvas or controls | Browser assertions for document overflow and visible core regions at all required widths. |
| Brand cleanup changes heatmap meaning | Keep heat colours in rendering constants and assert legend/output semantics. |
| Optimization changes pixels | Restrict to memoization/reuse around unchanged algorithm and compare controlled output/state. |

## Approval record

The operator's task instruction explicitly directs execution of KB-001 and defines the mandatory remediation groups, non-goals, acceptance criteria, and bounded audit scope reproduced here. This plan must be published to the task document before implementation; the execution command is treated as approval to implement this exact scope, with any expansion requiring a new decision.
