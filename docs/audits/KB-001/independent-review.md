# KB-001 Independent Review

Review scope: final diff from baseline `d3de9ab` through the implementation, plus fixture-driven runtime behavior.  
Method: a separate reviewer agent was requested, but the execution environment reported its reviewer capacity was already occupied. The required review was therefore performed as an explicit read-only adversarial pass distinct from implementation, with every concern investigated against tests/runtime before disposition.

## Review checklist and dispositions

| Area | Concern investigated | Disposition |
|---|---|---|
| Stable-ID reachability | Could App still couple active department, selected vertex, draft anchor, labels, or history to array indexes? | **Resolved.** App dispatches department/vertex IDs; index is derived only for visible order and next/previous selection. Reducer tests cover reorder/delete/following anchors. |
| Selection invariant | Could active non-empty geometry have zero or multiple selected IDs? | **Resolved.** `selectedForVertices` repairs selection after every mutation/activation; native radios share an HTML name inside a labelled `fieldset` group. App/RTL tests cover both selection directions and the accessible group name. |
| Reducer atomicity | Could delete + draft + warning + Undo restore partially? | **Resolved.** One pre-mutation snapshot carries vertices, selected ID, full draft, and warning; one reducer dispatch deletes and one Undo restores. |
| History semantics | Could transient edits consume history or leak across departments? | **Resolved.** Only committed mutations snapshot; drafts update separately; LIFO, 20-entry eviction, and department isolation are tested. |
| Dangling draft | Could Clear Points remove the anchor but keep its draft? | **Found and fixed in repair cycle 1.** Clear Points is disabled with an explanatory title while a draft exists; anchor deletion has its dedicated atomic decision path. |
| File callback ordering | Could an older read/decode overwrite a newer selection? | **Resolved after workflow review.** Both file flows increment monotonic tokens before validation/read and check after asynchronous completion. A floor-plan selection also invalidates any pending workbook token; controlled App tests exercise both callback completion orders. |
| Failure preservation | Could invalid image/workbook state clear valid work? | **Resolved.** State changes occur only after latest successful decode/parse; App and browser tests assert prior valid plan/sales remain. |
| Gesture arbitration | Could a drag select/add, a generated click double-add, or a stale pointer finish? | **Resolved.** There is no legacy click path; pointer completion checks pointer ID and threshold. Cancel/lost capture clear the session. Helper, App, and browser tests cover moved/mismatched/cancelled sessions. |
| Pan availability | Could view panning disappear before any department exists? | **Found and fixed in repair cycle 1.** Pointer sessions now begin whenever a floor plan exists; App regression asserts nonzero translation before department creation. |
| Hit target and transforms | Could visual zoom shrink hit targets or selection modify pan/zoom? | **Resolved.** Hit testing projects intrinsic vertices into CSS space and uses a 22px radius; tests cover representative zooms and unchanged 100% view during selection. |
| Focus/scroll | Could canvas selection steal keyboard focus or scroll the panel excessively? | **Resolved.** Selection never calls focus; disclosure opens imperatively and only the target row receives nearest/nearest `scrollIntoView`. App test asserts retained focus. |
| Upload security | Does local workbook parsing remain a dependency risk? | **Residual, documented.** Type/content checks and exception containment are present, but the existing SheetJS advisory remains outside parser-replacement scope. |
| Heatmap/sales semantics | Did migration alter parsing columns, sales defaults, intensity exponent/minimum, diffusion, opacity, colours, labels, or draw order? | **Resolved.** Column A/C parsing and zero fallback remain; original colour range, exponent, minimum intensity, blur multiplier, opacity amplification, labels, and transformed draw order are preserved. Fixture tests assert $125,000 association and controls. |
| Responsive hierarchy | Could mobile overflow or hide core actions? | **Resolved.** 320, 390 touch, and 1280 projects assert document/body overflow and execute the same controls; rendered evidence is registered. |
| Audit detector | Are final warnings real defects? | **One rejected false positive.** Inter is deliberately mandated by PharmIQ. The mobile hierarchy warning was reproducible and fixed in repair cycle 2; final rendered scans are clean. |
| Draft anchor reorder | Could the reducer support stable draft anchors while the rendered toolbar made the workflow unreachable? | **Found and fixed by workflow code review.** Move up/down remain enabled during insertion drafts, and RTL plus Playwright prove confirmation inserts after the anchor's current stable-ID position. |
| Scoped anchor deletion | Could a stale inline confirmation delete a selected vertex in another department? | **Found and fixed by workflow code review.** Confirmation captures department and vertex IDs, clears on context changes, and retains a visible disabled Undo control. |
| Browser path depth | Were helper tests standing in for required production behavior? | **Found and fixed by workflow code review.** Playwright now exercises transformed rounding, field validation, draft reorder/context persistence, all finish decisions, pan thresholds, lost capture, named groups, focus order, and visible focus in every configured project. |

## Review conclusion

No blocking or major concern remains after two bounded repair cycles. The central workflow is materially safer and more accessible without changing sales interpretation or heatmap semantics. Remaining risk is limited to explicitly documented parser dependency exposure, unbenchmarked very-large-image performance, and unavailable physical/cross-engine touch hardware.
