# KB-001 Verification Record

Date: 2026-10-25  
Result: **all required runnable gates pass with zero failures**

## Automated commands

| Command | Result | Coverage |
|---|---|---|
| `npx vitest run src/mapping/geometry.test.js src/mapping/editor-state.test.js src/mapping/canvas-interaction.test.js src/components/CoordinateEditor.test.jsx src/App.test.jsx` | Pass | Exact focused gate: 39 tests after review remediation, covering geometry, reducer, pointer sessions, coordinate editor, asynchronous callback ordering, and rendered App. |
| `npm run lint` | Pass | ESLint production and test sources. Installed skill internals, brand reference assets, and explicitly unreachable historical prototypes are excluded rather than edited. |
| `npm run test:unit` | Pass | All `src/**/*.test.{js,jsx}` unit/component/App tests. Vitest is explicitly isolated from Playwright specs. |
| `npm run build` | Pass | Vite production build; confirms the original parse failure is gone. |
| `npm run test:e2e` | Pass | Four production workflows in each of desktop Chromium, mobile synthesized-touch Chromium, and 320px Chromium (12 executions total). |
| `npm run verify` | Pass | Combined lint → unit → build → e2e gate after each bounded repair cycle. |

No standalone typecheck command exists. This is a JavaScript-only repository; `npm run lint` is the available static-analysis substitute and no typecheck pass is claimed.

## Browser projects

| Project | Viewport/input | Result |
|---|---|---|
| `desktop-chromium` | 1280×800, Chromium pointer/keyboard | Pass |
| `mobile-touch-chromium` | 390×844, Playwright Chromium synthesized touch | Pass |
| `narrow-320-chromium` | 320×800, Chromium narrow overflow check | Pass |

The browser flows load the real SPA and committed fixtures, upload valid and invalid image/workbook files, verify known sales association, map self-crossing and transformed polygons at intrinsic whole pixels, and exercise radio/canvas selection, labelled group semantics, paired field validation, keyboard order and visible focus, nearest row reveal, stable-anchor reorder, draft persistence across disclosure/mode/department changes, anchor deletion and atomic Undo, all Finish decisions, pan-versus-select threshold arbitration, pointer cancellation/lost capture, heatmap controls, and zero document/body overflow. They also prove self-intersection warns without blocking completion.

## Original symptom verification

- **Keyboard-only correction:** native radio and labelled X/Y rows support selection and valid whole-pixel mutation without canvas use.
- **Bidirectional stable selection:** radio selection changes the canvas selected square/number; canvas selection checks the same stable-ID radio, opens disclosure, nearest-scrolls the row, and keeps focus.
- **Whole pixels:** pointer transforms round before bounded reducer commit; browser evidence verifies exact fixture coordinates such as `(100, 100)` and `(500, 450)`.
- **Pointer interruption:** moved draw gestures, pointer cancel, lost capture, and mismatched IDs do not commit; view drag pans.
- **Draft/history safety:** draft updates do not consume Undo; confirmed anchor deletion and Undo restore full geometry, selection, warning, order, and draft.
- **Responsive controls:** core functionality remains present and page overflow assertions pass at 320px, 390px, and 1280px.

## Evidence and artifact IDs

| Evidence | Path | Dashboard artifact |
|---|---|---|
| Desktop baseline | `evidence/desktop-before.png` | `bcb56e53-5c14-4f1c-9c41-b77a92286be5` |
| Mobile baseline | `evidence/mobile-before.png` | `32852d60-db72-486f-ac7b-4ae88a6ed737` |
| Desktop final | `evidence/desktop-after.png` | `cd31cacb-32b8-47c9-9504-cffc67286f81` |
| Mobile final | `evidence/mobile-after.png` | `60e7d60d-a391-49ea-bc5e-3c3dbcd619ba` |
| 320px final | `evidence/mobile-320-after.png` | `d9f22456-9a12-44dd-b806-f37150650c63` |

Playwright traces and automatic failure screenshots are retained under ignored local report directories when a run fails. The committed final images come from passing projects. A viewport screenshot alone is not treated as touch proof; `mobile-touch-chromium` executes the workflow through Playwright's synthesized touch engine.

## Detector comparison

- Baseline source: confirmed side-stripe warning; rendered app unavailable due P0 parse failure.
- Final source: only context-free Inter warning, rejected because Inter is the explicit brand body font.
- Final desktop rendered scan: clean.
- Final mobile rendered scan: clean after repair cycle 2.
- Raw results: `baseline-detector.json` and `final-detector.json`.

## Repair cycles

1. Restored panning without an active department, prevented Clear Points from stranding an open draft, and balanced body copy wrapping. Targeted tests and full verify passed.
2. Strengthened the mobile product heading to resolve the rendered hierarchy warning without overflow. All browser projects and full verify passed; final rendered scans became clean.

The later workflow code-review gate identified four implementation/coverage defects. These were remediated without reopening the bounded audit-repair cycle count: stable-anchor reorder is reachable with a draft, deletion confirmation is context-scoped, floor-plan selection fences pending workbook reads, and browser coverage now executes all required production-shaped paths. The focused gate, each named npm gate, and the combined verify gate passed again afterward.

## Unsupported checks and residual risk

- Physical iOS/Android devices and Safari/Firefox touch hardware were unavailable; no physical-device or cross-engine claim is made.
- Very large plan performance is not benchmarked beyond the deterministic 800×600 fixture.
- The existing `xlsx` advisory remains documented; no production credentials, services, or data were accessed.
- No hosted PR was opened because no authenticated repository PR tool was assumed. A complete committed PR body is prepared separately.
