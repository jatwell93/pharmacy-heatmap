import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

const gradient = { addColorStop: vi.fn() };
const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  closePath: vi.fn(),
  createImageData: vi.fn((width, height) => ({ data: new Uint8ClampedArray(width * height * 4) })),
  createRadialGradient: vi.fn(() => gradient),
  drawImage: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  getImageData: vi.fn((x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) })),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  putImageData: vi.fn(),
  rect: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setLineDash: vi.fn(),
  stroke: vi.fn(),
  strokeText: vi.fn(),
  translate: vi.fn(),
};

class MockImage {
  complete = true;
  naturalWidth = 800;
  naturalHeight = 600;
  width = 800;
  height = 600;
  set src(value) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() { return this._src; }
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal("Image", MockImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {},
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 900,
    height: 700,
    right: 900,
    bottom: 700,
    x: 0,
    y: 0,
    toJSON() {},
  });
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => true);
});

async function uploadFloorPlan(user) {
  const file = new File(["fixture"], "plan.png", { type: "image/png" });
  await user.upload(screen.getByLabelText("Floor plan (PNG or JPEG)"), file);
  await screen.findByText(/Floor plan ready: 800 × 600 pixels/);
}

async function createDepartment(user) {
  await user.click(screen.getByRole("button", { name: "Add profit center" }));
  await user.type(screen.getByLabelText("New profit center name"), "Dispensary");
  await user.click(screen.getByRole("button", { name: "Add", exact: true }));
}

function pointer(canvas, type, { pointerId = 1, clientX, clientY }) {
  fireEvent[type](canvas, { pointerId, clientX, clientY, pointerType: "mouse", isPrimary: true });
}

async function appendPoint(canvas, x, y, pointerId) {
  pointer(canvas, "pointerDown", { pointerId, clientX: x, clientY: y });
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(pointerId);
  pointer(canvas, "pointerUp", { pointerId, clientX: x, clientY: y });
  await waitFor(() => expect(screen.getByText(new RegExp(`^Dispensary: ${pointerId} committed`))).toBeInTheDocument());
}

