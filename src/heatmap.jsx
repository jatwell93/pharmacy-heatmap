import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import * as d3 from "d3";

const StoreHeatmap = () => {
  const [floorPlanImage, setFloorPlanImage] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [mode, setMode] = useState("view"); // 'view', 'draw', 'edit'
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [maxSales, setMaxSales] = useState(0);
  const [colorScale, setColorScale] = useState(() =>
    d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]),
  );
  const [debugInfo, setDebugInfo] = useState("");

  // New state for the department creation UI
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [availableDepts, setAvailableDepts] = useState([]);

  // New state for canvas panning and zooming
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Handle floor plan image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setFloorPlanImage({
            src: e.target.result,
            width: img.width,
            height: img.height,
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Excel data upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Assume first sheet contains the data
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // For your specific data format, we need to extract departments and sales
          // Your data has departments in the first column (no header) and sales in the TY column

          // Convert to JSON with row headers (A, B, C, etc)
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });

          // Extract departments (column A) and sales (column C for TY)
          const deptSales = {};
          let maxSalesValue = 0;
          const deptList = [];

          // Skip the first row (headers)
          jsonData.slice(1).forEach((row) => {
            const deptName = row.A; // Department name is in column A
            const salesValue = typeof row.C === "number" ? row.C : 0; // TY sales in column C

            if (deptName && !isNaN(salesValue)) {
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
          setAvailableDepts(deptList);
          setDebugInfo(`Loaded ${deptList.length} departments from Excel`);

          // Update departments that have sales data
          setDepartments((prevDepts) => {
            return prevDepts.map((dept) => {
              return {
                ...dept,
                sales: deptSales[dept.name] || 0,
              };
            });
          });

          // Update color scale domain
          setColorScale(
            d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxSalesValue]),
          );
        } catch (error) {
          console.error("Error processing Excel file:", error);
          alert("Error processing Excel file. Please check the format.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Show the department selector UI
  const showDepartmentSelector = () => {
    if (!floorPlanImage) {
      alert("Please upload a floor plan image first");
      return;
    }
    setShowDeptSelector(true);
    setDebugInfo("Opened department selector");
  };

  // Create a new department and start drawing
  const createDepartment = (name) => {
    if (!name) return;

    const newDept = {
      id: Date.now().toString(),
      name,
      coords: [],
      sales: salesData && salesData[name] ? salesData[name] : 0,
    };

    // Add the new department
    const newIndex = departments.length;

    setDepartments([...departments, newDept]);
    setSelectedDepartment(newIndex);
    setMode("draw");
    setShowDeptSelector(false);
    setNewDeptName("");

    setDebugInfo(
      `Created department "${name}" at index ${newIndex} and started drawing mode`,
    );
  };

  // Handle canvas click for drawing department boundaries
  const handleCanvasClick = (e) => {
    if (mode !== "draw" || selectedDepartment === null) {
      console.log(
        `Canvas click ignored - mode: ${mode}, selectedDept: ${selectedDepartment}`,
      );
      setDebugInfo(
        `Canvas click ignored - Not in drawing mode or no department selected`,
      );
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log("Canvas reference is null");
      setDebugInfo("Error: Canvas reference is null");
      return;
    }

    // Get the canvas bounding rectangle for mouse coordinate conversion
    const canvasRect = canvas.getBoundingClientRect();

    // Calculate scale factors between the displayed canvas and actual canvas dimensions
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;

    // Convert mouse coordinates to canvas coordinates with scaling
    const x = (e.clientX - canvasRect.left) * scaleX;
    const y = (e.clientY - canvasRect.top) * scaleY;

    console.log(
      `Raw click at (${e.clientX - canvasRect.left}, ${e.clientY - canvasRect.top})`,
    );
    console.log(
      `Scaled click at (${x}, ${y}) with scale factors (${scaleX}, ${scaleY})`,
    );
    console.log(
      `Canvas dimensions: ${canvas.width}x${canvas.height}, Display: ${canvasRect.width}x${canvasRect.height}`,
    );

    // Add point to the department
    setDepartments((prevDepts) => {
      if (!prevDepts[selectedDepartment]) {
        console.error(
          `Department at index ${selectedDepartment} doesn't exist`,
        );
        setDebugInfo(
          `Error: Department at index ${selectedDepartment} doesn't exist`,
        );
        return prevDepts;
      }

      const newDepts = [...prevDepts];
      newDepts[selectedDepartment] = {
        ...newDepts[selectedDepartment],
        coords: [...(newDepts[selectedDepartment].coords || []), { x, y }],
      };

      setDebugInfo(
        `Added point (${x.toFixed(0)}, ${y.toFixed(0)}) to ${newDepts[selectedDepartment].name}`,
      );
      return newDepts;
    });

    // Give visual feedback that a point was added
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,0,0,0.5)";
    ctx.fill();

    // Show confirmation text near the point
    const pointNumber =
      departments[selectedDepartment]?.coords?.length + 1 || 1;
    ctx.fillStyle = "#ff0000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Point ${pointNumber} added`, x, y - 10);
  };

  // Finish drawing the current department
  const finishDrawing = () => {
    setMode("view");
    setSelectedDepartment(null);
  };

  // Clear the current department's coordinates
  const clearCurrentDepartment = () => {
    if (selectedDepartment !== null) {
      setDepartments((prevDepts) => {
        const newDepts = [...prevDepts];
        if (newDepts[selectedDepartment]) {
          newDepts[selectedDepartment] = {
            ...newDepts[selectedDepartment],
            coords: [],
          };
        }
        return newDepts;
      });
    }
  };

  // Delete a department
  const deleteDepartment = (index) => {
    setDepartments((prevDepts) => {
      const newDepts = [...prevDepts];
      newDepts.splice(index, 1);
      return newDepts;
    });

    if (selectedDepartment === index) {
      setSelectedDepartment(null);
      setMode("view");
    }
  };

  // Draw the floor plan and heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floorPlanImage) return;

    canvas.width = floorPlanImage.width;
    canvas.height = floorPlanImage.height;

    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the floor plan image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw department areas with heatmap if visible
      departments.forEach((dept, deptIndex) => {
        if (dept.coords.length > 0) {
          // Always draw points for the department being edited
          if (selectedDepartment === deptIndex || mode === "draw") {
            // Draw points (vertices)
            dept.coords.forEach((point, i) => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = "#ff0000";
              ctx.fill();

              // Add point number for better visibility during drawing
              ctx.fillStyle = "#ffffff";
              ctx.font = "10px Arial";
              ctx.textAlign = "center";
              ctx.fillText(i + 1, point.x, point.y + 3);
            });

            // Draw lines connecting points even if less than 3 points
            if (dept.coords.length > 1) {
              ctx.beginPath();
              ctx.moveTo(dept.coords[0].x, dept.coords[0].y);

              for (let i = 1; i < dept.coords.length; i++) {
                ctx.lineTo(dept.coords[i].x, dept.coords[i].y);
              }

              // Only close the path if we have 3 or more points
              if (dept.coords.length >= 3) {
                ctx.closePath();
              }

              ctx.strokeStyle = "#ff0000";
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 3]); // Dashed line for in-progress
              ctx.stroke();
              ctx.setLineDash([]); // Reset to solid line
            }
          }

          // Only fill complete departments (with 3+ points)
          if (dept.coords.length > 2) {
            ctx.beginPath();
            ctx.moveTo(dept.coords[0].x, dept.coords[0].y);

            for (let i = 1; i < dept.coords.length; i++) {
              ctx.lineTo(dept.coords[i].x, dept.coords[i].y);
            }

            ctx.closePath();

            if (heatmapVisible && dept.sales > 0) {
              // Fill with heat color based on sales
              const normalizedSales = maxSales > 0 ? dept.sales / maxSales : 0;
              ctx.fillStyle = colorScale(normalizedSales);
              ctx.globalAlpha = 0.7; // Semi-transparent
              ctx.fill();
              ctx.globalAlpha = 1.0;
            } else {
              // Fill with a light color if no heatmap
              ctx.fillStyle =
                selectedDepartment === deptIndex
                  ? "rgba(255,0,0,0.1)"
                  : "rgba(200,200,200,0.2)";
              ctx.fill();
            }

            // Draw outline
            ctx.strokeStyle =
              selectedDepartment === deptIndex ? "#ff0000" : "#000000";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw department name at center
            const centerX =
              dept.coords.reduce((sum, coord) => sum + coord.x, 0) /
              dept.coords.length;
            const centerY =
              dept.coords.reduce((sum, coord) => sum + coord.y, 0) /
              dept.coords.length;

            ctx.fillStyle = "#000000";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(dept.name, centerX, centerY);

            // Show sales if available
            if (dept.sales) {
              ctx.fillText(
                `${dept.sales.toLocaleString()}`,
                centerX,
                centerY + 20,
              );
            }
          }
        }
      });

      // Add visual cue for drawing mode
      if (mode === "draw" && selectedDepartment !== null) {
        ctx.fillStyle = "rgba(255,0,0,0.7)";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.fillText(
          "DRAWING MODE: Click to add points for " +
            (departments[selectedDepartment]?.name || "department"),
          10,
          30,
        );
      }
    };
    img.src = floorPlanImage.src;
  }, [
    floorPlanImage,
    departments,
    selectedDepartment,
    heatmapVisible,
    colorScale,
    maxSales,
    mode,
  ]);

  return (
    <div className="flex flex-col space-y-4 p-4 w-full">
      <h1 className="text-2xl font-bold">Store Floor Plan Sales Heatmap</h1>

      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="w-full md:w-1/3 p-4 border rounded">
          <h2 className="text-lg font-semibold mb-4">Controls</h2>

          <div className="mb-4">
            <h3 className="font-medium mb-2">Step 1: Upload Floor Plan</h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full p-2 border rounded"
            />
            {floorPlanImage && (
              <div className="mt-2 text-green-600 text-sm">
                ✓ Floor plan uploaded successfully
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="font-medium mb-2">
              Step 2: Upload Sales Data (Excel)
            </h3>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelUpload}
              className="w-full p-2 border rounded"
            />
            {salesData && (
              <div className="mt-2 text-green-600 text-sm">
                ✓ Sales data loaded successfully
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="font-medium mb-2">
              Step 3: Define Department Areas
            </h3>
            <button
              onClick={showDepartmentSelector}
              className="bg-blue-500 hover:bg-blue-600 text-gray-800 px-4 py-2 rounded mr-2 font-bold"
              disabled={!floorPlanImage}
            >
              Add Department
            </button>

            {!floorPlanImage && (
              <div className="mt-2 text-red-500 text-sm">
                Upload a floor plan image first
              </div>
            )}

            {/* Department Selector UI */}
            {showDeptSelector && (
              <div className="mt-3 p-4 border-2 border-blue-400 bg-blue-50 rounded">
                <h4 className="font-medium mb-2">
                  Select or Create Department
                </h4>

                {availableDepts.length > 0 ? (
                  <div className="mb-3">
                    <p className="text-sm mb-2">
                      Choose from available departments:
                    </p>
                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                      {availableDepts.map((dept, idx) => (
                        <button
                          key={idx}
                          className="text-left px-2 py-1 text-sm hover:bg-blue-100 rounded"
                          onClick={() => createDepartment(dept)}
                        >
                          {dept}{" "}
                          {salesData && salesData[dept]
                            ? `(${salesData[dept].toLocaleString()})`
                            : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm mb-2 italic">
                    No departments available from sales data
                  </p>
                )}

                <div className="flex items-center mt-3">
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Or enter a department name"
                    className="flex-1 p-2 border rounded"
                  />
                  <button
                    onClick={() => createDepartment(newDeptName)}
                    disabled={!newDeptName.trim()}
                    className="ml-2 bg-green-500 text-gray-800 px-3 py-2 rounded disabled:bg-gray-300"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowDeptSelector(false);
                      setDebugInfo("Closed department selector");
                    }}
                    className="ml-2 bg-red-500 text-gray-800 px-3 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {floorPlanImage &&
              departments.length === 0 &&
              !showDeptSelector && (
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded">
                  <strong>No departments defined yet.</strong> Click "Add
                  Department" to start drawing areas on your floor plan.
                </div>
              )}

            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={heatmapVisible}
                  onChange={() => setHeatmapVisible(!heatmapVisible)}
                  className="mr-2"
                />
                Show Sales Heatmap
              </label>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto">
              {departments.map((dept, index) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-2 border-b"
                >
                  <div>
                    <span>{dept.name}</span>
                    {dept.sales > 0 && (
                      <span className="ml-2 text-sm text-gray-600">
                        ${dept.sales.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setSelectedDepartment(index);
                        setMode("draw");
                      }}
                      className="text-blue-500 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteDepartment(index)}
                      className="text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mode === "draw" && selectedDepartment !== null && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded">
              <h3 className="font-medium mb-2 text-red-700">
                DRAWING MODE ACTIVE
              </h3>
              <p className="text-sm mb-2">
                <strong>Department:</strong>{" "}
                {departments[selectedDepartment]?.name ||
                  "No department selected"}
                <br />
                <strong>Instructions:</strong> Click on the image to add points.
                Connect at least 3 points to create an area.
                <br />
                <strong>Points added:</strong>{" "}
                {departments[selectedDepartment]?.coords?.length || 0}
                {departments[selectedDepartment]?.coords?.length < 3 && (
                  <span className="text-red-600 font-bold">
                    {" "}
                    (Need at least 3 points)
                  </span>
                )}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={finishDrawing}
                  className="bg-green-500 text-gray-800 px-3 py-1 rounded text-sm"
                  disabled={departments[selectedDepartment]?.coords?.length < 3}
                >
                  Finish Drawing
                </button>
                <button
                  onClick={clearCurrentDepartment}
                  className="bg-red-500 text-gray-800 px-3 py-1 rounded text-sm"
                >
                  Clear Points
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-700">
                <strong>Status:</strong> Selected department index:{" "}
                {selectedDepartment}, Drawing mode:{" "}
                {mode ? "Active" : "Inactive"}
              </div>
            </div>
          )}

          {/* Color legend if we have sales data */}
          {salesData && maxSales > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Sales Legend</h3>
              <div
                className="h-6 w-full"
                style={{
                  background:
                    "linear-gradient(to right, #ffffcc, #ffeda0, #fed976, #feb24c, #fd8d3c, #fc4e2a, #e31a1c, #b10026)",
                }}
              ></div>
              <div className="flex justify-between text-xs mt-1">
                <span>$0</span>
                <span>${Math.round(maxSales / 2).toLocaleString()}</span>
                <span>${maxSales.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-2/3 relative" ref={containerRef}>
          {floorPlanImage ? (
            <div className="relative border rounded">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full block"
                style={{
                  cursor: mode === "draw" ? "crosshair" : "default",
                  width: "100%",
                  height: "auto",
                }}
              />
              {mode === "draw" && (
                <div className="absolute top-2 left-2 bg-red-500 text-gray-800 px-2 py-1 rounded text-sm">
                  Click to add points for{" "}
                  {departments[selectedDepartment]?.name || "department"}
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded p-8 text-center bg-gray-100 h-96 flex items-center justify-center">
              <p>Upload a floor plan image to get started</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <h3 className="font-medium mb-1">How to use:</h3>
        <ol className="list-decimal pl-5">
          <li>Upload your store floor plan image</li>
          <li>Upload your Excel file with sales data</li>
          <li>Add departments and draw their boundaries on the floor plan</li>
          <li>
            The heatmap will automatically show which departments have the
            highest sales
          </li>
          <li>Toggle the heatmap visualization on/off as needed</li>
        </ol>
      </div>

      {/* Debug section - will help troubleshoot */}
      <div className="mt-4 p-3 bg-gray-100 border rounded text-xs">
        <h4 className="font-bold">Debug Info:</h4>
        <p>
          Selected Department:{" "}
          {selectedDepartment !== null ? selectedDepartment : "none"}
        </p>
        <p>Drawing Mode: {mode === "draw" ? "Active" : "Inactive"}</p>
        <p>Departments Count: {departments.length}</p>
        <p>Last Action: {debugInfo}</p>
        {selectedDepartment !== null && departments[selectedDepartment] && (
          <div>
            <p>Current Department: {departments[selectedDepartment].name}</p>
            <p>Points: {departments[selectedDepartment].coords.length}</p>
            {departments[selectedDepartment].coords.length > 0 && (
              <div>
                <p>Coordinates:</p>
                <ul className="pl-5 list-disc">
                  {departments[selectedDepartment].coords.map((coord, i) => (
                    <li key={i}>
                      Point {i + 1}: ({Math.round(coord.x)},{" "}
                      {Math.round(coord.y)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {canvasRef.current && (
          <div>
            <p>
              Canvas size: {canvasRef.current.width} x{" "}
              {canvasRef.current.height}
            </p>
            <p>
              Display size: {canvasRef.current.getBoundingClientRect().width} x{" "}
              {canvasRef.current.getBoundingClientRect().height}
            </p>
            <p>
              Scale: x
              {(
                canvasRef.current.width /
                canvasRef.current.getBoundingClientRect().width
              ).toFixed(2)}
              , y
              {(
                canvasRef.current.height /
                canvasRef.current.getBoundingClientRect().height
              ).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreHeatmap;
