# KB-001 Baseline Impeccable Audit

Captured: 2026-10-25  
Production path: `src/main.jsx` → `src/App.jsx`  
Status: **immutable after this baseline commit**

## Implementation integrity verdict

**Fail.** The only production entry path does not compile: Vite/Babel reports `Unexpected token, expected ","` at `src/App.jsx:1195`, so users receive the development error overlay or an empty page rather than the application. The source also couples department and vertex identity to array indexes, exposes mapping only through mouse canvas clicks, and contains no accessible equivalent for boundary editing. The detector's single source-level side-tab warning is valid, while the rendered detector results are not representative because the parse failure prevented the product UI from loading.

## Audit health score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 0/4 | The page is unavailable; source inspection additionally shows mouse-only mapping and unnamed icon controls. |
| 2 | Performance | 1/4 | Runtime measurement is blocked; source regenerates full-resolution canvases and loops every pixel on redraw. |
| 3 | Theming | 1/4 | Brand tokens exist only partially; incumbent code uses raw colours, glass treatment, Space Grotesk, and an explicit side stripe contrary to current guidance. |
| 4 | Responsive Design | 0/4 | The page is unavailable; source uses a desktop flex row, a full-width sidebar, a 900px minimum canvas height, mouse handlers, and sub-44px controls. |
| 5 | Implementation Integrity | 0/4 | The production module has a parse error and central geometry is fractional and index-coupled. |
| **Total** |  | **2/20** | **Critical (fundamental issues)** |

## Executive summary

- **Issues:** P0: 1, P1: 5, P2: 4, P3: 1.
- The blocking parse error prevents all task completion and makes rendered scoring necessarily conservative.
- Boundary mapping has no keyboard/table equivalent, stores fractional points, and cannot synchronize a durable selection.
- Mouse-only canvas handlers have no pointer capture, movement arbitration, cancellation path, or touch-safe target model.
- Upload failures rely on blocking alerts and asynchronous callbacks are not fenced, risking stale replacement and ambiguous recovery.
- The fixed desktop composition and hover-only actions are not usable at the required 320px/390px widths.

## Findings

### KB-AUD-001 — Production SPA fails to parse [P0]

- **Category:** Implementation Integrity / Accessibility / Responsive
- **Location:** `src/App.jsx:1193-1195`
- **Evidence:** Vite and Babel report `Unexpected token, expected ","` at line 1195. `mobile-before.png` captures the error overlay; the blank desktop captures demonstrate inconsistent failure rendering.
- **Impact:** No user can reach uploads, mapping, heatmap, or controls.
- **Standard:** WCAG 2.1.1 Keyboard and 4.1.2 Name, Role, Value are moot when the application cannot load; release-blocking functional integrity failure.
- **Recommendation:** Repair the malformed JSX before evaluating runtime behavior, then run build and rendered scans.

### KB-AUD-002 — Boundary mapping is mouse-only with no structured equivalent [P1]

- **Category:** Accessibility
- **Location:** `src/App.jsx:235-291`, `src/App.jsx:1108-1114`
- **Evidence:** The only point-creation path is canvas `onClick`; coordinates are painted pixels with no DOM rows, form fields, radio selection, or keyboard-operable alternative.
- **Impact:** Keyboard, switch, screen-reader, and precision-input users cannot create or correct a mapped area.
- **Standard:** WCAG 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 4.1.2 Name, Role, Value.
- **Recommendation:** Add one semantic coordinate editor backed by the same stable-ID state and preserve canvas input as an equivalent path.

### KB-AUD-003 — Fractional/index-coupled geometry is fragile [P1]

- **Category:** Implementation Integrity
- **Location:** `src/App.jsx:9-13`, `src/App.jsx:163-179`, `src/App.jsx:214-229`, `src/App.jsx:235-289`
- **Evidence:** Departments are selected by array index and vertices are anonymous `{x, y}` values. Inverse transforms return unrestricted fractional values and clicks append them directly.
- **Impact:** Reorder/delete operations cannot preserve durable vertex selection or draft anchors; coordinates are not auditable intrinsic pixels.
- **Recommendation:** Use stable department/vertex IDs, integer bounds validation, and one reducer transaction per committed mutation.

