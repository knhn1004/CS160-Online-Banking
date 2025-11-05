import React from "react";
import { CurrencyInput } from "./currency-input";
import { renderWithProviders } from "@/test-utils";
import { fireEvent } from "@testing-library/react-native";

describe("CurrencyInput", () => {
  it("renders correctly", () => {
    const { getByPlaceholderText } = renderWithProviders(
      <CurrencyInput value="" onChange={() => {}} placeholder="0.00" />,
    );

    expect(getByPlaceholderText("0.00")).toBeTruthy();
  });

  it("formats input correctly", () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = renderWithProviders(
      <CurrencyInput value="" onChange={handleChange} placeholder="0.00" />,
    );

    const input = getByPlaceholderText("0.00");
    fireEvent.changeText(input, "100.50");

    expect(handleChange).toHaveBeenCalledWith("100.50");
  });

  it("displays error message", () => {
    const { getByText } = renderWithProviders(
      <CurrencyInput
        value=""
        onChange={() => {}}
        placeholder="0.00"
        error="Invalid amount"
      />,
    );

    expect(getByText("Invalid amount")).toBeTruthy();
  });

  it("displays disabled state", () => {
    const { getByPlaceholderText } = renderWithProviders(
      <CurrencyInput
        value=""
        onChange={() => {}}
        placeholder="0.00"
        disabled={true}
      />,
    );

    const input = getByPlaceholderText("0.00");
    expect(input.props.editable).toBe(false);
  });
});
