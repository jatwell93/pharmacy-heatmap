import React, { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import * as d3 from "d3";

const StoreHeatmap = () => {
  // State for image and data
  const [floorPlanImage, setFloorPlanImage] = useState(null); // { src, width, height }
  const [salesData, setSalesData] = useState(null); // { deptName: salesValue, ... }
  const [departments, setDepartments] = useState([]); // { id, name, coords: [{x, y}], sales }
  const [availableDepts, setAvailableDepts] = useState([]); // List of departments from Excel

  // State for UI and interaction modes
  const [selectedDepartment, setSelectedDepartment] = useState(null); // Index of the department being edited/drawn
  const [mode, setMode] = useState("view"); // 'view', 'draw'
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  // State for heatmap rendering
  const [maxSales, setMaxSales] = useState(0);
  const [colorScale, setColorScale] = useState(() =>
    d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]),
  );

  // State for canvas panning and zooming
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // For panning calculation

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null); // Ref for the canvas container to get bounds

  // --- File Handling ---

  // Handle floor plan image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setFloorPlanImage({
            src: event.target.result,
            width: img.width,
            height: img.height,
          });
          // Reset view when new image is loaded
          setZoom(1);
          setPan({ x: 0, y: 0 });
          setDepartments([]); // Clear departments for new floor plan
          setSalesData(null); // Clear sales data
          setAvailableDepts([]);
          setMaxSales(0);
          setSelectedDepartment(null);
          setMode("view");
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Excel data upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });

          const deptSales = {};
          let maxSalesValue = 0;
          const deptList = [];

          // Skip header row (assuming it's the first row)
          jsonData.slice(1).forEach((row) => {
            const deptName = row.A; // Department name in column A
            // Ensure sales value is treated as a number, default to 0 if not
            const salesValue =
              typeof row.C === "number"
                ? row.C
                : parseFloat(String(row.C).replace(/[^0-9.-]+/g, "")) || 0; // TY sales in column C

            if (deptName) {
              // Allow departments with 0 sales
              deptSales[deptName] = salesValue;
              deptList.push(deptName);
              if (salesValue > maxSalesValue) {
                maxSalesValue = salesValue;
              }
            }
          });

          console.log("Processed sales data:", deptSales);

          setMaxSales(maxSalesValue);
          setSalesData(deptSales);
          setAvailableDepts(deptList.sort()); // Sort for better UI

          // Update existing departments with new sales data
          setDepartments((prevDepts) => {
            return prevDepts.map((dept) => ({
              ...dept,
              sales: deptSales[dept.name] || 0, // Use 0 if not found in new data
            }));
          });

          // Update color scale domain
          setColorScale(() =>
            d3
              .scaleSequential(d3.interpolateYlOrRd)
              .domain([0, maxSalesValue || 1]),
          ); // Use 1 if maxSales is 0
        } catch (error) {
          console.error("Error processing Excel file:", error);
          alert(
            "Error processing Excel file. Please check the format (Department in Col A, Sales in Col C).",
          );
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // --- Department Management ---

  // Show the department selector UI
  const showDepartmentSelector = () => {
    if (!floorPlanImage) {
      alert("Please upload a floor plan image first");
      return;
    }
    // Filter available departments to show only those not already drawn
    const drawnDeptNames = new Set(departments.map((d) => d.name));
    const available = salesData
      ? Object.keys(salesData)
          .filter((name) => !drawnDeptNames.has(name))
          .sort()
      : [];
    setAvailableDepts(available);
    setShowDeptSelector(true);
    setNewDeptName("");
  };

  // Create a new department and start drawing
  const createDepartment = (name) => {
    if (!name || departments.some((dept) => dept.name === name)) {
      alert(`Department "${name}" already exists or name is invalid.`);
      return;
    }

    const newDept = {
      id: Date.now().toString(),
      name,
      coords: [], // Start with empty coordinates
      sales: salesData && salesData[name] ? salesData[name] : 0,
    };

    const newIndex = departments.length;
    setDepartments([...departments, newDept]);
    setSelectedDepartment(newIndex); // Select the newly added department
    setMode("draw"); // Switch to drawing mode
    setShowDeptSelector(false); // Close the selector
    setNewDeptName(""); // Clear the input
  };

  // Finish drawing the current department
  const finishDrawing = () => {
    if (
      selectedDepartment !== null &&
      departments[selectedDepartment]?.coords?.length >= 3
    ) {
      setMode("view");
      setSelectedDepartment(null); // Deselect department after finishing
    } else if (selectedDepartment !== null) {
      alert("You need at least 3 points to define a department area.");
    }
  };

  // Clear the current department's coordinates (while drawing)
  const clearCurrentDepartmentPoints = () => {
    if (mode === "draw" && selectedDepartment !== null) {
      setDepartments((prevDepts) => {
        const newDepts = [...prevDepts];
        if (newDepts[selectedDepartment]) {
          newDepts[selectedDepartment] = {
            ...newDepts[selectedDepartment],
            coords: [], // Reset coordinates
          };
        }
        return newDepts;
      });
    }
  };

  // Delete a department entirely
  const deleteDepartment = (indexToDelete) => {
    setDepartments((prevDepts) =>
      prevDepts.filter((_, index) => index !== indexToDelete),
    );

    // If the deleted department was selected, reset selection and mode
    if (selectedDepartment === indexToDelete) {
      setSelectedDepartment(null);
      setMode("view");
    } else if (
      selectedDepartment !== null &&
      selectedDepartment > indexToDelete
    ) {
      // Adjust selected index if it came after the deleted one
      setSelectedDepartment((prev) => prev - 1);
    }
  };

  // --- Canvas Interaction ---

  // Convert mouse event coordinates to canvas image coordinates (accounting for pan/zoom)
  const getCanvasCoordinates = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      // Mouse position relative to the canvas element
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert view coordinates to image coordinates
      // Inverse transform: translate back by pan, then scale down by zoom
      const imageX = (mouseX - pan.x) / zoom;
      const imageY = (mouseY - pan.y) / zoom;

      return { x: imageX, y: imageY };
    },
    [pan, zoom],
  );

  // Handle canvas click for drawing department boundaries
  const handleCanvasClick = useCallback(
    (e) => {
      if (mode !== "draw" || selectedDepartment === null) return; // Only add points in draw mode for a selected dept

      const coords = getCanvasCoordinates(e);
      if (!coords) return;

      // Add the calculated point to the selected department's coordinates
      setDepartments((prevDepts) => {
        // Ensure the selected department exists
        if (!prevDepts[selectedDepartment]) {
          console.error(
            `Attempted to add point to non-existent department index: ${selectedDepartment}`,
          );
          return prevDepts;
        }

        const newDepts = [...prevDepts];
        // Create a new object for the specific department to ensure state update
        newDepts[selectedDepartment] = {
          ...newDepts[selectedDepartment],
          // Create a new array for coordinates
          coords: [
            ...newDepts[selectedDepartment].coords,
            { x: coords.x, y: coords.y },
          ],
        };
        return newDepts;
      });
    },
    [mode, selectedDepartment, getCanvasCoordinates],
  ); // Dependencies for useCallback

  // --- Panning and Zooming Handlers ---

  // Handle mouse down for panning
  const handleMouseDown = (e) => {
    // Allow panning only in view mode or when not clicking on a specific interactive element
    if (mode === "view") {
      setIsDragging(true);
      // Use coordinates relative to the container, not the whole page
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e) => {
    if (!isDragging || mode !== "view") return; // Only pan in view mode

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Update pan state
    setPan((prevPan) => ({
      x: prevPan.x + dx,
      y: prevPan.y + dy,
    }));

    // Update drag start point for the next move event
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse up/leave to end panning
  const handleMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  // Handle mouse wheel for zooming
  const handleWheel = (e) => {
    e.preventDefault(); // Prevent page scrolling

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Mouse position relative to the canvas element (needed for zoom centering)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Determine zoom direction and factor
    const zoomFactor = 1.1;
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor; // Zoom in or out
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta)); // Clamp zoom level

    // Calculate the new pan position to keep the point under the mouse cursor fixed
    // Formula: newPan = mousePos - (mousePos - oldPan) * (newZoom / oldZoom)
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // --- Drawing Effect ---

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const container = containerRef.current;

    if (!ctx || !floorPlanImage || !container) {
      // Clear canvas if no image or context
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // --- Canvas Resizing (Fit container) ---
    // Match canvas logical size to container size for correct display scaling
    const { width: containerWidth, height: containerHeight } =
      container.getBoundingClientRect();

    // We want the canvas drawing buffer to match the image resolution for clarity,
    // but its display size should fit the container.
    // Calculate the aspect ratios
    const imageAspectRatio = floorPlanImage.width / floorPlanImage.height;
    const containerAspectRatio = containerWidth / containerHeight;

    let displayWidth, displayHeight;

    // Fit image within the container while maintaining aspect ratio
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider than container
      displayWidth = containerWidth;
      displayHeight = containerWidth / imageAspectRatio;
    } else {
      // Image is taller than container (or aspect ratios match)
      displayHeight = containerHeight;
      displayWidth = containerHeight * imageAspectRatio;
    }

    // Set the actual drawing buffer size (high resolution)
    canvas.width = floorPlanImage.width;
    canvas.height = floorPlanImage.height;

    // Set the display size using CSS (scales the high-res buffer down)
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    // Center the canvas within the container if it doesn't fill it completely
    canvas.style.display = "block";
    canvas.style.marginLeft = `${(containerWidth - displayWidth) / 2}px`;
    canvas.style.marginTop = `${(containerHeight - displayHeight) / 2}px`;

    // --- Drawing ---
    // Create an Image object to draw the floor plan
    const img = new Image();
    img.onload = () => {
      // Clear canvas before drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context state before applying transformations
      ctx.save();

      // Apply pan and zoom transformations
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw the floor plan image (transformed)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // --- Draw Departments ---
      departments.forEach((dept, deptIndex) => {
        if (!dept.coords || dept.coords.length === 0) return; // Skip if no coordinates

        // --- Styling based on state ---
        const isSelected = selectedDepartment === deptIndex;
        const isDrawingMode = mode === "draw";
        const isComplete = dept.coords.length >= 3;

        // --- Draw Polygon Area ---
        if (isComplete) {
          ctx.beginPath();
          ctx.moveTo(dept.coords[0].x, dept.coords[0].y);
          for (let i = 1; i < dept.coords.length; i++) {
            ctx.lineTo(dept.coords[i].x, dept.coords[i].y);
          }
          ctx.closePath();

          // Fill with heatmap color or default highlight
          if (heatmapVisible && dept.sales > 0 && maxSales > 0) {
            const normalizedSales = dept.sales / maxSales;
            ctx.fillStyle = colorScale(normalizedSales);
            ctx.globalAlpha = 0.65; // Heatmap transparency
            ctx.fill();
            ctx.globalAlpha = 1.0; // Reset transparency
          } else {
            // Default fill (slightly visible)
            ctx.fillStyle =
              isSelected && isDrawingMode
                ? "rgba(255, 0, 0, 0.1)"
                : "rgba(180, 180, 180, 0.2)";
            ctx.fill();
          }

          // Draw polygon outline (solid line for completed shapes)
          ctx.strokeStyle = isSelected && isDrawingMode ? "#ff0000" : "#333333"; // Red if selected for drawing, dark otherwise
          ctx.lineWidth = isSelected && isDrawingMode ? 3 / zoom : 1.5 / zoom; // Thicker line when selected, adjust for zoom
          ctx.setLineDash([]); // Ensure solid line
          ctx.stroke();
        }

        // --- Draw Points and Connecting Lines (ONLY for the selected department in draw mode) ---
        if (isSelected && isDrawingMode) {
          // Draw lines connecting points (even if less than 3 points)
          if (dept.coords.length > 1) {
            ctx.beginPath();
            ctx.moveTo(dept.coords[0].x, dept.coords[0].y);
            for (let i = 1; i < dept.coords.length; i++) {
              ctx.lineTo(dept.coords[i].x, dept.coords[i].y);
            }
            // Don't close path if less than 3 points
            if (isComplete) {
              ctx.closePath();
            }
            ctx.strokeStyle = "#ff0000"; // Red for active drawing lines
            ctx.lineWidth = 2 / zoom; // Adjust for zoom
            ctx.setLineDash([6 / zoom, 3 / zoom]); // Dashed line for active drawing outline
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
          }

          // Draw points (vertices)
          dept.coords.forEach((point, i) => {
            ctx.beginPath();
            // Make point size consistent regardless of zoom
            const pointRadius = 4 / zoom;
            ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
            ctx.fillStyle = "#ff0000"; // Red points
            ctx.fill();
            // Optional: Draw point numbers
            // ctx.fillStyle = '#ffffff';
            // ctx.font = `${10 / zoom}px Arial`;
            // ctx.textAlign = 'center';
            // ctx.fillText(i + 1, point.x, point.y + pointRadius / 2);
          });
        }

        // --- Draw Department Name and Sales (for complete departments) ---
        if (isComplete) {
          // Calculate centroid (approximate center) for label placement
          let centerX = 0;
          let centerY = 0;
          dept.coords.forEach((coord) => {
            centerX += coord.x;
            centerY += coord.y;
          });
          centerX /= dept.coords.length;
          centerY /= dept.coords.length;

          // Adjust font size based on zoom
          const fontSize = Math.max(8, 14 / zoom); // Ensure minimum size
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = "center";
          ctx.fillStyle = "#000000"; // Black text
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"; // White outline for better visibility
          ctx.lineWidth = 2 / zoom;

          // Draw department name
          ctx.strokeText(dept.name, centerX, centerY);
          ctx.fillText(dept.name, centerX, centerY);

          // Draw sales value if available
          if (salesData && dept.sales !== undefined) {
            const salesText = `$${dept.sales.toLocaleString()}`;
            const salesFontSize = Math.max(7, 12 / zoom);
            ctx.font = `${salesFontSize}px Arial`;
            ctx.strokeText(salesText, centerX, centerY + fontSize * 1.2); // Position below name
            ctx.fillText(salesText, centerX, centerY + fontSize * 1.2);
          }
        }
      }); // End departments.forEach

      // Restore context state (removes transforms)
      ctx.restore();

      // --- Draw UI Overlays (like drawing mode text) - Drawn AFTER restoring context ---
      if (
        mode === "draw" &&
        selectedDepartment !== null &&
        departments[selectedDepartment]
      ) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.fillText(
          `DRAWING: ${departments[selectedDepartment].name}. Click to add points. (${departments[selectedDepartment].coords.length} points)`,
          10,
          25,
        );
      }
      if (mode === "view" && !isDragging) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`View Mode: Drag to Pan, Scroll to Zoom`, 10, 25);
      }
    }; // End img.onload

    // Set the src property to trigger the image loading and drawing
    img.src = floorPlanImage.src;

    // Cleanup function for the effect (optional but good practice)
    return () => {
      // Potentially clear timeouts or other resources if needed
      img.onload = null; // Prevent onload from firing after unmount
    };
  }, [
    floorPlanImage,
    departments,
    selectedDepartment,
    heatmapVisible,
    colorScale,
    maxSales,
    mode,
    pan,
    zoom,
    salesData /* Added salesData dependency */,
  ]); // Dependencies for the drawing effect

  // --- JSX ---
  return (
    <div className="flex flex-col f-screen overflow-hidden">
      {" "}
      {/* Use flex column for layout */}
      {/* Header */}
      <h1 className="text-xl font-bold p-3 bg-gray-100 border-b text-center md:text-left">
        Store Floor Plan Sales Heatmap
      </h1>
      <div className="flex flex-1 overflow-hidden">
        {" "}
        {/* Main content area */}
        {/* Control Panel (Left Sidebar) */}
        <div className="w-full md:w-1/3 lg:w-1/4 p-4 border-r overflow-y-auto space-y-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Controls</h2>

          {/* Step 1: Upload Floor Plan */}
          <div className="space-y-1">
            <label className="block font-medium text-sm" htmlFor="imageUpload">
              1. Upload Floor Plan (PNG/JPG)
            </label>
            <input
              id="imageUpload"
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleImageUpload}
              className="w-full text-sm p-1 border rounded file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {floorPlanImage && (
              <div className="text-xs text-green-600">✓ Floor plan loaded.</div>
            )}
          </div>

          {/* Step 2: Upload Sales Data */}
          <div className="space-y-1">
            <label className="block font-medium text-sm" htmlFor="excelUpload">
              2. Upload Sales Data (XLSX)
            </label>
            <input
              id="excelUpload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="w-full text-sm p-1 border rounded file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              disabled={!floorPlanImage} // Disable until floor plan is loaded
            />
            {!floorPlanImage && (
              <div className="text-xs text-gray-500">
                Upload floor plan first.
              </div>
            )}
            {salesData && (
              <div className="text-xs text-green-600">
                ✓ Sales data loaded ({Object.keys(salesData).length}{" "}
                departments).
              </div>
            )}
            {salesData && !maxSales && (
              <div className="text-xs text-orange-600">
                Note: Max sales value is 0. Heatmap may not show variation.
              </div>
            )}
          </div>

          {/* Step 3: Define Department Areas */}
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-medium text-sm mb-1">
              3. Define Department Areas
            </h3>
            <button
              onClick={showDepartmentSelector}
              className="w-full bg-blue-500 hover:bg-blue-600 text-gray-800 px-3 py-1.5 rounded text-sm font-semibold disabled:bg-gray-300"
              disabled={!floorPlanImage || mode === "draw"} // Disable if no image or already drawing
            >
              {mode === "draw"
                ? "Finish Drawing First"
                : "Add/Select Department"}
            </button>
            {!floorPlanImage && (
              <div className="text-xs text-red-500">
                Upload floor plan to enable.
              </div>
            )}

            {/* Department Selector Popup/Inline */}
            {showDeptSelector && (
              <div className="mt-2 p-3 border-2 border-blue-400 bg-blue-50 rounded shadow-md space-y-3">
                <h4 className="font-semibold text-sm text-blue-800">
                  Select Department to Draw
                </h4>
                {availableDepts.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-1 bg-white">
                    <p className="text-xs text-gray-600 px-1 pb-1">
                      From Excel (not yet drawn):
                    </p>
                    {availableDepts.map((deptName, idx) => (
                      <button
                        key={idx}
                        className="block w-full text-left px-2 py-1 text-sm hover:bg-blue-100 rounded"
                        onClick={() => createDepartment(deptName)}
                        title={`Sales: $${((salesData && salesData[deptName]) || 0).toLocaleString()}`}
                      >
                        {deptName}{" "}
                        <span className="text-xs text-gray-500">
                          ($
                          {(
                            (salesData && salesData[deptName]) ||
                            0
                          ).toLocaleString()}
                          )
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-gray-500">
                    {salesData
                      ? "All departments from Excel are already added or no data loaded."
                      : "Upload sales data to see available departments."}
                  </p>
                )}
                {/* Manual Entry */}
                <div className="flex items-center space-x-2 pt-2 border-t">
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Or type new name"
                    className="flex-1 p-1.5 border rounded text-sm"
                    disabled={!salesData} // Can only add custom if sales data exists? Or allow anytime? Let's allow anytime.
                  />
                  <button
                    onClick={() => createDepartment(newDeptName.trim())} // Trim whitespace
                    disabled={
                      !newDeptName.trim() ||
                      departments.some((d) => d.name === newDeptName.trim())
                    } // Disable if empty or duplicate name
                    className="bg-green-500 text-gray-800 px-3 py-1.5 rounded text-sm disabled:bg-gray-300"
                    title={
                      departments.some((d) => d.name === newDeptName.trim())
                        ? "Department name already exists"
                        : ""
                    }
                  >
                    Create
                  </button>
                </div>
                <button
                  onClick={() => setShowDeptSelector(false)}
                  className="w-full mt-2 bg-gray-400 hover:bg-gray-500 text-gray-800 px-3 py-1 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Drawing Mode Controls */}
            {mode === "draw" &&
              selectedDepartment !== null &&
              departments[selectedDepartment] && (
                <div className="mt-2 p-3 bg-red-100 border-2 border-red-500 rounded shadow space-y-2">
                  <h3 className="font-semibold text-sm text-red-700">
                    Drawing: {departments[selectedDepartment].name}
                  </h3>
                  <p className="text-xs text-red-800">
                    Click on the floor plan to add points (
                    {departments[selectedDepartment].coords.length} added). Need
                    at least 3 points.
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={finishDrawing}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-gray-800 px-3 py-1 rounded text-sm disabled:bg-gray-300"
                      disabled={
                        departments[selectedDepartment].coords.length < 3
                      }
                    >
                      Finish Area
                    </button>
                    <button
                      onClick={clearCurrentDepartmentPoints}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-800 px-3 py-1 rounded text-sm"
                    >
                      Clear Points
                    </button>
                    <button
                      onClick={() => {
                        setMode("view");
                        setSelectedDepartment(null);
                      }} // Cancel drawing this dept
                      className="flex-1 bg-red-500 hover:bg-red-600 text-gray-800 px-3 py-1 rounded text-sm"
                    >
                      Cancel Draw
                    </button>
                  </div>
                </div>
              )}
          </div>

          {/* View Options */}
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-medium text-sm mb-1">View Options</h3>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={heatmapVisible}
                onChange={() => setHeatmapVisible(!heatmapVisible)}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={!salesData || maxSales <= 0}
              />
              <span className="text-sm">Show Sales Heatmap</span>
            </label>
            {(!salesData || maxSales <= 0) && (
              <div className="text-xs text-gray-500 pl-6">
                Load sales data with values > 0 to enable.
              </div>
            )}

            {/* Color Legend */}
            {salesData && maxSales > 0 && heatmapVisible && (
              <div className="pt-2">
                <h4 className="font-medium text-xs mb-1">Sales Legend</h4>
                <div
                  className="h-4 w-full rounded border border-gray-300"
                  style={{
                    background:
                      "linear-gradient(to right, #ffffcc, #ffeda0, #fed976, #feb24c, #fd8d3c, #fc4e2a, #e31a1c, #b10026)",
                  }}
                ></div>
                <div className="flex justify-between text-xs mt-0.5 text-gray-600">
                  <span>$0</span>
                  <span>${Math.round(maxSales / 2).toLocaleString()}</span>
                  <span>${maxSales.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Defined Departments List */}
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-medium text-sm mb-1">
              Defined Departments ({departments.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {departments.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                  No departments defined yet.
                </p>
              ) : (
                departments.map((dept, index) => (
                  <div
                    key={dept.id}
                    className={`flex items-center justify-between p-1.5 rounded border ${
                      selectedDepartment === index && mode === "draw"
                        ? "bg-red-100 border-red-300"
                        : "bg-white border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex-1 mr-2">
                      <span className="font-medium text-sm">{dept.name}</span>
                      {salesData && dept.sales !== undefined && (
                        <span className="ml-1 text-xs text-gray-600">
                          (${dept.sales.toLocaleString()})
                        </span>
                      )}
                      <div className="text-xs text-gray-500">
                        {dept.coords.length} pt
                        {dept.coords.length !== 1 ? "s" : ""}
                        {dept.coords.length >= 3
                          ? ""
                          : dept.coords.length > 0
                            ? " (incomplete)"
                            : " (no area drawn)"}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setSelectedDepartment(index);
                          setMode("draw"); // Enter drawing mode for this department
                          setShowDeptSelector(false); // Close selector if open
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          selectedDepartment === index && mode === "draw"
                            ? "bg-red-500 text-gray-800"
                            : "bg-blue-500 text-gray-800 hover:bg-blue-600"
                        }`}
                        disabled={mode === "draw"} // Disable if already drawing another dept
                        title={
                          mode === "draw"
                            ? "Finish current drawing first"
                            : "Edit this department's area"
                        }
                      >
                        {selectedDepartment === index && mode === "draw"
                          ? "Drawing"
                          : "Edit Area"}
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete department "${dept.name}"?`,
                            )
                          )
                            deleteDepartment(index);
                        }}
                        className="px-2 py-0.5 bg-red-600 text-gray-800 rounded text-xs font-medium hover:bg-red-700"
                        disabled={mode === "draw"} // Disable if drawing
                        title={
                          mode === "draw"
                            ? "Finish current drawing first"
                            : "Delete this department"
                        }
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>{" "}
        {/* End Control Panel */}
        {/* Canvas Area (Right Side) */}
        <div
          className="flex-1 relative bg-gray-200 overflow-hidden"
          ref={containerRef}
        >
          {floorPlanImage ? (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Canvas setup for high-DPI drawing scaled via CSS */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave} // Important to stop dragging if mouse leaves canvas
                onWheel={handleWheel}
                style={{
                  cursor:
                    mode === "draw"
                      ? "crosshair"
                      : isDragging
                        ? "grabbing"
                        : "grab",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  // Width and height are set dynamically in useEffect based on container
                }}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p className="text-lg p-8 text-center">
                Upload a floor plan image using the controls on the left.
              </p>
            </div>
          )}

          {/* Zoom Controls Overlay - Placed over the canvas area */}
          {floorPlanImage && (
            <div className="absolute bottom-4 right-4 bg-white bg-opacity-80 p-1 rounded border border-gray-300 shadow-md flex items-center space-x-1">
              <button
                onClick={() =>
                  handleWheel({
                    preventDefault: () => {},
                    deltaY: -1,
                    clientX:
                      canvasRef.current?.clientWidth / 2 +
                        canvasRef.current?.getBoundingClientRect().left || 0,
                    clientY:
                      canvasRef.current?.clientHeight / 2 +
                        canvasRef.current?.getBoundingClientRect().top || 0,
                  })
                } // Simulate wheel event centered
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold"
                title="Zoom In"
              >
                +
              </button>
              <span className="px-2 py-1 text-xs font-semibold w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() =>
                  handleWheel({
                    preventDefault: () => {},
                    deltaY: 1,
                    clientX:
                      canvasRef.current?.clientWidth / 2 +
                        canvasRef.current?.getBoundingClientRect().left || 0,
                    clientY:
                      canvasRef.current?.clientHeight / 2 +
                        canvasRef.current?.getBoundingClientRect().top || 0,
                  })
                } // Simulate wheel event centered
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="ml-1 px-2 py-1 bg-blue-500 text-gray-800 hover:bg-blue-600 rounded text-xs"
                title="Reset View"
              >
                Reset
              </button>
            </div>
          )}
        </div>{" "}
        {/* End Canvas Area */}
      </div>{" "}
      {/* End Main content flex */}
      {/* Optional Debug section */}
      {/*
       <div className="p-1 bg-gray-800 text-gray-800 text-xs font-mono overflow-x-auto whitespace-nowrap">
         Debug: Mode={mode}, Selected={selectedDepartment}, Zoom={zoom.toFixed(2)}, Pan=({pan.x.toFixed(0)}, {pan.y.toFixed(0)}), Dragging={isDragging.toString()} Depts={departments.length}
       </div>
       */}
    </div> // End main container
  );
};

export default StoreHeatmap;
