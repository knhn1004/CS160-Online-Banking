/**
 * Unit tests for ThemedView component
 */

import React from "react";
import { View } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { renderWithProviders } from "@/test-utils";

describe("ThemedView", () => {
  it("renders correctly with children", () => {
    const { getByText } = renderWithProviders(
      <ThemedView>
        <ThemedText>Test Content</ThemedText>
      </ThemedView>,
    );
    expect(getByText("Test Content")).toBeTruthy();
  });

  it("renders correctly with multiple children", () => {
    const { getByText } = renderWithProviders(
      <ThemedView>
        <ThemedText>First</ThemedText>
        <ThemedText>Second</ThemedText>
      </ThemedView>,
    );
    expect(getByText("First")).toBeTruthy();
    expect(getByText("Second")).toBeTruthy();
  });

  it("renders correctly without children", () => {
    const { UNSAFE_getByType } = renderWithProviders(<ThemedView />);
    const view = UNSAFE_getByType(View);
    // Should render without errors
    expect(view).toBeTruthy();
  });

  it("applies custom styles", () => {
    const { UNSAFE_getByType } = renderWithProviders(
      <ThemedView style={{ padding: 10 }} />,
    );
    const view = UNSAFE_getByType(View);
    expect(view).toBeTruthy();
  });

  it("renders with View children", () => {
    const { getByText } = renderWithProviders(
      <ThemedView>
        <View>
          <ThemedText>Nested Content</ThemedText>
        </View>
      </ThemedView>,
    );
    expect(getByText("Nested Content")).toBeTruthy();
  });

  it("handles raw string children gracefully", () => {
    // This should not crash - raw strings should be filtered out
    // We need to cast to any to test the defensive behavior
    const { UNSAFE_getByType } = renderWithProviders(
      <ThemedView {...({ children: "This is a raw string" } as any)} />,
    );
    const view = UNSAFE_getByType(View);
    expect(view).toBeTruthy();
  });

  it("handles null and undefined children", () => {
    const { UNSAFE_getByType } = renderWithProviders(
      <ThemedView>{null}</ThemedView>,
    );
    const view = UNSAFE_getByType(View);
    expect(view).toBeTruthy();
  });
});

