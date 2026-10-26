# Pull Request Handoff

## Title

`feat(KB-001): add audited whole-pixel mapping and accessible selection`

## Body

### Summary

- replaces fractional/index-coupled boundary points with stable-ID, intrinsic whole-pixel reducer transactions;
- adds an expandable accessible coordinate editor with native radio selection, paired X/Y edits, stable insertion drafts, reorder/delete controls, per-department 20-entry Undo, inline decisions, and advisory self-intersection feedback;
- synchronizes radio and canvas selection through pointer capture, 6px gesture arbitration, 44px hit targets, cancellation safety, nearest row reveal, focus retention, and non-colour selected markers;
- fences image/workbook callbacks, preserves valid state on failure, and atomically resets editor/view state after the latest successful floor-plan replacement;
- adapts the PharmIQ operational shell for desktop, 390px touch, and 320px widths while retaining sales, heatmap, upload, pan, zoom, intensity, diffusion, and colour semantics;
- adds deterministic Vitest/RTL and Playwright coverage plus complete baseline/final audit evidence.

### Audit comparison

| Dimension | Baseline | Final |
|---|---:|---:|
| Accessibility | 0/4 | 3/4 |
| Performance | 1/4 | 3/4 |
| Theming | 1/4 | 4/4 |
| Responsive Design | 0/4 | 4/4 |
| Implementation Integrity | 0/4 | 4/4 |
| **Total** | **2/20 Critical** | **18/20 Excellent** |

The baseline production entry failed to parse. Final rendered desktop/mobile detector scans are clean. The remaining source detector warning for Inter is rejected because Inter is explicitly required by PharmIQ's design and brand guides.

### Verification

All required commands pass with zero failures:

- focused five-file Vitest command;
- `npm run lint`;
- `npm run test:unit`;
- `npm run build`;
- `npm run test:e2e` across desktop Chromium, synthesized-touch mobile Chromium, and 320px Chromium;
- `npm run verify` after both bounded repair cycles.

There is no standalone typecheck in this JavaScript repository; ESLint remains the static-analysis gate.

### Browser evidence

- Baseline desktop: `docs/audits/KB-001/evidence/desktop-before.png`
- Baseline mobile: `docs/audits/KB-001/evidence/mobile-before.png`
- Final desktop: `docs/audits/KB-001/evidence/desktop-after.png`
- Final synthesized-touch mobile: `docs/audits/KB-001/evidence/mobile-after.png`
- Final 320px: `docs/audits/KB-001/evidence/mobile-320-after.png`

Registered final artifact IDs:

- desktop: `cd31cacb-32b8-47c9-9504-cffc67286f81`
- mobile: `60e7d60d-a391-49ea-bc5e-3c3dbcd619ba`
- 320px: `d9f22456-9a12-44dd-b806-f37150650c63`

### Independent review and repairs

The independent review investigated stable-ID reachability, transaction/history atomicity, file races, gesture order and cleanup, focus/scroll behavior, responsive access, and unchanged heatmap/sales meaning. Two bounded repair cycles:

1. restored view panning before department creation, prevented Clear Points from stranding draft anchors, and balanced body copy;
2. resolved the rendered mobile hierarchy warning while preserving 320px overflow guarantees.

The subsequent workflow review also drove targeted fixes for stable-anchor reordering during drafts, department-scoped deletion confirmation with disabled Undo visibility, floor-plan/workbook callback fencing, and production browser coverage of transformed clicks, pan thresholds, lost capture, field validation, context persistence, all finish outcomes, and keyboard focus behavior. All named and combined gates passed after these changes.

See `docs/audits/KB-001/independent-review.md` and `verification.md` for dispositions and evidence.

### Deferred / remaining risks

- Physical iOS/Android and Safari/Firefox touch hardware remain unverified; Playwright Chromium synthesized touch is the approved substitute.
- The direct `xlsx` dependency retains its pre-existing prototype-pollution/ReDoS advisory. Input validation and failure containment improved, but parser replacement was outside approved scope.
- Very large floor-plan heatmap performance is not benchmarked beyond the deterministic 800×600 fixture; exact existing heatmap semantics were intentionally preserved.
- No backend, persistence, pinch zoom, polygon repair, dark mode, deployment, merge, or production credential access is included.

### Reviewer focus

1. Confirm reducer snapshots and Undo behavior around insertion-anchor deletion.
2. Exercise short select/draw versus >6px pan gestures and interruption cleanup.
3. Confirm image replacement reset scope and stale callback fencing.
4. Compare sales labels, legend, intensity, diffusion, and heatmap colours against incumbent semantics.
5. Inspect 320px/390px wrapping, focus visibility, and keyboard-only coordinate completion.

## Delivery status

Prepared for human review only. The repository exposes a `gh` executable, but authenticated status was not probed and no hosted PR was opened because the task forbids requesting or accessing credentials. This committed handoff is the required PR body; do not auto-merge or deploy.
