import { expect, test, type Page } from "@playwright/test";

async function playMoves(page: Page, cells: number[]) {
  const board = page.getByRole("group", { name: "Tic-Tac-Toe board" });
  for (const [index, cell] of cells.entries()) {
    const mark = index % 2 === 0 ? "X" : "O";
    const location = `Row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}`;
    await board.getByRole("button", { name: `${location}: empty`, exact: true }).click();
    await expect(board.getByRole("button", { name: `${location}: ${mark}`, exact: true })).toBeDisabled();
    await expect(board).toHaveAttribute("aria-busy", "false");
  }
}

test("create, win, continue, draw, stop, and reload saved history", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("No completed sessions yet.")).toBeVisible();
  await page.getByRole("button", { name: "Start New Game" }).click();
  await page.getByLabel("Player X name").fill("Arvin E2E");
  await page.getByLabel("Player O name").fill("Sam E2E");
  await page.getByRole("button", { name: "Create game" }).click();
  await expect(page.getByRole("status")).toHaveText("Arvin E2E's turn (X)");

  await playMoves(page, [0, 3, 1, 4, 2]);
  await expect(page.getByRole("status")).toHaveText("Arvin E2E wins this round!");
  await expect(page.getByRole("table", { name: "Session scores" }).getByRole("row", { name: "Arvin E2E (X) 1 0 0" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Round 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Arvin E2E's turn (X)");
  await playMoves(page, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
  await expect(page.getByRole("status")).toHaveText("This round is a draw.");
  await page.getByRole("button", { name: "Stop", exact: true }).click();

  const history = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Arvin E2E vs Sam E2E" }) });
  await expect(history).toBeVisible();
  await expect(page.getByRole("group", { name: "Tic-Tac-Toe board" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start New Game" })).toBeVisible();
  await page.reload();
  await expect(history.getByText("2 rounds")).toBeVisible();
  await expect(history.getByRole("row", { name: "Arvin E2E (X) 1 0 1" })).toBeVisible();
  await expect(history.getByRole("row", { name: "Sam E2E (O) 0 1 1" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
