# PharmIQ Heat-Map Dashboard

A client-side floor-plan editor for mapping pharmacy profit centers and visualizing normalized sales intensity. The application keeps floor-plan images, workbooks, coordinates, drafts, and history in browser memory; it does not upload pharmacy data to a backend.

## Requirements

- Node.js with npm
- A modern browser with Canvas, FileReader, and Pointer Events support

```bash
npm ci
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`.

## Supported inputs

### Floor plan

Choose a valid PNG or JPEG. The application reports the image's intrinsic dimensions and stores every boundary coordinate in that intrinsic pixel space.

A successful replacement clears the prior geometry, selection, drafts, history, warnings, sales data, pan, and zoom together. An unsupported, unreadable, or undecodable image leaves the current valid floor plan and mapping unchanged and displays an actionable status message.

### Sales intelligence

Choose an XLSX or XLS workbook whose first worksheet contains:

- department name in column A;
- normalized sales value in column C;
- a header row before the data.

Sales values retain the established PharmIQ interpretation. Missing or nonnumeric sales values become zero. A malformed or unsupported workbook leaves the current valid sales data unchanged and explains the required format. The latest file selection wins if reads complete out of order.

## Mapping workflow

1. Upload a floor plan.
2. Optionally upload the sales workbook.
3. Add a profit center from workbook departments or enter a unique name.
4. In mapping mode, use short canvas gestures to add vertices or use **Boundary coordinates** for keyboard-only editing.
5. Add at least three vertices and choose **Finish Area**.

### Whole-pixel coordinate editor

Expand **Boundary coordinates** to inspect and repair the active profit center:

- Every committed vertex has a stable identity and one native radio in a department-named group.
- Visible vertex numbers always reflect current polygon order; reordering never changes identity.
- X and Y accept finite whole pixels from `0` through the floor plan's intrinsic width or height. Blank, decimal, nonnumeric, non-finite, negative, and out-of-bounds values never mutate committed geometry.
- Selecting a field does not change the checked radio. A valid paired row edit becomes one Undo entry when the row edit session completes.
- **Insert after** keeps an unfinished X/Y draft anchored to the selected stable vertex. The draft follows that vertex through reorder and department/mode/disclosure changes.
- **Move up**, **Move down**, **Delete**, and **Undo** act on the checked vertex. Each profit center has an independent LIFO history capped at 20 committed mutations.
- Deleting a draft anchor requires the inline **Delete vertex and draft** decision. Undo restores the anchor, order, selection, complete draft, geometry, and warning atomically.
- Undo stays visible but disabled with an explanation while an insertion or inline decision is unresolved.

A self-crossing polygon displays a visible programmatic warning. The warning is advisory: it never blocks finishing an area with at least three vertices.

### Finish Area with a draft

When an insertion draft is open, **Finish Area** presents inline choices:

- **Return to draft** restores X-field focus;
- **Finish and keep draft** leaves mapping mode and preserves the department draft;
- **Finish and discard draft** leaves mapping mode and removes the draft;
- **Dismiss** returns to mapping unchanged.

No choice silently commits unfinished insertion values.

## Canvas and keyboard behavior

- A short gesture on empty canvas in mapping mode adds one rounded, bounded whole-pixel vertex.
- A short gesture within a 44 CSS-pixel vertex target selects that stable vertex without changing pan or zoom.
- Canvas selection opens the coordinate disclosure, checks the matching radio, scrolls only that row with nearest alignment, retains current DOM focus, and announces the selection.
- Radio selection highlights the same numbered canvas vertex with colour plus a square/weight distinction.
- A view-mode movement beyond 6 CSS pixels pans only. A moved draw gesture does not add a point.
- Pointer capture, pointer ID checks, cancellation, and lost-capture cleanup prevent stale or interrupted gestures from committing.
- Mouse wheel and the named zoom buttons preserve the existing 10%–500% zoom range. **Reset view** restores 100% and zero pan.
- Keyboard users can complete boundary creation and correction through native radios, labelled coordinate fields, and the shared toolbar without using the canvas.

## Responsive and accessibility behavior

The desktop shell keeps controls beside the floor plan. At tablet/mobile widths it stacks into one readable task flow without removing controls. The verified layouts are 1280×800 desktop, 390×844 synthesized-touch mobile, and a 320px overflow check. Interactive controls provide at least 44px targets, visible focus, native form semantics, persistent status/error text, and non-colour selection cues.

Physical iOS/Android and Safari/Firefox touch hardware are not part of the automated environment. Chromium desktop/mobile projects and Playwright synthesized touch are the supported verification substitute.

## Development and verification

```bash
# Static analysis (this JavaScript repository has no standalone typecheck)
npm run lint

# Focused production-path tests
npx vitest run src/mapping/geometry.test.js src/mapping/editor-state.test.js src/mapping/canvas-interaction.test.js src/components/CoordinateEditor.test.jsx src/App.test.jsx

# All unit/component tests
npm run test:unit

# Production build
npm run build

# Desktop, mobile/touch, and 320px Chromium workflows
npm run test:e2e

# Combined lint → unit → build → browser gate
npm run verify
```

Playwright retains traces and screenshots for failures in ignored local report directories. Committed deterministic fixtures live in `tests/fixtures/` and contain no production data.

## Project structure

- `src/App.jsx` — reachable upload, department, visualization, and canvas integration
- `src/components/CoordinateEditor.jsx` — semantic whole-pixel editor and inline decisions
- `src/mapping/editor-state.js` — stable-ID reducer, drafts, warning snapshots, and bounded history
- `src/mapping/geometry.js` — transforms, validation, hit testing, and intersection detection
- `src/mapping/canvas-interaction.js` — pointer-session arbitration
- `tests/e2e/heatmap-mapping.spec.js` — fixture-driven production workflow
- `docs/audits/KB-001/` — immutable baseline, finding matrix, approved remediation plan, final audit, review, verification, PR handoff, and registered visual evidence

`src/heatmap.js` and `src/heatmap.jsx` are preserved unreachable historical prototypes. Production mounts only `src/App.jsx` from `src/main.jsx`.

## Known residual risks

- The existing direct `xlsx` dependency has published prototype-pollution and ReDoS advisories. Local-file validation, callback fencing, and exception containment reduce impact, but parser replacement was outside KB-001's approved scope.
- Very large floor plans may make the exact full-image heatmap colour pass expensive; the task preserved existing intensity, diffusion, colour, normalization, and label semantics rather than applying an unproven algorithm change.
