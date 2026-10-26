import { useEffect, useId, useRef, useState } from "react";
import { validatePixelInput } from "../mapping/geometry.js";

function VertexRow({ vertex, index, departmentId, selected, dispatch, width, height, rowRef }) {
  const [x, setX] = useState(String(vertex.x));
  const [y, setY] = useState(String(vertex.y));
  const errorsId = useId();

  useEffect(() => {
    setX(String(vertex.x));
    setY(String(vertex.y));
  }, [vertex.x, vertex.y]);

  const xResult = validatePixelInput(x, width);
  const yResult = validatePixelInput(y, height);
  const commit = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (xResult.valid && yResult.valid) {
      dispatch({
        type: "EDIT_VERTEX",
        departmentId,
        vertexId: vertex.id,
        x: xResult.value,
        y: yResult.value,
      });
    }
  };

  return (
    <li className={`coordinate-row${selected ? " is-selected" : ""}`} ref={rowRef} onBlur={commit}>
      <label className="vertex-radio-label">
        <input
          type="radio"
          name={`vertices-${departmentId}`}
          checked={selected}
          onChange={() => dispatch({ type: "SELECT_VERTEX", departmentId, vertexId: vertex.id })}
        />
        <span>Vertex {index + 1}: ({vertex.x}, {vertex.y})</span>
      </label>
      <div className="coordinate-fields">
        <label>
          <span>X</span>
          <input
            inputMode="numeric"
            value={x}
            aria-invalid={!xResult.valid}
            aria-describedby={!xResult.valid ? errorsId : undefined}
            onChange={(event) => setX(event.target.value)}
          />
        </label>
        <label>
          <span>Y</span>
          <input
            inputMode="numeric"
            value={y}
            aria-invalid={!yResult.valid}
            aria-describedby={!yResult.valid ? errorsId : undefined}
            onChange={(event) => setY(event.target.value)}
          />
        </label>
      </div>
      {(!xResult.valid || !yResult.valid) && (
        <p className="field-error" id={errorsId} role="alert">
          {!xResult.valid ? `X: ${xResult.error}` : `Y: ${yResult.error}`}
        </p>
      )}
    </li>
  );
}

