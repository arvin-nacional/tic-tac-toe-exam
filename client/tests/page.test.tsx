import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("renders the starter home page", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "To get started, edit the page.tsx file.",
    }),
  ).toBeInTheDocument();
});