describe("App canvas and coordinate integration", () => {
  it("commits transformed pointer points as integers and synchronizes canvas selection to radios without focus theft", async () => {
    const user = userEvent.setup();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    render(<App />);
    await uploadFloorPlan(user);
    await createDepartment(user);
    const canvas = screen.getByLabelText(/Draw floor plan/);

    await appendPoint(canvas, 100.4, 100.4, 1);
    await appendPoint(canvas, 300.4, 100.4, 2);
    await appendPoint(canvas, 300.4, 300.4, 3);

    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    expect(screen.getByRole("radio", { name: "Vertex 3: (300, 300)" })).toBeChecked();
    const focusTarget = screen.getByRole("button", { name: "Move up" });
    focusTarget.focus();
    pointer(canvas, "pointerDown", { pointerId: 9, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerUp", { pointerId: 9, clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Vertex 1: (100, 100)" })).toBeChecked());
    expect(focusTarget).toHaveFocus();
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" }));
    expect(screen.getByText("Selected vertex 1 in Dispensary.")).toBeInTheDocument();
  });

  it("keeps radio selection from changing zoom and highlights through the shared selected ID", async () => {
    const user = userEvent.setup();
    render(<App />);
    await uploadFloorPlan(user);
    await createDepartment(user);
    const canvas = screen.getByLabelText(/Draw floor plan/);
    await appendPoint(canvas, 80, 80, 1);
    await appendPoint(canvas, 260, 80, 2);
    await user.click(screen.getByText("Dispensary: 2 committed vertices"));
    expect(screen.getByLabelText("Current zoom")).toHaveTextContent("100%");
    await user.click(screen.getByRole("radio", { name: "Vertex 1: (80, 80)" }));
    expect(screen.getByLabelText("Current zoom")).toHaveTextContent("100%");
    expect(context.rect).toHaveBeenCalled();
  });

  it("does not commit a moved, cancelled, lost, or mismatched pointer session", async () => {
    const user = userEvent.setup();
    render(<App />);
    await uploadFloorPlan(user);
    await createDepartment(user);
    const canvas = screen.getByLabelText(/Draw floor plan/);

    pointer(canvas, "pointerDown", { pointerId: 1, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerMove", { pointerId: 1, clientX: 120, clientY: 100 });
    pointer(canvas, "pointerUp", { pointerId: 1, clientX: 120, clientY: 100 });
    expect(screen.getByText("Dispensary: 0 committed vertices")).toBeInTheDocument();

    pointer(canvas, "pointerDown", { pointerId: 2, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerCancel", { pointerId: 2, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerUp", { pointerId: 2, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerDown", { pointerId: 3, clientX: 100, clientY: 100 });
    pointer(canvas, "lostPointerCapture", { pointerId: 3, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerUp", { pointerId: 3, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerDown", { pointerId: 4, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerUp", { pointerId: 5, clientX: 100, clientY: 100 });
    expect(screen.getByText("Dispensary: 0 committed vertices")).toBeInTheDocument();
  });

  it("pans in view mode before any department exists", async () => {
    const user = userEvent.setup();
    render(<App />);
    await uploadFloorPlan(user);
    const canvas = screen.getByLabelText(/View floor plan/);
    pointer(canvas, "pointerDown", { pointerId: 41, clientX: 100, clientY: 100 });
    pointer(canvas, "pointerMove", { pointerId: 41, clientX: 120, clientY: 115 });
    pointer(canvas, "pointerUp", { pointerId: 41, clientX: 120, clientY: 115 });
    await waitFor(() => expect(context.translate).toHaveBeenCalledWith(20, 15));
  });

  it("preserves the prior floor plan after an unsupported image upload", async () => {
    const user = userEvent.setup();
    render(<App />);
    await uploadFloorPlan(user);
    const input = screen.getByLabelText("Floor plan (PNG or JPEG)");
    fireEvent.change(input, { target: { files: [new File(["bad"], "bad.gif", { type: "image/gif" })] } });
    expect(await screen.findByText(/Choose a PNG or JPEG floor plan/)).toBeInTheDocument();
    expect(screen.getByLabelText(/View floor plan/)).toBeInTheDocument();
  });

  it("invalidates pending workbook reads when a replacement floor plan starts", async () => {
    const user = userEvent.setup();
    const workbookReads = [];
    class ControlledFileReader {
      readAsDataURL() {
        this.result = "data:image/png;base64,fixture";
        queueMicrotask(() => this.onload?.());
      }

      readAsArrayBuffer() {
        workbookReads.push(this);
      }
    }
    vi.stubGlobal("FileReader", ControlledFileReader);
    render(<App />);

    const imageInput = screen.getByLabelText("Floor plan (PNG or JPEG)");
    await user.upload(imageInput, new File(["first"], "first.png", { type: "image/png" }));
    await screen.findByText(/Floor plan ready: 800 × 600 pixels/);

    const workbookInput = screen.getByLabelText(/^Sales intelligence \(XLSX\)/);
    const workbookBytes = Uint8Array.from(readFileSync("tests/fixtures/sales-valid.xlsx")).buffer;
    await user.upload(workbookInput, new File([workbookBytes], "pending.xlsx"));
    expect(screen.getByText("Reading pending.xlsx…")).toBeInTheDocument();

    await user.upload(imageInput, new File(["replacement"], "replacement.png", { type: "image/png" }));
    await screen.findByText(/Previous mapping was cleared/);
    workbookReads[0].result = workbookBytes;
    workbookReads[0].onload?.();
    await waitFor(() => expect(screen.queryByText(/Sales data ready/)).not.toBeInTheDocument());
    expect(screen.getByText(/Previous mapping was cleared/)).toBeInTheDocument();

    await user.upload(workbookInput, new File([workbookBytes], "current.xlsx"));
    workbookReads[1].result = workbookBytes;
    workbookReads[1].onload?.();
    await screen.findByText("Sales data ready for 3 departments.");

    await user.upload(imageInput, new File(["newest"], "newest.png", { type: "image/png" }));
    await screen.findByText(/Previous mapping was cleared/);
    await user.click(screen.getByRole("button", { name: "Add profit center" }));
    expect(screen.queryByRole("button", { name: /Dispensary.*\$125,000/ })).not.toBeInTheDocument();
  });

  it("associates valid fixture sales and preserves them after malformed workbook input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await uploadFloorPlan(user);
    const workbookInput = screen.getByLabelText(/^Sales intelligence \(XLSX\)/);
    const valid = new File(
      [readFileSync("tests/fixtures/sales-valid.xlsx")],
      "sales-valid.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    );
    await user.upload(workbookInput, valid);
    expect(await screen.findByText("Sales data ready for 3 departments.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add profit center" }));
    expect(screen.getByRole("button", { name: /Dispensary.*\$125,000/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Dispensary.*\$125,000/ }));
    expect(screen.getByText("0 vertices · $125,000")).toBeInTheDocument();

    const malformed = new File(
      [readFileSync("tests/fixtures/sales-invalid.xlsx")],
      "sales-invalid.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    );
    await user.upload(workbookInput, malformed);
    expect(await screen.findByText(/Existing sales data was kept/)).toBeInTheDocument();
    expect(screen.getByText("0 vertices · $125,000")).toBeInTheDocument();
  });
});
