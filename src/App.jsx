import React, { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import * as d3 from "d3";

const PharmIQHeatMap = () => {
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
    d3.scaleLinear()
      .domain([0, 0.5, 1])
      .range(["#F8FAFC", "#0F766E", "#D97706"])
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
            d3.scaleLinear()
              .domain([0, maxSalesValue / 2, maxSalesValue])
              .range(["#F8FAFC", "#0F766E", "#D97706"])
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
        ctx.strokeStyle = "#D97706"; // Brand Amber for mapping lines
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
        ctx.fillStyle = "#D97706"; // Brand Amber
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
      ctx.fillStyle = "rgba(217, 119, 6, 0.9)"; // Brand Amber with high opacity
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.textAlign = "left";
      const drawingText =
        "PROFIT CENTER MAPPING: " +
        departments[selectedDepartment].name +
        ". CLICK TO ADD ARCHITECTURE. (" +
        departments[selectedDepartment].coords.length +
        " POINTS)";
      ctx.fillText(drawingText, 10, 25);
    }
    if (mode === "view" && !isDragging) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)"; // Brand Navy with opacity
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.textAlign = "left";
      const viewText = "COMMAND MODE: DRAG TO PAN • SCROLL TO ZOOM";
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
    <div className="flex flex-col h-full overflow-hidden font-body text-brand-navy">
      {/* Header */}
      <header className="bg-white border-b border-border-light shadow-sm">
        <div className="mx-auto flex items-center justify-between p-4 px-6">
          <div className="flex items-center gap-4">
            <img
              src="/pharmiq-logo-full.svg"
              alt="PharmIQ Logo"
              className="h-10 w-auto"
            />
            <div className="h-6 w-px bg-border-light hidden md:block"></div>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-brand-teal hidden md:block">
              Heat-Map Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-xs font-medium px-2 py-1 bg-brand-teal/10 text-brand-teal rounded-full uppercase tracking-wider">Infrastructure for Choice</span>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {" "}
        {/* Main content area */}
        {/* Control Panel (Left Sidebar) */}
        <div className="w-full md:w-1/3 lg:w-1/4 p-6 border-r border-border-light overflow-y-auto space-y-6 bg-surface-gray">
          <div className="p-4 bg-white/50 backdrop-blur-md rounded-xl border border-border-light shadow-sm">
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-brand-teal/80 mb-3 border-b border-border-light/50 pb-2">
              Command Center Setup
            </h2>
            <ol className="list-decimal pl-4 space-y-2 text-sm text-gray-600">
              <li>Upload your <strong>Store Floor Plan</strong></li>
              <li>
                Upload your <strong>Sales Intelligence</strong> (Excel/XLSX)
                <div className="mt-1 text-xs bg-brand-amber/5 text-brand-amber-dark p-2 rounded italic border-l-2 border-brand-amber">
                  Column A: Department Name<br/>
                  Column C: Normalized Performance Data ($)
                </div>
              </li>
              <li>
                Define <strong>Profit Centers</strong> by mapping boundaries on the floor plan
              </li>
            </ol>
          </div>
          
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-heading font-bold text-brand-navy">Operational Inputs</h2>
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-bold text-gray-500">
              <span className="opacity-50">⌘</span>K
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">Connect your physical infrastructure to your performance data.</p>

          {/* Step 1: Upload Floor Plan */}
          <div className="space-y-1 p-3 bg-white rounded-lg border border-border-light">
            <label className="block font-bold text-xs uppercase tracking-wide text-gray-600" htmlFor="imageUpload">
              1. Floor Plan (PNG/JPG)
            </label>
            <input
              id="imageUpload"
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleImageUpload}
              className="w-full text-xs p-1 mt-2 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20"
            />
            {floorPlanImage && (
              <div className="text-xs text-brand-teal font-medium flex items-center gap-1 pt-1">
                <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse"></span> Infrastructure Synced
              </div>
            )}
          </div>

          {/* Step 2: Upload Sales Data */}
          <div className="space-y-1 p-3 bg-white rounded-lg border border-border-light">
            <label className="block font-bold text-xs uppercase tracking-wide text-gray-600" htmlFor="excelUpload">
              2. Sales Intelligence (XLSX)
            </label>
            <input
              id="excelUpload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="w-full text-xs p-1 mt-2 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20 disabled:opacity-50"
              disabled={!floorPlanImage}
            />
            {!floorPlanImage && (
              <div className="text-[10px] text-gray-400">
                Awaiting floor plan synchronization...
              </div>
            )}
            {salesData && (
              <div className="text-xs text-brand-teal font-medium pt-1">
                ✓ Data Source Connected ({Object.keys(salesData).length} centers)
              </div>
            )}
          </div>

          {/* Step 3: Define Department Areas */}
          <div className="space-y-3 pt-2">
            <h3 className="font-heading font-bold text-sm">
              3. Map Profit Centers
            </h3>
            <button
              onClick={showDepartmentSelector}
              className="w-full primary-btn text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!floorPlanImage || mode === "draw"}
            >
              {mode === "draw"
                ? "Active Mapping Session..."
                : "Initialize Center Mapping"}
            </button>
            {!floorPlanImage && (
              <div className="text-[10px] text-brand-amber font-medium">
                Infrastructure sync required for mapping.
              </div>
            )}

            {/* Department Selector Popup/Inline */}
            {showDeptSelector && (
              <div className="mt-2 p-4 bg-white rounded-xl border-2 border-brand-teal shadow-lg space-y-3">
                <h4 className="font-heading font-bold text-sm text-brand-teal">
                  Select Profit Center
                </h4>
                {availableDepts.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-border-light rounded-lg p-2 bg-surface-gray">
                    <p className="text-[10px] uppercase font-bold text-gray-400 pb-2 tracking-widest">
                      Unmapped Intelligence:
                    </p>
                    {availableDepts.map((deptName, idx) => (
                      <button
                        key={idx}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-white hover:shadow-sm rounded transition-all tabular-nums"
                        onClick={() => createDepartment(deptName)}
                      >
                        <div className="font-medium text-brand-navy">{deptName}</div>
                        <div className="text-xs text-gray-500">
                          ${((salesData && salesData[deptName]) || 0).toLocaleString()} Value
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-gray-500 p-2">
                    {salesData
                      ? "All intelligence sources mapped."
                      : "Awaiting sales data upload."}
                  </p>
                )}
                {/* Manual Entry */}
                <div className="flex items-center space-x-2 pt-3 border-t border-border-light">
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="New center name"
                    className="flex-1 p-2 border border-border-light rounded-md text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all"
                  />
                  <button
                    onClick={() => createDepartment(newDeptName.trim())}
                    disabled={
                      !newDeptName.trim() ||
                      departments.some((d) => d.name === newDeptName.trim())
                    }
                    className="p-2 bg-brand-teal text-white rounded-md hover:bg-brand-teal-dark disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

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
          <div className="space-y-4 pt-4 border-t border-border-light">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={heatmapVisible}
                onChange={() => setHeatmapVisible(!heatmapVisible)}
                className="mr-3 h-5 w-5 rounded border-border-light text-brand-teal focus:ring-brand-teal/30"
                disabled={!salesData || maxSales <= 0}
              />
              <span className="text-sm font-heading font-bold text-brand-navy group-hover:text-brand-teal transition-colors">
                Performance Visualization
              </span>
            </label>
            {(!salesData || maxSales <= 0) && (
              <div className="text-[10px] text-gray-400 pl-8">
                Connect data source to enable visualization.
              </div>
            )}

            {/* Heatmap Advanced Options */}
            {heatmapVisible && salesData && maxSales > 0 && (
              <div className="space-y-4 mt-2 p-4 bg-white rounded-xl border border-border-light shadow-sm">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 block mb-2">
                    Diffusion Radius: {blurRadius}px
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(parseInt(e.target.value))}
                    className="w-full accent-brand-teal"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 block mb-2">
                    Data Intensity: {Math.round(heatmapOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={heatmapOpacity * 100}
                    onChange={(e) =>
                      setHeatmapOpacity(parseInt(e.target.value) / 100)
                    }
                    className="w-full accent-brand-teal"
                  />
                </div>
              </div>
            )}

            {/* Color Legend */}
            {salesData && maxSales > 0 && heatmapVisible && (
              <div className="pt-2">
                <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-3">Performance Legend</h4>
                <div
                  className="h-3 w-full rounded-full border border-border-light shadow-inner"
                  style={{
                    background:
                      "linear-gradient(to right, #F8FAFC, #0F766E, #D97706)",
                  }}
                ></div>
                <div className="flex justify-between text-[10px] mt-2 text-brand-navy font-bold tabular-nums px-0.5">
                  <span className="text-gray-400">Baseline</span>
                  <span className="text-brand-teal">Target</span>
                  <span className="text-brand-amber">Top Tier</span>
                </div>
                <div className="flex justify-between text-[11px] mt-1 text-gray-500 tabular-nums px-0.5">
                  <span>$0</span>
                  <span>${Math.round(maxSales / 2).toLocaleString()}</span>
                  <span>${maxSales.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Defined Departments List */}
          <div className="space-y-3 border-t border-border-light pt-6">
            <h3 className="font-heading font-bold text-sm text-brand-navy flex items-center justify-between">
              <span>Departmental Profit Centers</span>
              <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full font-mono">{departments.length}</span>
            </h3>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {departments.length === 0 ? (
                <div className="p-8 text-center bg-white/30 rounded-xl border border-dashed border-border-light">
                  <p className="text-xs italic text-gray-400">
                    No profit centers mapped to infrastructure.
                  </p>
                </div>
              ) : (
                departments.map((dept, index) => (
                  <div
                    key={dept.id}
                    className={
                      "group flex items-center justify-between p-3 rounded-xl border transition-all " +
                      (selectedDepartment === index && mode === "draw"
                        ? "bg-brand-amber/10 border-brand-amber shadow-sm"
                        : "bg-white border-border-light hover:border-brand-teal/50 hover:shadow-md")
                    }
                  >
                    <div className="flex-1 mr-3 min-w-0">
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-sm text-brand-navy truncate">{dept.name}</span>
                         {salesData && dept.sales !== undefined && (
                           <span className="text-[10px] font-bold text-brand-teal tabular-nums px-1.5 py-0.5 bg-brand-teal/5 rounded">
                             ${dept.sales.toLocaleString()}
                           </span>
                         )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-medium">
                        {dept.coords.length} Data Points
                        {dept.coords.length >= 3
                          ? ""
                          : dept.coords.length > 0
                            ? " • Incomplete Mapping"
                            : " • Awaiting Geometry"}
                      </div>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setSelectedDepartment(index);
                          setMode("draw");
                          setShowDeptSelector(false);
                        }}
                        className={
                          "p-2 rounded-lg transition-colors " +
                          (selectedDepartment === index && mode === "draw"
                            ? "bg-brand-amber text-white"
                            : "bg-brand-teal/10 text-brand-teal hover:bg-brand-teal hover:text-white")
                        }
                        disabled={mode === "draw"}
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              'Delete profit center "' +
                                dept.name +
                                '" mapping?',
                            )
                          )
                            deleteDepartment(index);
                        }}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors border border-red-100"
                        disabled={mode === "draw"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
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
          className="flex-1 relative bg-surface-gray overflow-auto"
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
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
                style={{
                  cursor:
                    mode === "draw"
                      ? "crosshair"
                      : isDragging
                        ? "grabbing"
                        : "grab",
                }}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center p-12 glass-card max-w-md">
                <div className="w-16 h-16 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto mb-6">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                </div>
                <h3 className="text-xl font-heading font-bold text-brand-navy mb-2">Awaiting Infrastructure</h3>
                <p className="text-sm">Upload a store floor plan to initialize the intelligence dashboard.</p>
              </div>
            </div>
          )}

          {/* Zoom Controls Overlay */}
          {floorPlanImage && (
            <div className="absolute bottom-6 right-6 p-1.5 glass-card flex items-center space-x-2">
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
                }
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-brand-teal/10 text-brand-teal rounded-lg font-bold transition-colors"
                title="Zoom In"
              >
                +
              </button>
              <span className="px-2 py-1 text-xs font-bold w-12 text-center tabular-nums text-brand-navy">
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
                }
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-brand-teal/10 text-brand-teal rounded-lg font-bold transition-colors"
                title="Zoom Out"
              >
                -
              </button>
              <div className="w-px h-4 bg-border-light mx-1"></div>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="px-3 py-1.5 bg-brand-teal text-white hover:bg-brand-teal-dark rounded-lg text-xs font-bold transition-colors"
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

export default PharmIQHeatMap;