### KB-AUD-004 — Canvas gesture handling excludes touch and interruption safety [P1]

- **Category:** Responsive / Accessibility
- **Location:** `src/App.jsx:293-325`, `src/App.jsx:1108-1114`
- **Evidence:** Panning uses mouse down/move/up/leave state; drawing is a separate click path. There is no pointer ID, capture, cancel/lost-capture cleanup, or movement threshold.
- **Impact:** Touch mapping is unavailable and interrupted gestures can leave ambiguous drag/click behavior.
- **Standard:** WCAG 2.5.1 Pointer Gestures, 2.5.2 Pointer Cancellation, 2.5.8 Target Size (Minimum).
- **Recommendation:** Introduce one pointer-session state machine with capture, 6 CSS-pixel arbitration, cancellation cleanup, and screen-space hit testing.

### KB-AUD-005 — Narrow layouts obscure the canvas and actions [P1]

- **Category:** Responsive Design
- **Location:** `src/App.jsx:741-744`, `src/App.jsx:1096-1101`, `src/App.jsx:1063-1090`
- **Evidence:** The main region stays a row, while the sidebar is `w-full`; the canvas has `minHeight: "900px"`. Department actions are `opacity-0` until group hover, and many controls are 32–40px.
- **Impact:** At 320px/390px the control panel occupies the row, canvas access is obscured, touch actions are undiscoverable, and target sizes are below 44px.
- **Standard:** WCAG 1.4.10 Reflow, 2.5.8 Target Size (Minimum), 1.4.13 Content on Hover or Focus.
- **Recommendation:** Stack/adapt the shell, keep actions visible without hover, and provide at least 44px targets without page overflow.

### KB-AUD-006 — Upload lifecycle is stale-callback prone and errors are alert-only [P1]

- **Category:** Implementation Integrity / Accessibility
- **Location:** `src/App.jsx:44-74`, `src/App.jsx:78-139`
- **Evidence:** `FileReader` and `Image` callbacks have no request token; image success resets all app data even if a newer selection has completed. Failures use `alert`, and spreadsheet read errors are not handled separately.
- **Impact:** Slow earlier uploads can overwrite newer user work; error context is transient, blocking, and not exposed as persistent status.
- **Standard:** WCAG 3.3.1 Error Identification, 4.1.3 Status Messages.
- **Recommendation:** Fence callbacks, validate type/content, preserve prior valid state on failure, and expose visible live-region feedback.

### KB-AUD-007 — Icon controls and range labels lack robust accessible names [P2]

- **Category:** Accessibility
- **Location:** `src/App.jsx:873-885`, `src/App.jsx:951-980`, `src/App.jsx:1051-1089`, `src/App.jsx:1139-1188`
- **Evidence:** The manual add button contains only `+`; edit/delete buttons contain only unhidden SVGs; range labels do not use `htmlFor`; zoom controls rely on `title` rather than explicit names.
- **Impact:** Assistive technology receives missing or weak control names and label associations.
- **Standard:** WCAG 1.3.1 Info and Relationships, 2.4.6 Headings and Labels, 4.1.2 Name, Role, Value.
- **Recommendation:** Add explicit visible or ARIA names, hide decorative SVGs, and associate every label with its input.

### KB-AUD-008 — Full-image heatmap work repeats on interaction [P2]

- **Category:** Performance
- **Location:** `src/App.jsx:354-485`, `src/App.jsx:489-716`
- **Evidence:** Each relevant redraw resizes offscreen canvases, allocates a temporary canvas and image buffer, reads all pixels, creates output image data, and runs a full RGBA loop. Debug logging occurs in the render effect.
- **Impact:** Large plans and slider/pointer changes can block the main thread and make drawing or panning feel unresponsive.
- **Recommendation:** Cache by semantic heatmap inputs, reuse buffers where measurable, and remove development logging while preserving exact output semantics.

