import { describe, expect, it } from "vitest";
import {
  beginPointerSession,
  completePointerSession,
  pointerDelta,
  updatePointerSession,
} from "./canvas-interaction.js";

const event = (pointerId, clientX, clientY) => ({ pointerId, clientX, clientY });

describe("canvas pointer sessions", () => {
  it("selects a hit vertex on a short gesture", () => {
    const session = beginPointerSession(event(1, 10, 10), "v1");
    expect(completePointerSession(session, event(1, 14, 13), "draw")).toEqual({
      outcome: "select",
      vertexId: "v1",
    });
  });

  it("appends only a short empty draw gesture", () => {
    const session = beginPointerSession(event(1, 10, 10));
    expect(completePointerSession(session, event(1, 15, 10), "draw")).toEqual({ outcome: "append" });
    expect(completePointerSession(session, event(1, 17, 10), "draw")).toEqual({ outcome: "none" });
  });

  it("arbitrates a view drag as pan after six CSS pixels", () => {
    const session = beginPointerSession(event(4, 5, 5), "v1");
    const moved = updatePointerSession(session, event(4, 12, 5));
    expect(moved.moved).toBe(true);
    expect(pointerDelta(session, event(4, 12, 9))).toEqual({ x: 7, y: 4 });
    expect(completePointerSession(moved, event(4, 12, 5), "view")).toEqual({ outcome: "pan" });
  });

  it("ignores mismatched and stale pointers", () => {
    const session = beginPointerSession(event(1, 0, 0), "v1");
    expect(updatePointerSession(session, event(2, 20, 20))).toBe(session);
    expect(completePointerSession(session, event(2, 0, 0), "draw")).toEqual({ outcome: "ignore" });
    expect(pointerDelta(session, event(2, 5, 5))).toEqual({ x: 0, y: 0 });
  });
});
