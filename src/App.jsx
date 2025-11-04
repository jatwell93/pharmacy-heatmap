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
  const [blurRadius, setBlurRadius] = useState(50); // Blur radius for heatmap
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.85); // Opacity for heatmap

  const [colorScale, setColorScale] = useState(() =>
    d3.scaleSequential(d3.interpolateRdYlBu).domain([1, 0]),
  );

  // State for canvas panning and zooming
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // For panning calculation

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null); // Ref for the canvas container to get bounds
  const heatmapCanvasRef = useRef(document.createElement("canvas")); // Off-screen canvas for heatmap

  // --- File Handling ---

  // Handle floor plan image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setFloorPlanImage(img);
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
        img.onerror = () => {
          alert(
            "Failed to load the image. Please ensure it's a valid PNG or JPG file.",
          );
        };
        img.src = event.target.result;
      };
      reader.onerror = () => {
        alert("Failed to read the file. Please try again.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Excel data upload
  // In your handleExcelUpload function, ensure this part is working:
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
          let maxSalesValue = 0; // Important variable!
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

          // Make sure maxSales state is actually getting updated
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

          setColorScale(() =>
            d3.scaleSequential(d3.interpolateRdYlBu).domain([1, 0]),
          );
        } catch (error) {
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

      // Mouse position relative to the canvas element, corrected for scaling
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

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

  // --- Heatmap Generation ---

  const generateHeatmap = useCallback(
    (width, height) => {
      if (!departments.length || !maxSales || !heatmapVisible) {
        return null;
      }

      // Create offscreen canvas for the heatmap
      const heatmapCanvas = heatmapCanvasRef.current;
      heatmapCanvas.width = width;
      heatmapCanvas.height = height;
      const heatmapCtx = heatmapCanvas.getContext("2d");
      heatmapCtx.clearRect(0, 0, width, height);

      // Draw each department as a filled polygon with alpha based on sales
      // WITH THIS CENTER-FOCUSED VERSION:
      for (const dept of departments) {
        if (!dept.coords || dept.coords.length < 3) {
          continue;
        }

        // Calculate the centroid of the department polygon
        let centerX = 0,
          centerY = 0;
        dept.coords.forEach((coord) => {
          centerX += coord.x;
          centerY += coord.y;
        });
        centerX /= dept.coords.length;
        centerY /= dept.coords.length;

        // Calculate the maximum distance from center to any vertex (for gradient radius)
        let maxDistance = 0;
        dept.coords.forEach((coord) => {
          const distance = Math.sqrt(
            Math.pow(coord.x - centerX, 2) + Math.pow(coord.y - centerY, 2),
          );
          if (distance > maxDistance) {
            maxDistance = distance;
          }
        });

        // Add a little extra to the radius to ensure it covers the whole polygon
        const gradientRadius = maxDistance * 1.2;

        let intensity = dept.sales / maxSales; // Normalized sales value

        if (isNaN(intensity) || !isFinite(intensity)) {
          intensity = 0.5; // Use a default value if we get NaN
        }

        intensity = Math.pow(intensity, 0.3);
        intensity = Math.max(intensity, 0.3); // Ensure intensity is at least 30%

        // Create a radial gradient centered at the department's centroid
        const gradient = heatmapCtx.createRadialGradient(
          centerX,
          centerY,
          0, // Inner circle center and radius
          centerX,
          centerY,
          gradientRadius, // Outer circle center and radius
        );

        // Add color stops to the gradient
        // Center is full intensity, edges fade to around 30% of the intensity
        gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`); // Center - full intensity
        gradient.addColorStop(0.7, `rgba(255, 255, 255, ${intensity * 0.8})`); // Middle area - 80% intensity
        gradient.addColorStop(1, `rgba(255, 255, 255, ${intensity * 0.3})`); // Edge - 30% intensity

        // Draw the department polygon using the gradient
        heatmapCtx.beginPath();
        heatmapCtx.moveTo(dept.coords[0].x, dept.coords[0].y);
        for (let i = 1; i < dept.coords.length; i++) {
          heatmapCtx.lineTo(dept.coords[i].x, dept.coords[i].y);
        }
        heatmapCtx.closePath();

        // Fill with the gradient
        heatmapCtx.fillStyle = gradient;
        heatmapCtx.fill();
      }

      // Apply blur to create a smooth heatmap effect
      heatmapCtx.filter = `blur(${blurRadius * 1.5}px)`; // Increase blur for smoother effect

      // Create temporary canvas to apply the blur
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d");

      // Draw the blurred content to the temp canvas
      tempCtx.drawImage(heatmapCanvas, 0, 0);

      // Clear original and reset filter
      heatmapCtx.clearRect(0, 0, width, height);
      heatmapCtx.filter = "none";

      // Get the blurred image data
      const blurredData = tempCtx.getImageData(0, 0, width, height);
      const outputData = heatmapCtx.createImageData(width, height);

      // Apply the color scale to the blurred data
      for (let i = 0; i < blurredData.data.length; i += 4) {
        const alpha = blurredData.data[i + 3] / 255; // Normalize alpha to 0-1
        if (alpha > 0) {
          // Apply color based on the alpha (intensity)
          const color = d3.rgb(colorScale(alpha));
          outputData.data[i] = color.r; // R
          outputData.data[i + 1] = color.g; // G
          outputData.data[i + 2] = color.b; // B

          outputData.data[i + 3] = Math.min(
            255,
            alpha * 255 * heatmapOpacity * 1.5,
          ); // A - Amplify opacity
        }
      }

      // Put the colored data back to the heatmap canvas
      heatmapCtx.putImageData(outputData, 0, 0);

      return heatmapCanvas;
    },
    [
      departments,
      maxSales,
      colorScale,
      heatmapVisible,
      blurRadius,
      heatmapOpacity,
    ],
  );

  // --- Drawing Effect ---

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const container = containerRef.current;

    if (!ctx || !floorPlanImage || !container || !floorPlanImage.complete) {
      // Clear canvas if no image or context
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // --- Canvas Resizing (Fit container) ---
    // Match canvas logical size to container size for correct display scaling
    const { width: containerWidth, height: containerHeight } =
      container.getBoundingClientRect();

    // Fallback if container height is 0 (likely due to absolute positioned children)
    let effectiveContainerWidth = containerWidth;
    let effectiveContainerHeight = containerHeight;
    if (containerHeight === 0) {
      effectiveContainerHeight = 600;
    }

    // We want the canvas drawing buffer to match the image resolution for clarity,
    // but its display size should fit the container.
    // Calculate the aspect ratios
    const imageAspectRatio = floorPlanImage.width / floorPlanImage.height;

    let displayWidth, displayHeight;

    // Fit image to full container height to maximize space, allowing horizontal scrolling if necessary
    displayHeight = effectiveContainerHeight;
    displayWidth = effectiveContainerHeight * imageAspectRatio;

    // Set the actual drawing buffer size (high resolution)
    canvas.width = floorPlanImage.width;
    canvas.height = floorPlanImage.height;

    // Set the display size using CSS (scales the high-res buffer down)
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    // Center the canvas within the container using flex
    canvas.style.display = "block";
    //
    // --- Drawing ---
    // Clear canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state before applying transformations
    ctx.save();

    // Apply pan and zoom transformations
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // First, draw the floor plan image (transformed)
    try {
      ctx.drawImage(
        floorPlanImage,
        0,
        0,
        floorPlanImage.width,
        floorPlanImage.height,
      );
    } catch (error) {
      console.error("Error drawing image:", error);
    }

    // IMPORTANT: Make sure these conditions are true
    console.log("Before heatmap check:", {
      heatmapVisible,
      departmentsLength: departments.length,
      maxSales,
    });

    // Generate and draw the heatmap if enabled
    if (heatmapVisible && departments.length > 0 && maxSales > 0) {
      console.log("Attempting to generate heatmap");
      const heatmapCanvas = generateHeatmap(canvas.width, canvas.height);
      if (heatmapCanvas) {
        console.log(
          "Drawing heatmap to main canvas with opacity:",
          heatmapOpacity,
        );
        // Draw the heatmap over the floor plan with transparency
        ctx.globalAlpha = heatmapOpacity;
        ctx.drawImage(heatmapCanvas, 0, 0);
        ctx.globalAlpha = 1.0; // Reset alpha
        console.log("Heatmap drawn successfully");
      } else {
        console.log("generateHeatmap returned null");
      }
    } else {
      console.log("Skipping heatmap generation due to conditions not met");
    }

    // Draw department boundaries
    departments.forEach((dept, deptIndex) => {
      if (!dept.coords || dept.coords.length < 3) return; // Skip if not enough coordinates

      const isSelected = selectedDepartment === deptIndex;

      // Draw department outline
      ctx.beginPath();
      ctx.moveTo(dept.coords[0].x, dept.coords[0].y);
      for (let i = 1; i < dept.coords.length; i++) {
        ctx.lineTo(dept.coords[i].x, dept.coords[i].y);
      }
      ctx.closePath();

      // Draw outline
      ctx.strokeStyle = isSelected
        ? "rgba(255, 0, 0, 0.8)"
        : "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = isSelected ? 2 / zoom : 1 / zoom;
      ctx.stroke();

      // Calculate centroid for label placement
      let centerX = 0,
        centerY = 0;
      dept.coords.forEach((coord) => {
        centerX += coord.x;
        centerY += coord.y;
      });
      centerX /= dept.coords.length;
      centerY /= dept.coords.length;

      // Draw department name
      const fontSize = Math.max(10, 14 / zoom);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#000000";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 3 / zoom;
      ctx.strokeText(dept.name, centerX, centerY);
      ctx.fillText(dept.name, centerX, centerY);

      // Draw sales value
      if (salesData && dept.sales !== undefined) {
        const salesText = `$${dept.sales.toLocaleString()}`;
        const salesFontSize = Math.max(8, 12 / zoom);
        ctx.font = `${salesFontSize}px Arial`;
        ctx.strokeText(salesText, centerX, centerY + fontSize * 1.2);
        ctx.fillText(salesText, centerX, centerY + fontSize * 1.2);
      }
    });

    // Draw points and lines for the department being drawn
    if (
      mode === "draw" &&
      selectedDepartment !== null &&
      departments[selectedDepartment]
    ) {
      const dept = departments[selectedDepartment];

      // Draw lines connecting points
      if (dept.coords.length > 1) {
        ctx.beginPath();
        ctx.moveTo(dept.coords[0].x, dept.coords[0].y);
        for (let i = 1; i < dept.coords.length; i++) {
          ctx.lineTo(dept.coords[i].x, dept.coords[i].y);
        }
        if (dept.coords.length >= 3) {
          ctx.closePath();
        }
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 3 / zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw points
      dept.coords.forEach((point) => {
        ctx.beginPath();
        const pointRadius = 4 / zoom;
        ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#ff0000";
        ctx.fill();
      });
    }

    // Restore context state (removes transforms)
    ctx.restore();

    // --- Draw UI Overlays (like drawing mode text) - Drawn AFTER restoring context ---
    if (
      mode === "draw" &&
      selectedDepartment !== null &&
      departments[selectedDepartment]
    ) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      const drawingText =
        "DRAWING: " +
        departments[selectedDepartment].name +
        ". Click to add points. (" +
        departments[selectedDepartment].coords.length +
        " points)";
      ctx.fillText(drawingText, 10, 25);
    }
    if (mode === "view" && !isDragging) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.font = "12px Arial";
      ctx.textAlign = "left";
      const viewText = "View Mode: Drag to Pan, Scroll to Zoom";
      ctx.fillText(viewText, 10, 25);
    }
    // Cleanup function for the effect
    return () => {
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    salesData,
    generateHeatmap,
    heatmapOpacity,
    blurRadius,
  ]); // Dependencies for the drawing effect

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-gray-100 border-b">
        <div className="mx-auto flex items-center gap-3 p-3">
          <a href="/icons8-heat-map-bubbles-96.png" className="shrink-0">
            <img
              src="/icons8-heat-map-bubbles-96.png"
              alt="Heatmap logo"
              className="h-8 w-8 md:h-10 md:w-10"
            />
          </a>
          <h1 className="text-xl md:text-3xl font-bold">
            Store Floor Plan Sales Heatmap
          </h1>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {" "}
        {/* Main content area */}
        {/* Control Panel (Left Sidebar) */}
        <div className="w-full md:w-1/3 lg:w-1/4 p-4 border-r overflow-y-auto space-y-4 bg-gray-50">
          <div className="mt-4 text-sm ">
            <h2 className="text-lg font-semibold mb-3 border-b pb-2">
              How to Use
            </h2>
            <ol className="list-decimal pl-5">
              <li>Upload your store floor plan image</li>
              <li>
                Upload your Excel file with sales data (Department names in
                Column A, Sales* in Column B)
                <br />{" "}
                <i>
                  *This could be profit $ or sales $ etc. but must be normalised
                  by space. The easiest way to do this is to take the department
                  sales and divide by bay count. EXAMPLE: Skincare $10,000 / 5
                  bays = $2,000 per bay)
                </i>
              </li>
              <li>
                Add departments by selecting a department and drawing its
                boundaries on the floor plan.{" "}
                <i>(Easiest way is to click the 4 corners of the section)</i>
              </li>
              <li>
                The heatmap will automatically show which departments have the
                highest sales
              </li>
              <li>
                Use the mouse to pan (drag) and zoom (scroll wheel) around the
                floor plan
              </li>
              <li>
                Toggle the heatmap visualisation and adjust settings as needed
              </li>
            </ol>
          </div>
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Uploads</h2>

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
          <div className="space-y-2 pt-3">
            <h3 className="font-medium text-sm mb-1">
              3. Define Department Areas
            </h3>
            <button
              onClick={showDepartmentSelector}
              //
              className="w-full border border-gray-600 bg-blue-500 hover:bg-blue-600 text-gray-800 px-3 py-1.5 rounded text-sm font-semibold disabled:bg-gray-300"
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
                  />
                  <button
                    onClick={() => createDepartment(newDeptName.trim())} // Trim whitespace
                    disabled={
                      !newDeptName.trim() ||
                      departments.some((d) => d.name === newDeptName.trim())
                    } // Disable if empty or duplicate name
                    className="border border-gray-600 bg-green-500 text-gray-800 px-3 py-1.5 rounded text-sm disabled:bg-gray-300"
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
                  className="w-full mt-2 border border-gray-600 bg-gray-400 hover:bg-gray-500 text-gray-800 px-3 py-1 rounded text-xs"
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
                      className="flex-1 border border-gray-600 bg-green-500 hover:bg-green-600 text-black px-3 py-1 rounded text-sm disabled:bg-gray-300"
                    >
                      Finish Area
                    </button>
                    <button
                      onClick={clearCurrentDepartmentPoints}
                      className="flex-1 border border-gray-600 bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded text-sm"
                    >
                      Clear Points
                    </button>
                    <button
                      onClick={() => {
                        setMode("view");
                        setSelectedDepartment(null);
                      }} // Cancel drawing this dept
                      className="flex-1 border border-gray-600 bg-red-500 hover:bg-red-600 text-black px-3 py-1 rounded text-sm"
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
                Load sales data with values &gt; 0 to enable.
              </div>
            )}

            {/* Heatmap Advanced Options */}
            {heatmapVisible && salesData && maxSales > 0 && (
              <div className="space-y-3 mt-2 p-2 bg-gray-100 rounded">
                {/* Blur Radius Control */}
                <div>
                  <label className="text-xs font-medium block mb-1">
                    Blur Radius: {blurRadius}px
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Opacity Control */}
                <div>
                  <label className="text-xs font-medium block mb-1">
                    Opacity: {Math.round(heatmapOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={heatmapOpacity * 100}
                    onChange={(e) =>
                      setHeatmapOpacity(parseInt(e.target.value) / 100)
                    }
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Color Legend */}
            {salesData && maxSales > 0 && heatmapVisible && (
              <div className="pt-3 pb-1">
                <h4 className="font-medium text-sm mb-2">Sales Legend</h4>
                <div
                  className="h-6 w-full rounded-md border border-gray-300 shadow-inner"
                  style={{
                    background:
                      "linear-gradient(to right, #d73027, #fc8d59, #fee090, #ffffbf, #e0f3f8, #91bfdb, #4575b4)",
                  }}
                ></div>
                <div className="flex justify-between text-xs mt-1.5 text-gray-700 px-1 font-medium">
                  <span>${maxSales.toLocaleString()}</span>
                  <span>${Math.round(maxSales / 2).toLocaleString()}</span>
                  <span>$0</span>
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
                    className={
                      "flex items-center justify-between p-1.5 rounded border " +
                      (selectedDepartment === index && mode === "draw"
                        ? "bg-red-100 border-red-300"
                        : "bg-white border-gray-200 hover:bg-gray-100")
                    }
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
                        className={
                          "px-2 py-0.5 border border-gray-600 rounded text-xs font-medium " +
                          (selectedDepartment === index && mode === "draw"
                            ? "bg-red-500 text-gray-800"
                            : "bg-blue-500 text-gray-800 hover:bg-blue-600")
                        }
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
                              'Are you sure you want to delete department "' +
                                dept.name +
                                '"?',
                            )
                          )
                            deleteDepartment(index);
                        }}
                        className="border border-gray-600 px-2 py-0.5 bg-red-600 text-gray-800 rounded text-xs font-medium hover:bg-red-700"
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
          className="flex-1 relative bg-gray-200 overflow-auto"
          style={{
            width: "100%",
            height: "100%",
            minHeight: "900px",
            position: "relative",
            overflow: "auto",
          }}
          ref={containerRef}
        >
          {floorPlanImage ? (
            <div className="absolute inset-0">
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
    </div>
  );
};

export default StoreHeatmap;
