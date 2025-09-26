import { render, screen } from "@testing-library/react";
import { Navbar } from "./navbar";

describe("Navbar", () => {
  it("renders app brand", async () => {
    render(await Navbar());
    expect(
      screen.getByRole("link", { name: /CS160 Bank/i }),
    ).toBeInTheDocument();
  });
});
