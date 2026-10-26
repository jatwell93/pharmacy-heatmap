import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  createEditorState,
  editorReducer,
} from "./editor-state.js";

const department = (id = "d1") => ({
  id,
  name: id,
  sales: 10,
  vertices: [
    { id: `${id}-v1`, x: 0, y: 0 },
    { id: `${id}-v2`, x: 10, y: 0 },
    { id: `${id}-v3`, x: 10, y: 10 },
  ],
});

function withDepartments(...items) {
  return items.reduce(
    (state, item) => editorReducer(state, { type: "ADD_DEPARTMENT", department: item }),
    createEditorState(),
  );
}

describe("editorReducer stable selection", () => {
  it("retains selection across reorder and chooses same-index then previous on delete", () => {
    let state = withDepartments(department());
    state = editorReducer(state, {
      type: "SELECT_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v2",
    });
    state = editorReducer(state, {
      type: "MOVE_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v2",
      direction: 1,
    });
    expect(state.selectedVertexByDepartment.d1).toBe("d1-v2");
    expect(state.departments[0].vertices.map((vertex) => vertex.id)).toEqual([
      "d1-v1",
      "d1-v3",
      "d1-v2",
    ]);
    state = editorReducer(state, {
      type: "DELETE_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v3",
    });
    expect(state.selectedVertexByDepartment.d1).toBe("d1-v2");
    state = editorReducer(state, {
      type: "DELETE_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v2",
    });
    expect(state.selectedVertexByDepartment.d1).toBe("d1-v1");
  });

  it("selects an inserted stable vertex after its anchor current position", () => {
    let state = withDepartments(department());
    state = editorReducer(state, {
      type: "START_INSERT",
      departmentId: "d1",
      anchorId: "d1-v1",
    });
    state = editorReducer(state, {
      type: "MOVE_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v1",
      direction: 1,
    });
    state = editorReducer(state, {
      type: "INSERT_VERTEX",
      departmentId: "d1",
      vertex: { id: "inserted", x: 5, y: 5 },
    });
    expect(state.departments[0].vertices.map((vertex) => vertex.id)).toEqual([
      "d1-v2",
      "d1-v1",
      "inserted",
      "d1-v3",
    ]);
    expect(state.selectedVertexByDepartment.d1).toBe("inserted");
    expect(state.draftsByDepartment.d1).toBeUndefined();
  });
});

describe("history and drafts", () => {
  it("caps independent department histories and undoes in LIFO order", () => {
    let state = withDepartments(department("d1"), department("d2"));
    for (let index = 1; index <= HISTORY_LIMIT + 3; index += 1) {
      state = editorReducer(state, {
        type: "EDIT_VERTEX",
        departmentId: "d1",
        vertexId: "d1-v1",
        x: index,
        y: 0,
      });
    }
    state = editorReducer(state, {
      type: "EDIT_VERTEX",
      departmentId: "d2",
      vertexId: "d2-v1",
      x: 99,
      y: 0,
    });
    expect(state.historyByDepartment.d1).toHaveLength(HISTORY_LIMIT);
    expect(state.historyByDepartment.d2).toHaveLength(1);
    state = editorReducer(state, { type: "UNDO", departmentId: "d1" });
    expect(state.departments[0].vertices[0].x).toBe(HISTORY_LIMIT + 2);
    expect(state.departments[1].vertices[0].x).toBe(99);
  });

  it("creates one history entry for one completed coordinate edit", () => {
    let state = withDepartments(department());
    state = editorReducer(state, {
      type: "EDIT_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v1",
      x: 4,
      y: 7,
    });
    expect(state.historyByDepartment.d1).toHaveLength(1);
    expect(state.departments[0].vertices[0]).toMatchObject({ x: 4, y: 7 });
  });

  it("atomically restores anchor, order, selection, draft, and warning", () => {
    let state = withDepartments({
      ...department(),
      vertices: [
        { id: "d1-v1", x: 0, y: 0 },
        { id: "d1-v2", x: 10, y: 10 },
        { id: "d1-v3", x: 0, y: 10 },
        { id: "d1-v4", x: 10, y: 0 },
      ],
    });
    state = editorReducer(state, {
      type: "SELECT_VERTEX",
      departmentId: "d1",
      vertexId: "d1-v2",
    });
    state = editorReducer(state, {
      type: "START_INSERT",
      departmentId: "d1",
      anchorId: "d1-v2",
    });
    state = editorReducer(state, {
      type: "UPDATE_DRAFT",
      departmentId: "d1",
      patch: { x: "3", y: "4", touchedX: true },
    });
    expect(state.warningByDepartment.d1).not.toBe("");
    state = editorReducer(state, {
      type: "DELETE_VERTEX_AND_DRAFT",
      departmentId: "d1",
      vertexId: "d1-v2",
    });
    expect(state.draftsByDepartment.d1).toBeUndefined();
    state = editorReducer(state, { type: "UNDO", departmentId: "d1" });
    expect(state.departments[0].vertices.map((vertex) => vertex.id)).toContain("d1-v2");
    expect(state.selectedVertexByDepartment.d1).toBe("d1-v2");
    expect(state.draftsByDepartment.d1).toMatchObject({ anchorId: "d1-v2", x: "3", y: "4" });
    expect(state.warningByDepartment.d1).not.toBe("");
  });

  it("cleans only the deleted department and resets all editor state", () => {
    let state = withDepartments(department("d1"), department("d2"));
    state = editorReducer(state, {
      type: "START_INSERT",
      departmentId: "d1",
      anchorId: "d1-v1",
    });
    state = editorReducer(state, {
      type: "START_INSERT",
      departmentId: "d2",
      anchorId: "d2-v1",
    });
    state = editorReducer(state, { type: "DELETE_DEPARTMENT", departmentId: "d1" });
    expect(state.departments.map((item) => item.id)).toEqual(["d2"]);
    expect(state.draftsByDepartment.d1).toBeUndefined();
    expect(state.draftsByDepartment.d2).toBeDefined();
    expect(editorReducer(state, { type: "RESET" })).toEqual(createEditorState());
  });
});
