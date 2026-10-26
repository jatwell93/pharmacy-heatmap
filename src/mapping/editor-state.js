import { polygonSelfIntersects } from "./geometry.js";

export const HISTORY_LIMIT = 20;

let fallbackId = 0;
export function createStableId(prefix = "vertex") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  fallbackId += 1;
  return `${prefix}-${Date.now()}-${fallbackId}`;
}

export function createEditorState() {
  return {
    departments: [],
    activeDepartmentId: null,
    selectedVertexByDepartment: {},
    draftsByDepartment: {},
    historyByDepartment: {},
    warningByDepartment: {},
  };
}

export function getActiveDepartment(state) {
  return state.departments.find((department) => department.id === state.activeDepartmentId) ?? null;
}

export function getSelectedVertexId(state, departmentId) {
  return state.selectedVertexByDepartment[departmentId] ?? null;
}

function deriveWarning(vertices) {
  return polygonSelfIntersects(vertices)
    ? "This boundary crosses itself. You can still finish the area."
    : "";
}

function selectedForVertices(vertices, preferredId, fallbackIndex = 0) {
  if (!vertices.length) return null;
  if (preferredId && vertices.some((vertex) => vertex.id === preferredId)) return preferredId;
  return vertices[Math.min(Math.max(fallbackIndex, 0), vertices.length - 1)].id;
}

function snapshot(state, departmentId) {
  const department = state.departments.find((item) => item.id === departmentId);
  if (!department) return null;
  return {
    vertices: department.vertices.map((vertex) => ({ ...vertex })),
    selectedVertexId: state.selectedVertexByDepartment[departmentId] ?? null,
    draft: state.draftsByDepartment[departmentId]
      ? { ...state.draftsByDepartment[departmentId] }
      : null,
    warning: state.warningByDepartment[departmentId] ?? "",
  };
}

function mutateDepartment(state, departmentId, mutation, { history = true } = {}) {
  const index = state.departments.findIndex((department) => department.id === departmentId);
  if (index < 0) return state;
  const before = snapshot(state, departmentId);
  const current = state.departments[index];
  const result = mutation(current, before);
  if (!result) return state;

  const departments = [...state.departments];
  departments[index] = { ...current, vertices: result.vertices };
  const next = {
    ...state,
    departments,
    selectedVertexByDepartment: {
      ...state.selectedVertexByDepartment,
      [departmentId]: selectedForVertices(
        result.vertices,
        result.selectedVertexId,
        result.fallbackIndex,
      ),
    },
    warningByDepartment: {
      ...state.warningByDepartment,
      [departmentId]: deriveWarning(result.vertices),
    },
  };

  if (Object.hasOwn(result, "draft")) {
    next.draftsByDepartment = { ...state.draftsByDepartment };
    if (result.draft) next.draftsByDepartment[departmentId] = result.draft;
    else delete next.draftsByDepartment[departmentId];
  }
  if (history && before) {
    const previous = state.historyByDepartment[departmentId] ?? [];
    next.historyByDepartment = {
      ...state.historyByDepartment,
      [departmentId]: [...previous, before].slice(-HISTORY_LIMIT),
    };
  }
  return next;
}