export default function CoordinateEditor({
  department,
  state,
  dispatch,
  imageWidth,
  imageHeight,
  revealVertexId,
  onFinish,
  finishDecision,
  setFinishDecision,
}) {
  const detailsRef = useRef(null);
  const rowRefs = useRef(new Map());
  const insertionXRef = useRef(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const selectedId = department ? state.selectedVertexByDepartment[department.id] : null;
  const draft = department ? state.draftsByDepartment[department.id] : null;
  const draftAnchorId = draft?.anchorId;
  const history = department ? state.historyByDepartment[department.id] ?? [] : [];
  const selectedIndex = department?.vertices.findIndex((vertex) => vertex.id === selectedId) ?? -1;
  const selectedVertex = selectedIndex >= 0 ? department.vertices[selectedIndex] : null;
  const draftX = validatePixelInput(draft?.x ?? "", imageWidth ?? 0);
  const draftY = validatePixelInput(draft?.y ?? "", imageHeight ?? 0);
  const currentDeleteConfirm = !finishDecision && deleteConfirm?.departmentId === department?.id
    ? deleteConfirm
    : null;
  const transient = Boolean(draft || currentDeleteConfirm || finishDecision);

  useEffect(() => {
    if (!revealVertexId) return;
    if (detailsRef.current) detailsRef.current.open = true;
    rowRefs.current.get(revealVertexId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [revealVertexId]);

  useEffect(() => {
    if (draftAnchorId) insertionXRef.current?.focus();
  }, [draftAnchorId]);

  useEffect(() => {
    setDeleteConfirm(null);
  }, [department?.id, finishDecision]);

  if (!department) {
    return (
      <section className="coordinate-editor empty-editor" aria-labelledby="coordinate-editor-title">
        <h3 id="coordinate-editor-title">Boundary coordinates</h3>
        <p>Select or create a profit center to edit its whole-pixel boundary.</p>
      </section>
    );
  }

  const updateDraft = (patch) => dispatch({ type: "UPDATE_DRAFT", departmentId: department.id, patch });
  const beginInsert = () => {
    if (!selectedId) return;
    dispatch({ type: "START_INSERT", departmentId: department.id, anchorId: selectedId });
  };
  const confirmInsert = () => {
    updateDraft({ touchedX: true, touchedY: true });
    if (!draftX.valid || !draftY.valid) return;
    dispatch({
      type: "INSERT_VERTEX",
      departmentId: department.id,
      vertex: { x: draftX.value, y: draftY.value },
    });
  };
  const requestDelete = () => {
    if (draft?.anchorId === selectedId) {
      setDeleteConfirm({ departmentId: department.id, vertexId: selectedId });
    } else if (selectedId) {
      dispatch({ type: "DELETE_VERTEX", departmentId: department.id, vertexId: selectedId });
    }
  };

  return (
    <section className="coordinate-editor" aria-labelledby="coordinate-editor-title">
      <div className="editor-heading">
        <div>
          <h3 id="coordinate-editor-title">Boundary coordinates</h3>
          <p>{imageWidth} × {imageHeight} intrinsic pixels</p>
        </div>
        {state.warningByDepartment[department.id] && (
          <p className="geometry-warning" role="status">{state.warningByDepartment[department.id]}</p>
        )}
      </div>

      <details ref={detailsRef}>
        <summary>{department.name}: {department.vertices.length} committed {department.vertices.length === 1 ? "vertex" : "vertices"}</summary>
        {department.vertices.length === 0 ? (
          <p className="editor-empty">Add points on the floor plan. Each committed point will appear here.</p>
        ) : (
          <fieldset className="coordinate-group">
            <legend className="sr-only">{department.name} boundary vertices</legend>
            <ol className="coordinate-list">
              {department.vertices.map((vertex, index) => (
                <VertexRow
                  key={vertex.id}
                  vertex={vertex}
                  index={index}
                  departmentId={department.id}
                  selected={vertex.id === selectedId}
                  dispatch={dispatch}
                  width={imageWidth}
                  height={imageHeight}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(vertex.id, node);
                    else rowRefs.current.delete(vertex.id);
                  }}
                />
              ))}
            </ol>
          </fieldset>
        )}

        {currentDeleteConfirm ? (
          <div className="inline-decision" role="group" aria-label="Delete draft anchor">
            <p>This vertex anchors the unfinished insertion. Delete both the vertex and its draft?</p>
            <div className="button-row">
              <button type="button" className="button secondary" onClick={() => setDeleteConfirm(null)}>Cancel deletion</button>
              <button
                type="button"
                className="button danger"
                onClick={() => {
                  dispatch({
                    type: "DELETE_VERTEX_AND_DRAFT",
                    departmentId: currentDeleteConfirm.departmentId,
                    vertexId: currentDeleteConfirm.vertexId,
                  });
                  setDeleteConfirm(null);
                }}
              >Delete vertex and draft</button>
              <button
                type="button"
                className="button secondary"
                disabled
                aria-describedby={`undo-help-${department.id}`}
              >Undo</button>
            </div>
          </div>
        ) : (
          <div className="editor-toolbar" role="toolbar" aria-label={`${department.name} selected vertex actions`}>
            <button type="button" className="button secondary" disabled={!selectedVertex || transient} onClick={beginInsert}>Insert after</button>
            <button
              type="button"
              className="button secondary"
              disabled={selectedIndex <= 0 || currentDeleteConfirm || finishDecision}
              onClick={() => dispatch({ type: "MOVE_VERTEX", departmentId: department.id, vertexId: selectedId, direction: -1 })}
            >Move up</button>
            <button
              type="button"
              className="button secondary"
              disabled={selectedIndex < 0 || selectedIndex >= department.vertices.length - 1 || currentDeleteConfirm || finishDecision}
              onClick={() => dispatch({ type: "MOVE_VERTEX", departmentId: department.id, vertexId: selectedId, direction: 1 })}
            >Move down</button>
            <button type="button" className="button danger-quiet" disabled={!selectedVertex || currentDeleteConfirm || finishDecision} onClick={requestDelete}>Delete</button>
            <button
              type="button"
              className="button secondary"
              disabled={!history.length || transient}
              aria-describedby={transient ? `undo-help-${department.id}` : undefined}
              onClick={() => dispatch({ type: "UNDO", departmentId: department.id })}
            >Undo</button>
          </div>
        )}
        {transient && <p className="toolbar-help" id={`undo-help-${department.id}`}>Undo is available after you resolve the open draft or decision.</p>}

        {draft && !currentDeleteConfirm && (
          <div className="insertion-form" role="group" aria-label={`Insert after vertex ${department.vertices.findIndex((vertex) => vertex.id === draft.anchorId) + 1}`}>
            <h4>Insert after selected vertex</h4>
            <div className="coordinate-fields">
              <label>
                <span>X</span>
                <input
                  ref={insertionXRef}
                  inputMode="numeric"
                  value={draft.x}
                  aria-invalid={draft.touchedX && !draftX.valid}
                  onChange={(event) => updateDraft({ x: event.target.value })}
                  onBlur={() => updateDraft({ touchedX: true })}
                />
              </label>
              <label>
                <span>Y</span>
                <input
                  inputMode="numeric"
                  value={draft.y}
                  aria-invalid={draft.touchedY && !draftY.valid}
                  onChange={(event) => updateDraft({ y: event.target.value })}
                  onBlur={() => updateDraft({ touchedY: true })}
                />
              </label>
            </div>
            {((draft.touchedX && !draftX.valid) || (draft.touchedY && !draftY.valid)) && (
              <p className="field-error" role="alert">{!draftX.valid ? `X: ${draftX.error}` : `Y: ${draftY.error}`}</p>
            )}
            <div className="button-row">
              <button type="button" className="button primary" onClick={confirmInsert}>Confirm insertion</button>
              <button type="button" className="button secondary" onClick={() => dispatch({ type: "CANCEL_DRAFT", departmentId: department.id })}>Cancel</button>
            </div>
          </div>
        )}

        {finishDecision && (
          <div className="inline-decision" role="group" aria-label="Finish area with unfinished insertion">
            <p>An insertion draft is still open. Choose what happens to it before leaving mapping.</p>
            <div className="button-row">
              <button type="button" className="button secondary" onClick={() => { setFinishDecision(false); insertionXRef.current?.focus(); }}>Return to draft</button>
              <button type="button" className="button primary" onClick={() => { setFinishDecision(false); onFinish({ keepDraft: true }); }}>Finish and keep draft</button>
              <button type="button" className="button danger-quiet" onClick={() => { dispatch({ type: "CANCEL_DRAFT", departmentId: department.id }); setFinishDecision(false); onFinish({ keepDraft: false }); }}>Finish and discard draft</button>
              <button type="button" className="button secondary" onClick={() => setFinishDecision(false)}>Dismiss</button>
            </div>
          </div>
        )}
      </details>
    </section>
  );
}
