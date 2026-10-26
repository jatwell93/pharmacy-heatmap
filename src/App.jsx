import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as XLSX from "xlsx";
import * as d3 from "d3";
import CoordinateEditor from "./components/CoordinateEditor.jsx";
import {
  createEditorState,
  createStableId,
  editorReducer,
  getActiveDepartment,
} from "./mapping/editor-state.js";
import {
  clientToIntrinsicPoint,
  hitTestVertex,
} from "./mapping/geometry.js";
import {
  beginPointerSession,
  completePointerSession,
  pointerDelta,
  updatePointerSession,
} from "./mapping/canvas-interaction.js";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);

function readFile(file, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader[method](file);
  });
}

function decodeImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The file is not a valid PNG or JPEG image."));
    image.src = src;
  });
}

export default function PharmIQHeatMap() {
  const [editorState, dispatch] = useReducer(editorReducer, undefined, createEditorState);
  const [floorPlan, setFloorPlan] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [mode, setMode] = useState("view");
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [blurRadius, setBlurRadius] = useState(50);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.85);
  const [maxSales, setMaxSales] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState({ tone: "info", message: "Upload a floor plan to begin." });
  const [revealVertexId, setRevealVertexId] = useState(null);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");
  const [finishDecision, setFinishDecision] = useState(false);
  const [departmentDeleteId, setDepartmentDeleteId] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const heatmapCanvasRef = useRef(document.createElement("canvas"));
  const pointerSessionRef = useRef(null);
  const imageRequestRef = useRef(0);
  const workbookRequestRef = useRef(0);

  const departments = editorState.departments;
  const activeDepartment = getActiveDepartment(editorState);
  const selectedVertexId = activeDepartment
    ? editorState.selectedVertexByDepartment[activeDepartment.id]
    : null;

  const colorScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, maxSales / 2, maxSales || 1])
        .range(["#F8FAFC", "#0F766E", "#D97706"]),
    [maxSales],
  );

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const request = ++imageRequestRef.current;
    workbookRequestRef.current += 1;
    if (!IMAGE_TYPES.has(file.type)) {
      setStatus({ tone: "error", message: "Choose a PNG or JPEG floor plan. The current plan was kept." });
      return;
    }
    setStatus({ tone: "info", message: `Reading ${file.name}…` });
    try {
      const src = await readFile(file, "readAsDataURL");
      const image = await decodeImage(src);
      if (request !== imageRequestRef.current) return;
      setFloorPlan({ image, src, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
      setSalesData(null);
      setAvailableDepartments([]);
      setMaxSales(0);
      dispatch({ type: "RESET" });
      setMode("view");
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setShowDepartmentPicker(false);
      setFinishDecision(false);
      setStatus({ tone: "success", message: `Floor plan ready: ${image.naturalWidth || image.width} × ${image.naturalHeight || image.height} pixels. Previous mapping was cleared.` });
    } catch (error) {
      if (request !== imageRequestRef.current) return;
      setStatus({ tone: "error", message: `${error.message} The current plan was kept.` });
    }
  };

  const handleWorkbookUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const request = ++workbookRequestRef.current;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setStatus({ tone: "error", message: "Choose an XLSX or XLS workbook. Existing sales data was kept." });
      return;
    }
    setStatus({ tone: "info", message: `Reading ${file.name}…` });
    try {
      const result = await readFile(file, "readAsArrayBuffer");
      const workbook = XLSX.read(new Uint8Array(result), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("The workbook has no readable worksheet.");
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: "A" });
      const salesByName = {};
      for (const row of rows.slice(1)) {
        const name = String(row.A ?? "").trim();
        if (!name) continue;
        const parsed = typeof row.C === "number" ? row.C : Number.parseFloat(String(row.C ?? "").replace(/[^0-9.-]+/g, ""));
        salesByName[name] = Number.isFinite(parsed) ? parsed : 0;
      }
      if (!Object.keys(salesByName).length) {
        throw new Error("No departments were found. Put department names in column A and sales in column C.");
      }
      if (request !== workbookRequestRef.current) return;
      const maximum = Math.max(0, ...Object.values(salesByName));
      setSalesData(salesByName);
      setAvailableDepartments(Object.keys(salesByName).sort());
      setMaxSales(maximum);
      dispatch({ type: "UPDATE_SALES", salesByName });
      setStatus({ tone: "success", message: `Sales data ready for ${Object.keys(salesByName).length} departments.` });
    } catch (error) {
      if (request !== workbookRequestRef.current) return;
      setStatus({ tone: "error", message: `${error.message} Existing sales data was kept.` });
    }
  };

  const createDepartment = (name) => {
    const trimmed = name.trim();
    if (!trimmed || departments.some((department) => department.name === trimmed)) {
      setStatus({ tone: "error", message: "Enter a unique profit center name." });
      return;
    }
    const id = createStableId("department");
    dispatch({
      type: "ADD_DEPARTMENT",
      department: { id, name: trimmed, sales: salesData?.[trimmed] ?? 0, vertices: [] },
    });
    setMode("draw");
    setShowDepartmentPicker(false);
    setNewDepartmentName("");
    setStatus({ tone: "info", message: `Mapping ${trimmed}. Add at least three whole-pixel vertices.` });
  };

  const beginEditDepartment = (departmentId) => {
    dispatch({ type: "SET_ACTIVE_DEPARTMENT", departmentId });
    setMode("draw");
    setShowDepartmentPicker(false);
    setFinishDecision(false);
  };

  const completeFinish = () => {
    setMode("view");
    setFinishDecision(false);
    setStatus({ tone: "success", message: `${activeDepartment.name} boundary saved with ${activeDepartment.vertices.length} vertices.` });
  };

  const requestFinish = () => {
    if (!activeDepartment || activeDepartment.vertices.length < 3) {
      setStatus({ tone: "error", message: "Add at least three vertices before finishing this area." });
      return;
    }
    if (editorState.draftsByDepartment[activeDepartment.id]) {
      setFinishDecision(true);
      return;
    }
    completeFinish();
  };

  const generateHeatmap = useCallback(
    (width, height) => {
      if (!departments.length || !maxSales || !heatmapVisible) return null;
      const heatmapCanvas = heatmapCanvasRef.current;
      heatmapCanvas.width = width;
      heatmapCanvas.height = height;
      const context = heatmapCanvas.getContext("2d");
      context.clearRect(0, 0, width, height);
      for (const department of departments) {
        if (department.vertices.length < 3) continue;
        const center = department.vertices.reduce(
          (sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }),
          { x: 0, y: 0 },
        );
        center.x /= department.vertices.length;
        center.y /= department.vertices.length;
        const radius = Math.max(
          ...department.vertices.map((vertex) => Math.hypot(vertex.x - center.x, vertex.y - center.y)),
        ) * 1.2;
        let intensity = department.sales / maxSales;
        if (!Number.isFinite(intensity)) intensity = 0.5;
        intensity = Math.max(Math.pow(intensity, 0.3), 0.3);
        const gradient = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
        gradient.addColorStop(0.7, `rgba(255, 255, 255, ${intensity * 0.8})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.3})`);
        context.beginPath();
        context.moveTo(department.vertices[0].x, department.vertices[0].y);
        department.vertices.slice(1).forEach((vertex) => context.lineTo(vertex.x, vertex.y));
        context.closePath();
        context.fillStyle = gradient;
        context.fill();
      }
      context.filter = `blur(${blurRadius * 1.5}px)`;
      const temporary = document.createElement("canvas");
      temporary.width = width;
      temporary.height = height;
      const temporaryContext = temporary.getContext("2d");
      temporaryContext.drawImage(heatmapCanvas, 0, 0);
      context.clearRect(0, 0, width, height);
      context.filter = "none";
      const blurred = temporaryContext.getImageData(0, 0, width, height);
      const output = context.createImageData(width, height);
      for (let index = 0; index < blurred.data.length; index += 4) {
        const alpha = blurred.data[index + 3] / 255;
        if (!alpha) continue;
        const color = d3.rgb(colorScale(alpha));
        output.data[index] = color.r;
        output.data[index + 1] = color.g;
        output.data[index + 2] = color.b;
        output.data[index + 3] = Math.min(255, alpha * 255 * heatmapOpacity * 1.5);
      }
      context.putImageData(output, 0, 0);
      return heatmapCanvas;
    },
    [blurRadius, colorScale, departments, heatmapOpacity, heatmapVisible, maxSales],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !container || !context || !floorPlan) return;
    canvas.width = floorPlan.width;
    canvas.height = floorPlan.height;
    const bounds = container.getBoundingClientRect();
    const availableWidth = Math.max(bounds.width, 280);
    const availableHeight = Math.max(bounds.height, 360);
    const fit = Math.min(availableWidth / floorPlan.width, availableHeight / floorPlan.height);
    canvas.style.width = `${Math.max(1, floorPlan.width * fit)}px`;
    canvas.style.height = `${Math.max(1, floorPlan.height * fit)}px`;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(pan.x, pan.y);
    context.scale(zoom, zoom);
    context.drawImage(floorPlan.image, 0, 0, floorPlan.width, floorPlan.height);
    const heatmap = generateHeatmap(canvas.width, canvas.height);
    if (heatmap) {
      context.globalAlpha = heatmapOpacity;
      context.drawImage(heatmap, 0, 0);
      context.globalAlpha = 1;
    }
    for (const department of departments) {
      if (department.vertices.length >= 3) {
        context.beginPath();
        context.moveTo(department.vertices[0].x, department.vertices[0].y);
        department.vertices.slice(1).forEach((vertex) => context.lineTo(vertex.x, vertex.y));
        context.closePath();
        context.strokeStyle = department.id === activeDepartment?.id ? "#0F766E" : "rgba(15, 23, 42, 0.65)";
        context.lineWidth = (department.id === activeDepartment?.id ? 2 : 1) / zoom;
        context.stroke();
        const center = department.vertices.reduce((sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }), { x: 0, y: 0 });
        center.x /= department.vertices.length;
        center.y /= department.vertices.length;
        context.textAlign = "center";
        context.font = `600 ${Math.max(10, 14 / zoom)}px Inter, sans-serif`;
        context.lineWidth = 3 / zoom;
        context.strokeStyle = "rgba(248, 250, 252, 0.9)";
        context.fillStyle = "#0F172A";
        context.strokeText(department.name, center.x, center.y);
        context.fillText(department.name, center.x, center.y);
        if (salesData) {
          const label = `$${department.sales.toLocaleString()}`;
          context.strokeText(label, center.x, center.y + 18 / zoom);
          context.fillText(label, center.x, center.y + 18 / zoom);
        }
      }
    }
    if (activeDepartment) {
      activeDepartment.vertices.forEach((vertex, index) => {
        const selected = vertex.id === selectedVertexId;
        context.beginPath();
        if (selected) {
          const size = 7 / zoom;
          context.rect(vertex.x - size, vertex.y - size, size * 2, size * 2);
        } else {
          context.arc(vertex.x, vertex.y, 5 / zoom, 0, Math.PI * 2);
        }
        context.fillStyle = selected ? "#0F766E" : "#D97706";
        context.fill();
        context.lineWidth = 2 / zoom;
        context.strokeStyle = "#F8FAFC";
        context.stroke();
        context.fillStyle = "#0F172A";
        context.font = `700 ${12 / zoom}px Inter, sans-serif`;
        context.textAlign = "center";
        context.fillText(String(index + 1), vertex.x, vertex.y - 10 / zoom);
      });
    }
    context.restore();
  }, [activeDepartment, departments, floorPlan, generateHeatmap, heatmapOpacity, pan, salesData, selectedVertexId, zoom]);

  const canvasGeometry = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || !floorPlan) return null;
    return {
      rect: canvas.getBoundingClientRect(),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      pan,
      zoom,
      imageWidth: floorPlan.width,
      imageHeight: floorPlan.height,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const handlePointerDown = (event) => {
    if (!floorPlan) return;
    const geometry = canvasGeometry(event);
    const hit = activeDepartment
      ? hitTestVertex({ ...geometry, vertices: activeDepartment.vertices })
      : null;
    pointerSessionRef.current = beginPointerSession(event, hit?.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const session = pointerSessionRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    const delta = pointerDelta(session, event);
    const next = updatePointerSession(session, event);
    pointerSessionRef.current = next;
    if (mode === "view" && next.moved) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPan((current) => ({
        x: current.x + delta.x * (canvasRef.current.width / rect.width),
        y: current.y + delta.y * (canvasRef.current.height / rect.height),
      }));
    }
  };

  const clearPointer = (event) => {
    if (pointerSessionRef.current?.pointerId !== event.pointerId) return;
    pointerSessionRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerUp = (event) => {
    const session = pointerSessionRef.current;
    const result = completePointerSession(session, event, mode);
    clearPointer(event);
    if (!activeDepartment) return;
    if (result.outcome === "select") {
      dispatch({ type: "SELECT_VERTEX", departmentId: activeDepartment.id, vertexId: result.vertexId });
      const vertexIndex = activeDepartment.vertices.findIndex((vertex) => vertex.id === result.vertexId);
      setRevealVertexId(null);
      requestAnimationFrame(() => setRevealVertexId(result.vertexId));
      setSelectionAnnouncement(`Selected vertex ${vertexIndex + 1} in ${activeDepartment.name}.`);
    } else if (result.outcome === "append") {
      const point = clientToIntrinsicPoint(canvasGeometry(event));
      if (point) dispatch({ type: "APPEND_VERTEX", departmentId: activeDepartment.id, vertex: point });
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const mouseX = (event.clientX - rect.left) * scale;
    const mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
    const nextZoom = Math.max(0.1, Math.min(5, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
    setPan({
      x: mouseX - (mouseX - pan.x) * (nextZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (nextZoom / zoom),
    });
    setZoom(nextZoom);
  };

  const zoomBy = (direction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    handleWheel({
      preventDefault() {},
      deltaY: direction,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
  };

  const unmapped = availableDepartments.filter(
    (name) => !departments.some((department) => department.name === name),
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/pharmiq-logo-full.svg" alt="PharmIQ" />
          <h1>Heat-Map Dashboard</h1>
        </div>
        <span className="brand-line">Infrastructure for Choice</span>
      </header>

      <main className="workspace">
        <aside className="control-panel" aria-label="Heat-map controls">
          <section className="setup-intro">
            <h2>Map pharmacy performance</h2>
            <p>Connect a floor plan and sales workbook, then define each profit center on the plan or by whole-pixel coordinates.</p>
          </section>

          <div className={`status-message ${status.tone}`} role="status" aria-live="polite">{status.message}</div>

          <section className="input-section" aria-labelledby="inputs-title">
            <h2 id="inputs-title">Operational inputs</h2>
            <label className="file-field" htmlFor="imageUpload">
              <span>Floor plan (PNG or JPEG)</span>
              <input id="imageUpload" type="file" accept="image/png,image/jpeg" onChange={handleImageUpload} />
            </label>
            <label className="file-field" htmlFor="excelUpload">
              <span>Sales intelligence (XLSX)</span>
              <input id="excelUpload" type="file" accept=".xlsx,.xls" onChange={handleWorkbookUpload} disabled={!floorPlan} />
              <small>Department names in column A; normalized sales in column C.</small>
            </label>
          </section>

          <section className="mapping-section" aria-labelledby="mapping-title">
            <div className="section-heading-row">
              <h2 id="mapping-title">Profit centers</h2>
              <span className="count-badge">{departments.length}</span>
            </div>
            <button
              type="button"
              className="button primary full-width"
              disabled={!floorPlan || mode === "draw"}
              onClick={() => setShowDepartmentPicker(true)}
            >Add profit center</button>

            {showDepartmentPicker && (
              <div className="department-picker">
                <h3>Choose a profit center</h3>
                {unmapped.length ? (
                  <div className="department-options">
                    {unmapped.map((name) => (
                      <button type="button" className="department-option" key={name} onClick={() => createDepartment(name)}>
                        <span>{name}</span><strong>${(salesData?.[name] ?? 0).toLocaleString()}</strong>
                      </button>
                    ))}
                  </div>
                ) : <p>{salesData ? "All workbook departments are mapped." : "Upload sales data or enter a name below."}</p>}
                <div className="manual-department">
                  <label htmlFor="new-department">New profit center name</label>
                  <div>
                    <input id="new-department" value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} />
                    <button type="button" className="button primary" onClick={() => createDepartment(newDepartmentName)} disabled={!newDepartmentName.trim()}>Add</button>
                  </div>
                </div>
                <button type="button" className="button secondary" onClick={() => setShowDepartmentPicker(false)}>Cancel</button>
              </div>
            )}

            {activeDepartment && mode === "draw" && (
              <div className="mapping-session">
                <p><strong>Mapping {activeDepartment.name}</strong><br />{activeDepartment.vertices.length} committed vertices; at least 3 required.</p>
                <div className="button-row">
                  <button type="button" className="button primary" onClick={requestFinish}>Finish Area</button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      !activeDepartment.vertices.length ||
                      Boolean(editorState.draftsByDepartment[activeDepartment.id])
                    }
                    title={editorState.draftsByDepartment[activeDepartment.id] ? "Resolve the insertion draft before clearing points." : undefined}
                    onClick={() => dispatch({ type: "CLEAR_VERTICES", departmentId: activeDepartment.id })}
                  >Clear Points</button>
                  <button type="button" className="button secondary" onClick={() => setMode("view")}>Pause mapping</button>
                </div>
              </div>
            )}

            <div className="department-list">
              {departments.length === 0 ? <p className="empty-state">No profit centers mapped yet.</p> : departments.map((department) => (
                <article className={`department-item${department.id === activeDepartment?.id ? " active" : ""}`} key={department.id}>
                  <div>
                    <h3>{department.name}</h3>
                    <p>{department.vertices.length} vertices · ${department.sales.toLocaleString()}</p>
                  </div>
                  {departmentDeleteId === department.id ? (
                    <div className="inline-delete">
                      <span>Delete this center?</span>
                      <button type="button" className="button danger" onClick={() => { dispatch({ type: "DELETE_DEPARTMENT", departmentId: department.id }); setDepartmentDeleteId(null); }}>Delete</button>
                      <button type="button" className="button secondary" onClick={() => setDepartmentDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="item-actions">
                      <button type="button" className="button secondary" onClick={() => beginEditDepartment(department.id)} disabled={mode === "draw" && department.id !== activeDepartment?.id}>Edit Area</button>
                      <button type="button" className="button danger-quiet" onClick={() => setDepartmentDeleteId(department.id)} disabled={mode === "draw"}>Delete</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <CoordinateEditor
            department={activeDepartment}
            state={editorState}
            dispatch={dispatch}
            imageWidth={floorPlan?.width ?? 0}
            imageHeight={floorPlan?.height ?? 0}
            revealVertexId={revealVertexId}
            onFinish={completeFinish}
            finishDecision={finishDecision}
            setFinishDecision={setFinishDecision}
          />

          <section className="visualization-section" aria-labelledby="visualization-title">
            <h2 id="visualization-title">Performance visualization</h2>
            <label className="check-field"><input type="checkbox" checked={heatmapVisible} onChange={(event) => setHeatmapVisible(event.target.checked)} disabled={!salesData || maxSales <= 0} /> Show heatmap</label>
            <label htmlFor="diffusion">Diffusion radius: {blurRadius}px</label>
            <input id="diffusion" type="range" min="5" max="100" value={blurRadius} onChange={(event) => setBlurRadius(Number(event.target.value))} disabled={!salesData || !heatmapVisible} />
            <label htmlFor="intensity">Data intensity: {Math.round(heatmapOpacity * 100)}%</label>
            <input id="intensity" type="range" min="10" max="100" value={heatmapOpacity * 100} onChange={(event) => setHeatmapOpacity(Number(event.target.value) / 100)} disabled={!salesData || !heatmapVisible} />
            {salesData && maxSales > 0 && heatmapVisible && (
              <div className="legend" aria-label={`Performance legend from $0 to $${maxSales.toLocaleString()}`}>
                <div className="legend-scale" />
                <div><span>$0</span><span>${Math.round(maxSales / 2).toLocaleString()}</span><span>${maxSales.toLocaleString()}</span></div>
              </div>
            )}
          </section>
        </aside>

        <section className="canvas-region" aria-label="Floor plan mapping canvas" ref={containerRef}>
          {floorPlan ? (
            <>
              <canvas
                ref={canvasRef}
                tabIndex="0"
                aria-label={`${mode === "draw" ? "Draw" : "View"} floor plan. Use the coordinate editor for keyboard boundary editing.`}
                className={`floor-canvas ${mode}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={clearPointer}
                onLostPointerCapture={clearPointer}
                onWheel={handleWheel}
              />
              <div className="zoom-controls" role="group" aria-label="Canvas zoom controls">
                <button type="button" className="button secondary icon-button" aria-label="Zoom in" onClick={() => zoomBy(-1)}>+</button>
                <output aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
                <button type="button" className="button secondary icon-button" aria-label="Zoom out" onClick={() => zoomBy(1)}>−</button>
                <button type="button" className="button secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset view</button>
              </div>
            </>
          ) : (
            <div className="canvas-empty">
              <h2>Floor plan workspace</h2>
              <p>Upload a PNG or JPEG floor plan to begin mapping profit centers.</p>
            </div>
          )}
        </section>
      </main>
      <div className="sr-only" aria-live="polite">{selectionAnnouncement}</div>
    </div>
  );
}
