import "@testing-library/jest-dom/vitest";

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
}

if (!globalThis.PointerEvent) {
  class TestPointerEvent extends MouseEvent {
    constructor(type, properties = {}) {
      super(type, properties);
      Object.defineProperty(this, "pointerId", { value: properties.pointerId ?? 1 });
      Object.defineProperty(this, "pointerType", { value: properties.pointerType ?? "mouse" });
      Object.defineProperty(this, "isPrimary", { value: properties.isPrimary ?? true });
    }
  }
  globalThis.PointerEvent = TestPointerEvent;
}
