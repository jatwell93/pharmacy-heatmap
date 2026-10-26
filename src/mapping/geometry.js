export const DEFAULT_HIT_RADIUS_CSS = 22;

export function roundToWholePixel(value) {
  return Math.round(value);
}

export function validatePixelInput(raw, max) {
  const text = String(raw ?? "").trim();
  if (!text) return { valid: false, error: "Enter a whole-pixel value." };
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { valid: false, error: "Enter a finite number." };
  }
  if (!Number.isInteger(value)) {
    return { valid: false, error: "Use whole pixels without decimals." };
  }
  if (value < 0 || value > max) {
    return {
      valid: false,
      error: `Enter a value from 0 to ${max}.`,
    };
  }
  return { valid: true, value, error: "" };
}

export function clientToIntrinsicPoint({
  clientX,
  clientY,
  rect,
  canvasWidth,
  canvasHeight,
  pan,
  zoom,
  imageWidth = canvasWidth,
  imageHeight = canvasHeight,
}) {
  if (!rect?.width || !rect?.height || !canvasWidth || !canvasHeight || !zoom) {
    return null;
  }
  const canvasX = (clientX - rect.left) * (canvasWidth / rect.width);
  const canvasY = (clientY - rect.top) * (canvasHeight / rect.height);
  const x = roundToWholePixel((canvasX - pan.x) / zoom);
  const y = roundToWholePixel((canvasY - pan.y) / zoom);
  if (x < 0 || y < 0 || x > imageWidth || y > imageHeight) return null;
  return { x, y };
}

export function intrinsicToClientPoint({
  point,
  rect,
  canvasWidth,
  canvasHeight,
  pan,
  zoom,
}) {
  if (!rect?.width || !rect?.height || !canvasWidth || !canvasHeight) return null;
  return {
    x: rect.left + ((point.x * zoom + pan.x) * rect.width) / canvasWidth,
    y: rect.top + ((point.y * zoom + pan.y) * rect.height) / canvasHeight,
  };
}

export function hitTestVertex({
  clientX,
  clientY,
  vertices,
  rect,
  canvasWidth,
  canvasHeight,
  pan,
  zoom,
  radius = DEFAULT_HIT_RADIUS_CSS,
}) {
  let closest = null;
  let closestDistance = Infinity;
  for (const vertex of vertices ?? []) {
    const screen = intrinsicToClientPoint({
      point: vertex,
      rect,
      canvasWidth,
      canvasHeight,
      pan,
      zoom,
    });
    if (!screen) continue;
    const distance = Math.hypot(clientX - screen.x, clientY - screen.y);
    if (distance <= radius && distance < closestDistance) {
      closest = vertex;
      closestDistance = distance;
    }
  }
  return closest;
}

function orientation(a, b, c) {
  const cross = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(cross) < Number.EPSILON) return 0;
  return cross > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

export function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

export function polygonSelfIntersects(vertices) {
  if (!vertices || vertices.length < 4) return false;
  const edgeCount = vertices.length;
  for (let first = 0; first < edgeCount; first += 1) {
    const firstNext = (first + 1) % edgeCount;
    for (let second = first + 1; second < edgeCount; second += 1) {
      const secondNext = (second + 1) % edgeCount;
      const adjacent =
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0);
      if (adjacent) continue;
      if (
        segmentsIntersect(
          vertices[first],
          vertices[firstNext],
          vertices[second],
          vertices[secondNext],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
