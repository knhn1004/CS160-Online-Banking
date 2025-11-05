import React from "react";
import TransfersScreen from "./transfers/index";
import { renderWithProviders } from "@/test-utils";

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

describe("TransfersScreen", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<TransfersScreen />);

    expect(getByText("Internal Transfer")).toBeTruthy();
    expect(getByText("External Transfer")).toBeTruthy();
    expect(getByText("Bill Pay")).toBeTruthy();
    expect(getByText("Check Deposit")).toBeTruthy();
    expect(getByText("Transfer History")).toBeTruthy();
  });

  it('displays all transfer options', () => {
    const { getByText } = renderWithProviders(<TransfersScreen />);

    expect(getByText("Transfer between your accounts")).toBeTruthy();
    expect(getByText("Send money to others")).toBeTruthy();
    expect(getByText("Pay bills automatically")).toBeTruthy();
    expect(getByText("Deposit a check")).toBeTruthy();
    expect(getByText("View past transactions")).toBeTruthy();
  });

  it('renders screen title and subtitle', () => {
    const { getByText } = renderWithProviders(<TransfersScreen />);

    expect(getByText("Transfers")).toBeTruthy();
    expect(getByText("Choose a transfer option")).toBeTruthy();
  });
});