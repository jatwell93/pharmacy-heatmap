# pharmacy-heatmap

A lightweight web application to create a heatmap visualization of sales activity across a floor plan. Users upload their sales data (normalised by bay count or square footage) and a floor plan image to generate an interactive heatmap overlay on the plan.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Data Formats](#data-formats)
- [Usage & Workflow](#usage--workflow)
- [Configuration & Customization](#configuration--customization)
- [Project Structure](#project-structure)
- [Accessibility & UX](#accessibility--ux)
- [Development & Testing](#development--testing)
- [Contributing](#contributing)
- [License & Acknowledgments](#license--acknowledgments)

---

## Overview

pharmacy-heatmap provides a client-side solution to visualise spatial sales data on a floor plan. The app:
- Accepts a XLSX of per-bay sales data
- Accepts a floor plan image (PNG/JPG/SVG)
- Normalizes sales using either bay count or floor area (square feet/meters)
- Renders a colour-coded heatmap overlay on the floor plan
- Includes a legend and interactive tooltips for detailed values
- Runs in a modern Vite-based frontend environment

---

## Features

- Upload two inputs: a sales data file (XLSX) and a floor plan image; sales should be normalised by bay count or area
- Overlay heatmap on the floor plan with a selectable color scale
- Intuitive legend, tooltip hover, and data details per bay
- Lightweight, fast, and runs entirely in the browser (no backend required)

---

## Getting Started

Prerequisites:
- Node.js (>= 14 or >= 16 LTS; ensure npm or yarn is available)
- A modern browser (Chrome, Edge, Firefox, Safari)

Install and run locally:
1. Clone or download the repository.
2. Open a terminal in the project root.
3. Install dependencies:
   - npm install
   - or yarn install
4. Start the development server:
   - npm run dev
   - or yarn dev
5. Open the app in your browser at:
   - http://localhost:5173

Build for production:
- npm run build
- npm run preview (or serve the built assets with your static server)

---

## Data Formats

To ensure smooth operation, prepare your inputs as follows:

1) Sales data (XLSX)
- Purpose: per-bay sales values
- Required columns (minimum):
  - DEPARTMENT: a unique identifier for each department in the floor plan
  - SALES: numeric sales figure for the bay


2) Floor plan (image)
- Supported formats: PNG, JPG, SVG
- Resolution: aim for a clear plan with distinguishable bay regions
- Note: The app overlays heat values onto the image using coordinates


Normalization options:
- Normalize by bay_count
- Normalize by area
- No normalization (raw values)

If you provide both area and bay_count, you can choose which normalization to apply via the UI configuration.

---

## Usage & Workflow

1) Prepare data
- Create sales.xlsx departments and sales normalised for space, either divide by area or bay_count.
  - These reports can usually be downloaded via your back office system e.g. FRED Office

2) Load inputs
- Open the app and upload:
  - Floor plan image
  - Sales data xlsx

3) Visualise
- The heatmap overlays onto the floor plan
- Click to add your coordinates for each bay
- Use the legend to interpret colour intensities

## Contributing

- Fork the repository and create a feature branch.
- Ensure you run the project locally and add or adjust tests where appropriate.
- Follow the project’s coding standards and write clear commit messages.
- Open a pull request with a descriptive title and summary of changes.

---

## License

- License: MIT

---
