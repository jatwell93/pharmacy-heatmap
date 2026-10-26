export const POINTER_MOVE_THRESHOLD = 6;

export function beginPointerSession(event, hitVertexId = null) {
  return {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
    hitVertexId,
  };
}

export function updatePointerSession(session, event, threshold = POINTER_MOVE_THRESHOLD) {
  if (!session || event.pointerId !== session.pointerId) return session;
  return {
    ...session,
    lastX: event.clientX,
    lastY: event.clientY,
    moved:
      session.moved ||
      Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > threshold,
  };
}

export function pointerDelta(session, event) {
  if (!session || event.pointerId !== session.pointerId) return { x: 0, y: 0 };
  return { x: event.clientX - session.lastX, y: event.clientY - session.lastY };
}

export function completePointerSession(session, event, mode) {
  if (!session || event.pointerId !== session.pointerId) return { outcome: "ignore" };
  const completed = updatePointerSession(session, event);
  if (completed.moved) return { outcome: mode === "view" ? "pan" : "none" };
  if (completed.hitVertexId) return { outcome: "select", vertexId: completed.hitVertexId };
  return { outcome: mode === "draw" ? "append" : "none" };
}
