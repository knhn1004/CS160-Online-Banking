import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Page from "./page";

describe("Landing Page", () => {
  it("renders the main headline", () => {
    render(<Page />);
    expect(
      screen.getByText(/Simple, Secure, and Smart Banking/i),
    ).toBeInTheDocument();
  });

  it("renders the Get Started button", () => {
    render(<Page />);
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<Page />);
    expect(screen.getByText(/Bank160/i)).toBeInTheDocument();
  });
});
