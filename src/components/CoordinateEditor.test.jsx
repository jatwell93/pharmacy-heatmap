import { useReducer, useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoordinateEditor from "./CoordinateEditor.jsx";
import { createEditorState, editorReducer } from "../mapping/editor-state.js";

const department = {
  id: "d1",
  name: "Dispensary",
  sales: 100,
  vertices: [
    { id: "v1", x: 10, y: 20 },
    { id: "v2", x: 30, y: 40 },
    { id: "v3", x: 50, y: 60 },
  ],
};

function initialState() {
  return editorReducer(createEditorState(), { type: "ADD_DEPARTMENT", department });
}

const secondDepartment = {
  id: "d2",
  name: "Front Shop",
  sales: 50,
  vertices: [
    { id: "w1", x: 5, y: 5 },
    { id: "w2", x: 15, y: 15 },
  ],
};

function twoDepartmentState() {
  let state = initialState();
  state = editorReducer(state, { type: "ADD_DEPARTMENT", department: secondDepartment });
  return editorReducer(state, { type: "SET_ACTIVE_DEPARTMENT", departmentId: "d1" });
}

function Harness({ revealVertexId = null, onFinish = vi.fn(), multiple = false }) {
  const [state, dispatch] = useReducer(editorReducer, undefined, multiple ? twoDepartmentState : initialState);
  const [finishDecision, setFinishDecision] = useState(false);
  const current = state.departments.find((item) => item.id === state.activeDepartmentId) ?? null;
  return (
    <>
      <CoordinateEditor
        department={current}
        state={state}
        dispatch={dispatch}
        imageWidth={100}
        imageHeight={100}
        revealVertexId={revealVertexId}
        onFinish={onFinish}
        finishDecision={finishDecision}
        setFinishDecision={setFinishDecision}
      />
      {multiple && (
        <div>
          <button type="button" onClick={() => dispatch({ type: "SET_ACTIVE_DEPARTMENT", departmentId: "d1" })}>Show Dispensary</button>
          <button type="button" onClick={() => dispatch({ type: "SET_ACTIVE_DEPARTMENT", departmentId: "d2" })}>Show Front Shop</button>
        </div>
      )}
      <button type="button" onClick={() => setFinishDecision(true)}>Open finish decision</button>
      <output data-testid="state">{JSON.stringify(state)}</output>
    </>
  );
}

const readState = () => JSON.parse(screen.getByTestId("state").textContent);

describe("CoordinateEditor", () => {
  it("uses one native named radio group with current-order coordinate labels", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    const group = screen.getByRole("group", { name: "Dispensary boundary vertices" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => radio.name === "vertices-d1")).toBe(true);
    expect(screen.getByRole("radio", { name: "Vertex 1: (10, 20)" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Vertex 2: (30, 40)" }));
    expect(screen.getByRole("radio", { name: "Vertex 2: (30, 40)" })).toBeChecked();
  });

  it("keeps radio selection independent from field focus and commits valid paired edits once", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    const firstRow = screen.getByRole("radio", { name: "Vertex 1: (10, 20)" }).closest("li");
    const [x, y] = within(firstRow).getAllByRole("textbox");
    await user.click(x);
    expect(screen.getByRole("radio", { name: "Vertex 1: (10, 20)" })).toBeChecked();
    await user.clear(x);
    await user.type(x, "11");
    await user.clear(y);
    await user.type(y, "22");
    await user.tab();
    expect(readState().departments[0].vertices[0]).toMatchObject({ x: 11, y: 22 });
    expect(readState().historyByDepartment.d1).toHaveLength(1);
  });

  it("preserves committed geometry and reports decimal or out-of-bounds edits", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    const firstRow = screen.getByRole("radio", { name: "Vertex 1: (10, 20)" }).closest("li");
    const [x] = within(firstRow).getAllByRole("textbox");
    await user.clear(x);
    await user.type(x, "10.5");
    await user.tab();
    expect(within(firstRow).getByRole("alert")).toHaveTextContent("whole pixels");
    expect(readState().departments[0].vertices[0].x).toBe(10);
  });

  it("inserts after a stable anchor, focuses X, and selects the new row", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    await user.click(screen.getByRole("button", { name: "Insert after" }));
    const group = screen.getByRole("group", { name: "Insert after vertex 1" });
    const [x, y] = within(group).getAllByRole("textbox");
    expect(x).toHaveFocus();
    await user.type(x, "15");
    await user.type(y, "25");
    await user.click(within(group).getByRole("button", { name: "Confirm insertion" }));
    const state = readState();
    expect(state.departments[0].vertices[1]).toMatchObject({ x: 15, y: 25 });
    expect(state.selectedVertexByDepartment.d1).toBe(state.departments[0].vertices[1].id);
  });

  it("keeps a draft attached to its stable anchor when that anchor is reordered", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    await user.click(screen.getByRole("button", { name: "Insert after" }));
    const group = screen.getByRole("group", { name: "Insert after vertex 1" });
    await user.type(within(group).getAllByRole("textbox")[0], "15");
    await user.type(within(group).getAllByRole("textbox")[1], "25");

    const moveDown = screen.getByRole("button", { name: "Move down" });
    expect(moveDown).toBeEnabled();
    await user.click(moveDown);
    expect(readState().draftsByDepartment.d1.anchorId).toBe("v1");
    expect(screen.getByRole("group", { name: "Insert after vertex 2" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Confirm insertion" }));
    expect(readState().departments[0].vertices.map((vertex) => vertex.id)).toEqual([
      "v2",
      "v1",
      expect.stringMatching(/^vertex-/),
      "v3",
    ]);
  });

  it("disables and explains Undo while a draft is open without consuming history", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    await user.click(screen.getByRole("button", { name: "Move down" }));
    expect(readState().historyByDepartment.d1).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Insert after" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByText(/Undo is available after/)).toBeVisible();
    expect(readState().historyByDepartment.d1).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(readState().historyByDepartment.d1).toHaveLength(0);
  });

  it("confirms anchor deletion inline and restores its complete draft with Undo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    await user.click(screen.getByRole("button", { name: "Insert after" }));
    const group = screen.getByRole("group", { name: "Insert after vertex 1" });
    await user.type(within(group).getAllByRole("textbox")[0], "12");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirmation = screen.getByRole("group", { name: "Delete draft anchor" });
    expect(confirmation).toBeVisible();
    expect(within(confirmation).getByRole("button", { name: "Undo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Delete vertex and draft" }));
    expect(readState().departments[0].vertices.map((vertex) => vertex.id)).not.toContain("v1");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(readState().departments[0].vertices.map((vertex) => vertex.id)).toContain("v1");
    expect(readState().draftsByDepartment.d1).toMatchObject({ anchorId: "v1", x: "12" });
  });

  it("clears an anchor-deletion confirmation when the active department changes", async () => {
    const user = userEvent.setup();
    render(<Harness multiple />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    await user.click(screen.getByRole("button", { name: "Insert after" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("group", { name: "Delete draft anchor" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show Front Shop" }));
    expect(screen.queryByRole("group", { name: "Delete draft anchor" })).not.toBeInTheDocument();
    expect(screen.getByText("Front Shop: 2 committed vertices")).toBeInTheDocument();
    expect(readState().departments.find((item) => item.id === "d2").vertices).toHaveLength(2);
  });

  it("resolves anchor deletion before opening the finish decision", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Dispensary: 3 committed vertices"));
    await user.click(screen.getByRole("button", { name: "Insert after" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("group", { name: "Delete draft anchor" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open finish decision" }));
    expect(screen.queryByRole("group", { name: "Delete draft anchor" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Finish area with unfinished insertion" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("opens and minimally reveals a canvas-selected row without moving focus", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    render(<Harness revealVertexId="v2" />);
    expect(screen.getByText("Dispensary: 3 committed vertices").closest("details")).toHaveAttribute("open");
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(document.body).toHaveFocus();
    scroll.mockRestore();
  });
});