export function editorReducer(state, action) {
  switch (action.type) {
    case "ADD_DEPARTMENT": {
      if (state.departments.some((department) => department.id === action.department.id)) return state;
      const department = { ...action.department, vertices: action.department.vertices ?? [] };
      return {
        ...state,
        departments: [...state.departments, department],
        activeDepartmentId: department.id,
        selectedVertexByDepartment: {
          ...state.selectedVertexByDepartment,
          [department.id]: department.vertices[0]?.id ?? null,
        },
        warningByDepartment: {
          ...state.warningByDepartment,
          [department.id]: deriveWarning(department.vertices),
        },
      };
    }
    case "SET_ACTIVE_DEPARTMENT": {
      if (action.departmentId !== null && !state.departments.some((item) => item.id === action.departmentId)) {
        return state;
      }
      const next = { ...state, activeDepartmentId: action.departmentId };
      if (action.departmentId) {
        const department = state.departments.find((item) => item.id === action.departmentId);
        next.selectedVertexByDepartment = {
          ...state.selectedVertexByDepartment,
          [action.departmentId]: selectedForVertices(
            department.vertices,
            state.selectedVertexByDepartment[action.departmentId],
          ),
        };
      }
      return next;
    }
    case "SELECT_VERTEX": {
      const department = state.departments.find((item) => item.id === action.departmentId);
      if (!department?.vertices.some((vertex) => vertex.id === action.vertexId)) return state;
      return {
        ...state,
        activeDepartmentId: action.departmentId,
        selectedVertexByDepartment: {
          ...state.selectedVertexByDepartment,
          [action.departmentId]: action.vertexId,
        },
      };
    }
    case "APPEND_VERTEX":
      return mutateDepartment(state, action.departmentId, (department) => {
        const vertex = action.vertex.id ? action.vertex : { ...action.vertex, id: createStableId() };
        return {
          vertices: [...department.vertices, vertex],
          selectedVertexId: vertex.id,
        };
      });
    case "EDIT_VERTEX":
      return mutateDepartment(state, action.departmentId, (department) => {
        const index = department.vertices.findIndex((vertex) => vertex.id === action.vertexId);
        if (index < 0) return null;
        const current = department.vertices[index];
        if (current.x === action.x && current.y === action.y) return null;
        const vertices = [...department.vertices];
        vertices[index] = { ...current, x: action.x, y: action.y };
        return { vertices, selectedVertexId: action.vertexId };
      });
    case "MOVE_VERTEX":
      return mutateDepartment(state, action.departmentId, (department) => {
        const index = department.vertices.findIndex((vertex) => vertex.id === action.vertexId);
        const destination = index + action.direction;
        if (index < 0 || destination < 0 || destination >= department.vertices.length) return null;
        const vertices = [...department.vertices];
        [vertices[index], vertices[destination]] = [vertices[destination], vertices[index]];
        return { vertices, selectedVertexId: action.vertexId };
      });
    case "DELETE_VERTEX":
      return mutateDepartment(state, action.departmentId, (department) => {
        const index = department.vertices.findIndex((vertex) => vertex.id === action.vertexId);
        if (index < 0) return null;
        const vertices = department.vertices.filter((vertex) => vertex.id !== action.vertexId);
        return {
          vertices,
          selectedVertexId: vertices[index]?.id ?? vertices[index - 1]?.id ?? null,
          fallbackIndex: Math.min(index, vertices.length - 1),
        };
      });
    case "DELETE_VERTEX_AND_DRAFT":
      return mutateDepartment(state, action.departmentId, (department) => {
        const index = department.vertices.findIndex((vertex) => vertex.id === action.vertexId);
        if (index < 0) return null;
        const vertices = department.vertices.filter((vertex) => vertex.id !== action.vertexId);
        return {
          vertices,
          selectedVertexId: vertices[index]?.id ?? vertices[index - 1]?.id ?? null,
          fallbackIndex: Math.min(index, vertices.length - 1),
          draft: null,
        };
      });
    case "CLEAR_VERTICES":
      return mutateDepartment(state, action.departmentId, () => ({ vertices: [], selectedVertexId: null }));
    case "START_INSERT": {
      const department = state.departments.find((item) => item.id === action.departmentId);
      if (!department?.vertices.some((vertex) => vertex.id === action.anchorId)) return state;
      return {
        ...state,
        draftsByDepartment: {
          ...state.draftsByDepartment,
          [action.departmentId]: {
            anchorId: action.anchorId,
            x: "",
            y: "",
            touchedX: false,
            touchedY: false,
          },
        },
      };
    }
    case "UPDATE_DRAFT": {
      const draft = state.draftsByDepartment[action.departmentId];
      if (!draft) return state;
      return {
        ...state,
        draftsByDepartment: {
          ...state.draftsByDepartment,
          [action.departmentId]: { ...draft, ...action.patch },
        },
      };
    }
    case "CANCEL_DRAFT": {
      if (!state.draftsByDepartment[action.departmentId]) return state;
      const draftsByDepartment = { ...state.draftsByDepartment };
      delete draftsByDepartment[action.departmentId];
      return { ...state, draftsByDepartment };
    }
    case "INSERT_VERTEX":
      return mutateDepartment(state, action.departmentId, (department) => {
        const draft = state.draftsByDepartment[action.departmentId];
        const anchorId = action.anchorId ?? draft?.anchorId;
        const index = department.vertices.findIndex((vertex) => vertex.id === anchorId);
        if (index < 0) return null;
        const vertex = action.vertex.id ? action.vertex : { ...action.vertex, id: createStableId() };
        const vertices = [...department.vertices];
        vertices.splice(index + 1, 0, vertex);
        return { vertices, selectedVertexId: vertex.id, draft: null };
      });
    case "UNDO": {
      const history = state.historyByDepartment[action.departmentId] ?? [];
      const restored = history.at(-1);
      if (!restored) return state;
      const index = state.departments.findIndex((department) => department.id === action.departmentId);
      if (index < 0) return state;
      const departments = [...state.departments];
      departments[index] = { ...departments[index], vertices: restored.vertices.map((vertex) => ({ ...vertex })) };
      const draftsByDepartment = { ...state.draftsByDepartment };
      if (restored.draft) draftsByDepartment[action.departmentId] = { ...restored.draft };
      else delete draftsByDepartment[action.departmentId];
      return {
        ...state,
        departments,
        draftsByDepartment,
        selectedVertexByDepartment: {
          ...state.selectedVertexByDepartment,
          [action.departmentId]: selectedForVertices(restored.vertices, restored.selectedVertexId),
        },
        warningByDepartment: {
          ...state.warningByDepartment,
          [action.departmentId]: restored.warning,
        },
        historyByDepartment: {
          ...state.historyByDepartment,
          [action.departmentId]: history.slice(0, -1),
        },
      };
    }
    case "DELETE_DEPARTMENT": {
      if (!state.departments.some((department) => department.id === action.departmentId)) return state;
      const without = (record) => {
        const result = { ...record };
        delete result[action.departmentId];
        return result;
      };
      return {
        ...state,
        departments: state.departments.filter((department) => department.id !== action.departmentId),
        activeDepartmentId: state.activeDepartmentId === action.departmentId ? null : state.activeDepartmentId,
        selectedVertexByDepartment: without(state.selectedVertexByDepartment),
        draftsByDepartment: without(state.draftsByDepartment),
        historyByDepartment: without(state.historyByDepartment),
        warningByDepartment: without(state.warningByDepartment),
      };
    }
    case "UPDATE_SALES":
      return {
        ...state,
        departments: state.departments.map((department) => ({
          ...department,
          sales: action.salesByName[department.name] ?? 0,
        })),
      };
    case "RESET":
      return createEditorState();
    default:
      return state;
  }
}
