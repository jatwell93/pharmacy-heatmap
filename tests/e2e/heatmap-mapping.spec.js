import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.resolve(here, "../fixtures", name);

async function canvasPoint(canvas, x, y) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  return {
    clientX: box.x + (x / 800) * box.width,
    clientY: box.y + (y / 600) * box.height,
  };
}

async function tapPoint(page, canvas, x, y, pointerId, touch) {
  const point = await canvasPoint(canvas, x, y);
  if (touch) {
    const box = await canvas.boundingBox();
    await canvas.tap({ position: { x: (x / 800) * box.width, y: (y / 600) * box.height } });
  } else {
    await canvas.dispatchEvent("pointerdown", { ...point, pointerId, pointerType: "mouse", isPrimary: true });
    await canvas.dispatchEvent("pointerup", { ...point, pointerId, pointerType: "mouse", isPrimary: true });
  }
}

test("fixture-driven whole-pixel mapping remains accessible and responsive", async ({ page }, testInfo) => {
  const touch = testInfo.project.name.includes("mobile");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Heat-Map Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add profit center" })).toBeDisabled();

  await page.getByLabel("Floor plan (PNG or JPEG)").setInputFiles(fixture("floor-plan-800x600.png"));
  await expect(page.locator(".status-message")).toContainText("Floor plan ready: 800 × 600 pixels");
  await page.getByLabel(/^Sales intelligence \(XLSX\)/).setInputFiles(fixture("sales-valid.xlsx"));
  await expect(page.locator(".status-message")).toContainText("Sales data ready for 3 departments");

  await page.getByRole("button", { name: "Add profit center" }).click();
  await page.getByRole("button", { name: /Dispensary.*\$125,000/ }).click();
  const canvas = page.getByLabel(/Draw floor plan/);
  await expect(canvas).toBeVisible();

  const points = [
    [100, 100],
    [500, 450],
    [100, 450],
    [500, 100],
  ];
  for (let index = 0; index < points.length; index += 1) {
    await tapPoint(page, canvas, points[index][0], points[index][1], index + 1, touch);
  }
  await expect(page.getByText("Dispensary: 4 committed vertices")).toBeVisible();
  await page.getByText("Dispensary: 4 committed vertices").click();
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "crosses itself" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Dispensary boundary vertices" })).toBeVisible();
  const fourthRadio = page.getByRole("radio", { name: "Vertex 4: (500, 100)" });
  await expect(fourthRadio).toBeChecked();
  const fourthRow = fourthRadio.locator("xpath=ancestor::li");
  const fourthFields = fourthRow.locator("input:not([type=radio])");
  await fourthFields.nth(0).fill("500.5");
  await fourthFields.nth(1).focus();
  await expect(fourthRow.getByRole("alert")).toContainText("whole pixels");
  await fourthFields.nth(0).fill("500");
  await fourthFields.nth(1).fill("101");
  await page.getByRole("button", { name: "Insert after" }).focus();
  await expect(page.getByRole("radio", { name: "Vertex 4: (500, 101)" })).toBeChecked();

  const firstRadio = page.getByRole("radio", { name: "Vertex 1: (100, 100)" });
  await firstRadio.focus();
  await page.keyboard.press("Space");
  await expect(firstRadio).toBeChecked();
  await expect(page.getByLabel("Current zoom")).toHaveText("100%");
  await firstRadio.focus();
  await page.keyboard.press("Tab");
  await expect(firstRadio.locator("xpath=ancestor::li").locator("input:not([type=radio])").first()).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Shift+Tab");
  await expect(firstRadio).toBeFocused();

  await page.getByRole("button", { name: "Insert after" }).click();
  const insertion = page.getByRole("group", { name: /Insert after vertex/ });
  const draftInputs = insertion.locator("input");
  await expect(draftInputs.nth(0)).toBeFocused();
  await draftInputs.nth(0).fill("240");
  await draftInputs.nth(1).fill("280");
  await expect(page.getByRole("button", { name: "Clear Points" })).toBeDisabled();
  await page.getByRole("button", { name: "Move down" }).click();
  await expect(page.getByRole("group", { name: "Insert after vertex 2" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm insertion" }).click();
  await expect(page.getByRole("radio", { name: "Vertex 3: (240, 280)" })).toBeChecked();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: "Insert after vertex 2" })).toBeVisible();
  await page
    .getByRole("toolbar", { name: "Dispensary selected vertex actions" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("group", { name: "Delete draft anchor" })).toBeVisible();
  await page.getByRole("button", { name: "Delete vertex and draft" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toBeVisible();
  await page
    .getByRole("toolbar", { name: "Dispensary selected vertex actions" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("group", { name: "Delete draft anchor" })).toBeVisible();
  await page.getByRole("button", { name: "Finish Area" }).click();
  await expect(page.getByRole("group", { name: "Delete draft anchor" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Finish area with unfinished insertion" })).toBeVisible();
  await page.getByRole("button", { name: "Return to draft" }).click();

  await page.getByText("Dispensary: 4 committed vertices").click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toBeHidden();
  await page.getByText("Dispensary: 4 committed vertices").click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toBeVisible();
  await page.getByRole("button", { name: "Pause mapping" }).click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toBeVisible();
  await page.getByRole("button", { name: "Edit Area" }).click();

  await page.getByRole("button", { name: "Finish Area" }).click();
  await expect(page.getByRole("group", { name: "Finish area with unfinished insertion" })).toBeVisible();
  await page.getByRole("button", { name: "Return to draft" }).click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ }).locator("input").first()).toBeFocused();
  await page.getByRole("button", { name: "Finish Area" }).click();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toBeVisible();
  await page.getByRole("button", { name: "Finish Area" }).click();
  await page.getByRole("button", { name: "Finish and keep draft" }).click();
  await expect(page.locator(".status-message")).toContainText("boundary saved with 4 vertices");
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toBeVisible();

  await page.getByRole("button", { name: "Edit Area" }).click();
  await page.getByRole("button", { name: "Finish Area" }).click();
  await page.getByRole("button", { name: "Finish and discard draft" }).click();
  await expect(page.getByRole("group", { name: /Insert after vertex/ })).toHaveCount(0);
  await expect(page.getByText(/crosses itself/)).toBeVisible();

  const viewCanvas = page.getByLabel(/View floor plan/);
  const firstPoint = await canvasPoint(viewCanvas, 100, 100);
  await viewCanvas.dispatchEvent("pointerdown", { ...firstPoint, pointerId: 20, pointerType: touch ? "touch" : "mouse", isPrimary: true });
  await viewCanvas.dispatchEvent("pointerup", { ...firstPoint, pointerId: 20, pointerType: touch ? "touch" : "mouse", isPrimary: true });
  await expect(page.getByText(/Selected vertex .* in Dispensary/)).toBeAttached();
  await expect(page.getByLabel("Current zoom")).toHaveText("100%");

  const beforeCancel = await page.getByText(/^Dispensary: \d+ committed/).textContent();
  await page.getByRole("button", { name: "Edit Area" }).click();
  const cancelPoint = await canvasPoint(canvas, 700, 500);
  await canvas.dispatchEvent("pointerdown", { ...cancelPoint, pointerId: 30, pointerType: "touch", isPrimary: true });
  await canvas.dispatchEvent("pointercancel", { ...cancelPoint, pointerId: 30, pointerType: "touch", isPrimary: true });
  await canvas.dispatchEvent("pointerup", { ...cancelPoint, pointerId: 30, pointerType: "touch", isPrimary: true });
  await canvas.dispatchEvent("pointerdown", { ...cancelPoint, pointerId: 31, pointerType: "touch", isPrimary: true });
  await canvas.dispatchEvent("lostpointercapture", { ...cancelPoint, pointerId: 31, pointerType: "touch", isPrimary: true });
  await canvas.dispatchEvent("pointerup", { ...cancelPoint, pointerId: 31, pointerType: "touch", isPrimary: true });
  await expect(page.getByText(beforeCancel)).toBeVisible();
  await page.getByRole("button", { name: "Pause mapping" }).click();

  await page.getByLabel("Show heatmap").check();
  await page.getByLabel(/Diffusion radius/).fill("35");
  await page.getByLabel(/Data intensity/).fill("70");
  await expect(page.getByLabel(/Performance legend/)).toBeVisible();

  await page.getByLabel(/^Sales intelligence \(XLSX\)/).setInputFiles(fixture("sales-invalid.xlsx"));
  await expect(page.locator(".status-message")).toContainText("Existing sales data was kept");
  await expect(page.getByText("4 vertices · $125,000")).toBeVisible();

  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);

  const screenshotName = testInfo.project.name === "desktop-chromium"
    ? "desktop-after.png"
    : testInfo.project.name === "mobile-touch-chromium"
      ? "mobile-after.png"
      : "mobile-320-after.png";
  await page.screenshot({ path: `docs/audits/KB-001/evidence/${screenshotName}`, fullPage: false });
});

test("zoomed drawing rounds intrinsic pixels and view drags do not select", async ({ page }, testInfo) => {
  const pointerType = testInfo.project.name.includes("mobile") ? "touch" : "mouse";
  await page.goto("/");
  await page.getByLabel("Floor plan (PNG or JPEG)").setInputFiles(fixture("floor-plan-800x600.png"));
  await expect(page.locator(".status-message")).toContainText("Floor plan ready");
  await page.getByRole("button", { name: "Add profit center" }).click();
  await page.getByLabel("New profit center name").fill("Clinical");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const canvas = page.getByLabel(/Draw floor plan/);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByLabel("Current zoom")).toHaveText("110%");
  const box = await canvas.boundingBox();
  const transformed = (x, y) => ({
    clientX: box.x + ((x * 1.1 - 40) / 800) * box.width,
    clientY: box.y + ((y * 1.1 - 30) / 600) * box.height,
  });
  for (const [index, [x, y]] of [[123.6, 234.4], [400.2, 220.3], [350.4, 430.2]].entries()) {
    const point = transformed(x, y);
    await canvas.dispatchEvent("pointerdown", { ...point, pointerId: index + 60, pointerType, isPrimary: true });
    await canvas.dispatchEvent("pointerup", { ...point, pointerId: index + 60, pointerType, isPrimary: true });
  }
  await page.getByText("Clinical: 3 committed vertices").click();
  await expect(page.getByRole("radio", { name: "Vertex 1: (124, 234)" })).toBeVisible();
  const third = page.getByRole("radio", { name: "Vertex 3: (350, 430)" });
  await expect(third).toBeChecked();

  await page.getByRole("button", { name: "Finish Area" }).click();
  const viewCanvas = page.getByLabel(/View floor plan/);
  const first = transformed(124, 234);
  await viewCanvas.dispatchEvent("pointerdown", { ...first, pointerId: 70, pointerType, isPrimary: true });
  await viewCanvas.dispatchEvent("pointermove", { clientX: first.clientX + 20, clientY: first.clientY, pointerId: 70, pointerType, isPrimary: true });
  await viewCanvas.dispatchEvent("pointerup", { clientX: first.clientX + 20, clientY: first.clientY, pointerId: 70, pointerType, isPrimary: true });
  await expect(third).toBeChecked();
});

test("draft survives disclosure, mode, and department context changes", async ({ page }, testInfo) => {
  const touch = testInfo.project.name.includes("mobile");
  await page.goto("/");
  await page.getByLabel("Floor plan (PNG or JPEG)").setInputFiles(fixture("floor-plan-800x600.png"));
  await expect(page.locator(".status-message")).toContainText("Floor plan ready");
  await page.getByLabel(/^Sales intelligence \(XLSX\)/).setInputFiles(fixture("sales-valid.xlsx"));
  await expect(page.locator(".status-message")).toContainText("Sales data ready");
  await page.getByRole("button", { name: "Add profit center" }).click();
  await page.getByRole("button", { name: /Dispensary.*\$125,000/ }).click();
  const canvas = page.getByLabel(/Draw floor plan/);
  for (const [index, point] of [[100, 100], [300, 100], [200, 300]].entries()) {
    await tapPoint(page, canvas, point[0], point[1], index + 80, touch);
  }
  await page.getByText("Dispensary: 3 committed vertices").click();
  await page.getByRole("radio", { name: "Vertex 1: (100, 100)" }).check();
  await page.getByRole("button", { name: "Insert after" }).click();
  const draft = page.getByRole("group", { name: "Insert after vertex 1" });
  await draft.locator("input").nth(0).fill("150");
  await draft.locator("input").nth(1).fill("175");
  await page.getByText("Dispensary: 3 committed vertices").click();
  await page.getByText("Dispensary: 3 committed vertices").click();
  await page.getByRole("button", { name: "Pause mapping" }).click();

  await page.getByRole("button", { name: "Add profit center" }).click();
  await page.getByRole("button", { name: /Front Shop.*\$62,500/ }).click();
  await expect(page.getByText("Front Shop: 0 committed vertices")).toBeVisible();
  await page.getByRole("button", { name: "Pause mapping" }).click();
  const dispensaryCard = page.locator(".department-item").filter({ hasText: "Dispensary" });
  await dispensaryCard.getByRole("button", { name: "Edit Area" }).click();
  await expect(page.getByRole("group", { name: "Insert after vertex 1" }).locator("input").nth(0)).toHaveValue("150");
  await expect(page.getByRole("group", { name: "Insert after vertex 1" }).locator("input").nth(1)).toHaveValue("175");
});

test("invalid image is actionable and does not replace the current plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Floor plan (PNG or JPEG)").setInputFiles(fixture("floor-plan-800x600.png"));
  await expect(page.getByLabel(/View floor plan/)).toBeVisible();
  await page.getByLabel("Floor plan (PNG or JPEG)").setInputFiles(fixture("image-invalid.png"));
  await expect(page.locator(".status-message")).toContainText(/not a valid PNG or JPEG|current plan was kept/i);
  await expect(page.getByLabel(/View floor plan/)).toBeVisible();
});