### KB-AUD-009 — Visual implementation drifts from current PharmIQ rules [P2]

- **Category:** Theming / Implementation Integrity
- **Location:** `src/index.css:3-50`, `src/App.jsx:747-755`, `src/App.jsx:1127-1135`, `index.html:11`
- **Evidence:** Space Grotesk replaces the specified Outfit UI heading font; raw colours and pure white are widespread; `.glass-card` uses decorative backdrop blur; the setup note uses a coloured left stripe. The source detector independently reports the line 753 `side-tab` pattern.
- **Impact:** The tool feels less like calm, operational PharmIQ infrastructure and semantic meaning is harder to maintain.
- **Recommendation:** Apply existing semantic PharmIQ tokens and typography narrowly; remove only confirmed glass/stripe drift without redesigning heatmap meaning.

### KB-AUD-010 — No regression harness exists for the production path [P2]

- **Category:** Implementation Integrity
- **Location:** `package.json`, repository test inventory
- **Evidence:** No test, browser-test, or typecheck script exists; there are no unit/component/e2e tests. The current parse regression was therefore committed undetected.
- **Impact:** Central upload, geometry, pointer, and responsive behavior can regress without an automated gate.
- **Recommendation:** Add focused Vitest/RTL and Playwright coverage through rendered `App`, plus lint/build/combined verification scripts.

### KB-AUD-011 — Decorative animation ignores reduced-motion intent [P3]

- **Category:** Accessibility / Theming
- **Location:** `src/App.jsx:786`
- **Evidence:** The synced status dot uses an indefinite pulse with no project reduced-motion override.
- **Impact:** Low-severity distraction; it communicates status redundantly in text and does not block work.
- **Standard:** WCAG 2.3.3 Animation from Interactions is not directly triggered here, but reduced-motion preference should still be respected.
- **Recommendation:** Remove the decorative pulse or disable it under `prefers-reduced-motion` during approved polish only.

## Systemic patterns

1. Central state is split across independent setters and index identities rather than atomic domain transactions.
2. Canvas-only information and interactions have no semantic DOM representation.
3. Mouse assumptions, hover revelation, and small controls recur across the operational flow.
4. Errors use browser dialogs instead of persistent, programmatic application feedback.
5. Styling mixes Tailwind theme aliases, raw colours, and legacy glass treatment rather than the current semantic system.

## Positive findings to preserve

- `src/main.jsx` has one clear production path and the two historical heatmap prototypes are unreachable.
- Native file inputs and a native visibility checkbox are used, and upload labels are explicitly associated.
- The page declares English, includes the viewport meta tag, and has a single product-specific H1 in source.
- Heatmap visibility, intensity, diffusion, sales labels, pan, zoom, and department management are already product-specific concepts worth preserving.
- The colour legend pairs labels and values with colour rather than relying solely on colour.

## Detector results and false-positive handling

- Source scan: one valid `side-tab` warning at `src/App.jsx:753`.
- Desktop URL scan: empty result because parsing prevented the intended DOM from rendering; **not** counted as a pass.
- Mobile URL scan: detector reported a Vite error-overlay exception. This is secondary/partially supported; the underlying reproducible issue is the App JSX parse failure, so it is consolidated into `KB-AUD-001` rather than double-counted.
- Detector output is preserved in `baseline-detector.json`.

## Runtime evidence and limitations

Deterministic 800×600 PNG and XLSX inputs plus malformed counterparts were prepared under `evidence/`, but uploads, department creation/deletion, drawing, pan/zoom, heatmap controls, and error recovery could not be exercised because the production module failed before mount. `mobile-before.png` captures the 390×844 Vite error overlay; `desktop-before.png` and `mobile-320-before.png` capture blank failure output. No claim is made about successful runtime behavior, touch behavior, contrast pixels, or valid parsing. Those workflows must be exercised after the P0 repair and compared against this immutable baseline/source evidence.
