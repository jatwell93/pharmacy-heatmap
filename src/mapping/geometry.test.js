import { describe, expect, it } from "vitest";
import {
  clientToIntrinsicPoint,
  hitTestVertex,
  polygonSelfIntersects,
  validatePixelInput,
} from "./geometry.js";

const rect = { left: 100, top: 50, width: 400, height: 300 };

describe("whole-pixel geometry", () => {
  it("inverts display scale, pan, and zoom before rounding", () => {
    expect(
      clientToIntrinsicPoint({
        clientX: 250.4,
        clientY: 151.1,
        rect,
        canvasWidth: 800,
        canvasHeight: 600,
        imageWidth: 800,
        imageHeight: 600,
        pan: { x: 20, y: -10 },
        zoom: 1.5,
      }),
    ).toEqual({ x: 187, y: 141 });
  });

  it("rejects transformed points outside intrinsic bounds", () => {
    expect(
      clientToIntrinsicPoint({
        clientX: 90,
        clientY: 40,
        rect,
        canvasWidth: 800,
        canvasHeight: 600,
        imageWidth: 800,
        imageHeight: 600,
        pan: { x: 0, y: 0 },
        zoom: 1,
      }),
    ).toBeNull();
  });

  it.each(["", " ", "1.2", "abc", "Infinity", "-1", "11"])(
    "rejects invalid pixel input %j",
    (raw) => expect(validatePixelInput(raw, 10).valid).toBe(false),
  );

  it("accepts both intrinsic bounds as whole pixels", () => {
    expect(validatePixelInput("0", 10)).toMatchObject({ valid: true, value: 0 });
    expect(validatePixelInput("10", 10)).toMatchObject({ valid: true, value: 10 });
  });

  it("keeps the hit radius constant in CSS pixels across zoom levels", () => {
    const common = {
      clientX: 221,
      clientY: 100,
      vertices: [{ id: "v1", x: 100, y: 50 }],
      rect: { left: 0, top: 0, width: 400, height: 300 },
      canvasWidth: 400,
      canvasHeight: 300,
      pan: { x: 0, y: 0 },
      radius: 22,
    };
    expect(hitTestVertex({ ...common, zoom: 2 })?.id).toBe("v1");
    expect(
      hitTestVertex({ ...common, clientX: 321, clientY: 150, zoom: 3 })?.id,
    ).toBe("v1");
    expect(hitTestVertex({ ...common, clientX: 223, zoom: 2 })).toBeNull();
  });
});

describe("polygonSelfIntersects", () => {
  it("detects a nonadjacent bow-tie crossing", () => {
    expect(
      polygonSelfIntersects([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ]),
    ).toBe(true);
  });

  it("checks the closing edge", () => {
    expect(
      polygonSelfIntersects([
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 2, y: 8 },
        { x: 10, y: 4 },
      ]),
    ).toBe(true);
  });

  it("ignores adjacent shared endpoints in a simple polygon", () => {
    expect(
      polygonSelfIntersects([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    ).toBe(false);
  });
});
