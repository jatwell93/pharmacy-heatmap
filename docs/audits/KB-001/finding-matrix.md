# KB-001 Adversarial Finding Matrix

This matrix challenges every immutable baseline finding against the reachable production path. It does not rewrite `baseline.md`; corrections and consolidation live here.

| ID | Severity | Disposition | Evidence and root cause | Remedy assessment | Related | Functionality / brand risk |
|---|---|---|---|---|---|---|
| KB-AUD-001 | P0 | **Reproducible** | Vite and Babel consistently reject the unmatched JSX closing structure at `src/App.jsx:1193-1195`; screenshots show blank/error output. Root cause is malformed component structure with no build/test gate. | Repairing syntax is mandatory and must precede runtime evaluation. The repair should be structural only, with no opportunistic visual change. | KB-AUD-010 | Low behavioral risk, but any incorrect div repair could change shell layout; build and screenshots must confirm reachability. |
| KB-AUD-002 | P1 | **Reproducible** | Source proves canvas click is the sole vertex creation path. No semantic list/table, coordinate inputs, stable radio selection, or keyboard mutation exists anywhere reachable. | A semantic disclosure and coordinate editor is the smallest accessible equivalent. It must share reducer state with canvas rather than create a parallel model. | KB-AUD-003, 004, 010 | High central-workflow risk. Preserve direct canvas drawing and heatmap semantics while adding parity. |
| KB-AUD-003 | P1 | **Reproducible** | `selectedDepartment` is an array index; points are anonymous fractional objects appended from an unrestricted inverse transform. Delete logic manually shifts the department index. | Stable IDs, whole-pixel conversion, bounds checks, derived order labels, and reducer transactions are justified. A reducer is not over-engineering because draft/history/selection need atomic restoration. | KB-AUD-002, 004 | High risk to existing department/sales association and polygon order. Tests must lock semantics. |
| KB-AUD-004 | P1 | **Reproducible** | Reachable canvas binds mouse down/move/up/leave plus click. There is no pointer capture, cancel/lost-capture path, pointer ID, threshold, or target hit test. | One pointer-session model is preferable to layering touch handlers over mouse handlers. Preserve wheel and zoom-button behavior. | KB-AUD-002, 003, 005 | High gesture arbitration risk: a pan must never add/select; interrupted pointers must not commit. |
| KB-AUD-005 | P1 | **Partially supported** | Source strongly predicts narrow-layout failure (`flex` row + full-width sidebar + 900px canvas minimum), hover-only actions, and 32px controls. Actual product layout could not render due KB-AUD-001, so exact overflow dimensions remain unverified. | Responsive stacking, visible actions, and 44px targets are approved as mandatory P1 remediation; exact CSS should be driven by post-repair 320/390/1280 browser measurements, not assumptions. | KB-AUD-004, 007 | Medium visual-identity risk. Adapt rather than redesign; do not hide controls on mobile. |
| KB-AUD-006 | P1 | **Reproducible** | Image and workbook callbacks lack generation tokens. An older image decode can reset newer geometry/data. All known failures use blocking `alert`; spreadsheet reader has no `onerror`. | Request fencing and persistent status are necessary. Retain prior valid state on failure and reset all editor/view transient state only after latest successful image decode. | KB-AUD-003, 007 | High data-loss risk; callback ordering and successful-reset scope require focused tests. |
| KB-AUD-007 | P2 | **Reproducible** | Add/edit/delete controls have symbol-only content, decorative SVGs are exposed, range labels lack `htmlFor`, and zoom buttons rely on `title`. | Explicit names and associations are low-risk and should be completed while restructuring the same controls. Avoid redundant ARIA where native text suffices. | KB-AUD-002, 005 | Low brand risk; copy must remain concise and operational. |
| KB-AUD-008 | P2 | **Partially supported** | Full-resolution canvas allocation, `getImageData`, output allocation, and RGBA iteration are certain. User-visible cost is not measurable until the P0 is fixed and realistic image sizes run. | Remove debug logging and cache only semantically identical heatmap results if measurement/tests support it. Do not rewrite colour or diffusion algorithms on speculation. | KB-AUD-010 | High semantic risk if optimized incorrectly. Output/state assertions are mandatory; deeper optimization may be deferred. |
| KB-AUD-009 | P2 | **Reproducible** | Current `DESIGN.md`/brand guide specify Outfit, semantic tokens, no decorative glass, and no side stripes. Reachable code uses Space Grotesk, raw colours, `.glass-card`, backdrop blur, and `border-l-2`; detector confirms the stripe. | Narrowly align typography, focus, surfaces, and the confirmed stripe/glass instances while preserving operational composition and heatmap colour meaning. No new dark mode or broad redesign. | KB-AUD-005, 011 | Medium identity risk. Token corrections improve consistency but must not alter semantic heat colours or factual copy. |
| KB-AUD-010 | P2 | **Reproducible** | `package.json` has only dev/build/lint/start/preview. No test files/config or typecheck exists. The production parse failure demonstrates the gap. | Add deterministic Vitest/RTL and Playwright checks through `App`; keep JavaScript-only static analysis truthful. A new type system is not required. | All | Low product risk, moderate tooling risk. Tests must avoid encoding implementation-only behavior. |
| KB-AUD-011 | P3 | **Reproducible, deferred unless touched** | An indefinite Tailwind pulse decorates upload success, and no reduced-motion rule exists. It is redundant with text but not blocking. | Remove the pulse if the status component is already edited for KB-AUD-006; otherwise defer as polish. Do not expand into general animation work. | KB-AUD-006, 009 | Minimal risk. Preserve clear success status. |

## Consolidated fix groups

1. **Reachability and deterministic harness:** KB-AUD-001 + KB-AUD-010.
2. **Whole-pixel transactional editor:** KB-AUD-002 + KB-AUD-003 + the editor portion of KB-AUD-007.
3. **Unified pointer interaction:** KB-AUD-004 + target-size portion of KB-AUD-005.
4. **Safe upload/lifecycle feedback:** KB-AUD-006 + status/naming portions of KB-AUD-007 + incidental KB-AUD-011.
5. **Responsive and brand-conformant shell:** confirmed parts of KB-AUD-005 + KB-AUD-009.
6. **Measured rendering hygiene:** confirmed debug/allocation concerns in KB-AUD-008 without semantic algorithm changes.

## Detector-specific dispositions

- `side-tab` at `src/App.jsx:753`: true positive, represented by KB-AUD-009.
- Mobile `script-error` against the Vite overlay: duplicate/secondary symptom of KB-AUD-001, not a separate issue.
- Empty desktop URL output: false implication if interpreted as a clean scan; the target DOM never rendered.

## Deferred and rejected scope

- **Deferred:** broad heatmap algorithm optimization until after objective runtime measurement; physical iOS/Android and Safari/Firefox touch hardware; cross-engine behavior; optional P3 motion polish outside already-touched status UI.
- **Rejected:** dark mode, new backend persistence, multi-user state, pinch zoom, arbitrary polygon repair, marketing-page restyling, and edits to unreachable `src/heatmap.js` / `src/heatmap.jsx`.
- **Not a finding:** absence of a TypeScript typecheck in this JavaScript repository. Lint is the existing static-analysis substitute unless a separately justified checker is introduced.
- **Tracked dependency risk:** the direct `xlsx` package has a pre-existing high advisory. Replacing SheetJS or changing parsing semantics is not implicit audit scope; local-file validation and failure containment remain in scope.
