import React from "react";
import ProfileScreen from "@/app/(tabs)/profile";
import { renderWithProviders } from "@/test-utils";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

// Mock the API client
jest.mock("@/lib/api", () => ({
  api: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

// Mock TanStack Query to use our mocked API
jest.mock("@/lib/queries", () => {
  const { useQuery, useMutation } = require("@tanstack/react-query");
  const { api } = require("@/lib/api");
  
  return {
    useProfile: () => {
      return useQuery({
        queryKey: ["profile"],
        queryFn: () => api.getProfile(),
        enabled: true,
      });
    },
    useUpdateProfile: () => {
      return useMutation({
        mutationFn: (data: Parameters<typeof api.updateProfile>[0]) =>
          api.updateProfile(data),
      });
    },
  };
});

const mockGetProfile = api.getProfile as jest.MockedFunction<
  typeof api.getProfile
>;
const mockUpdateProfile = api.updateProfile as jest.MockedFunction<
  typeof api.updateProfile
>;

describe("ProfileScreen", () => {
  const mockProfile = {
    user: {
      id: 1,
      username: "johndoe",
      email: "john.doe@example.com",
      first_name: "John",
      last_name: "Doe",
      phone_number: "+15555555555",
      street_address: "123 Main St",
      address_line_2: "Apt 4",
      city: "San Francisco",
      state_or_territory: "CA",
      postal_code: "94102",
      country: "USA",
      created_at: "2024-01-01T00:00:00Z",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Toast.show as jest.Mock).mockClear();
  });

  afterEach(async () => {
    // Clean up any remaining async operations
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("shows loading state initially", () => {
    mockGetProfile.mockReturnValue(
      new Promise(() => {
        /* never resolves */
      }),
    );

    const { getByText } = renderWithProviders(<ProfileScreen />);
    expect(getByText("Loading profile...")).toBeTruthy();
  });

  it("fetches and displays user profile", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue } = renderWithProviders(<ProfileScreen />);

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    expect(getByDisplayValue("Doe")).toBeTruthy();
    expect(getByDisplayValue("john.doe@example.com")).toBeTruthy();
    // Phone number should be displayed without +1 prefix
    expect(getByDisplayValue("5555555555")).toBeTruthy();
    expect(getByDisplayValue("123 Main St")).toBeTruthy();
    expect(getByDisplayValue("Apt 4")).toBeTruthy();
    expect(getByDisplayValue("San Francisco")).toBeTruthy();
    expect(getByDisplayValue("94102")).toBeTruthy();

    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it("displays error when profile fetch fails", async () => {
    const error = new Error("User not onboarded");
    mockGetProfile.mockRejectedValue(error);

    renderWithProviders(<ProfileScreen />);

    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          text1: "Error",
          text2: "User not onboarded",
        }),
      );
    });
  });

  it("renders all form fields", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByPlaceholderText("First name")).toBeTruthy();
    });

    expect(getByPlaceholderText("Last name")).toBeTruthy();
    expect(getByPlaceholderText("(555) 123-4567")).toBeTruthy();
    expect(getByPlaceholderText("123 Main St")).toBeTruthy();
    expect(getByPlaceholderText("Apt 4B (optional)")).toBeTruthy();
    expect(getByPlaceholderText("City")).toBeTruthy();
    expect(getByPlaceholderText("12345")).toBeTruthy();
    expect(getByText("Email")).toBeTruthy();
    expect(getByText("State/Territory *")).toBeTruthy();
  });

  it("email field is disabled", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue } = renderWithProviders(<ProfileScreen />);

    await waitFor(() => {
      const emailInput = getByDisplayValue("john.doe@example.com");
      expect(emailInput.props.editable).toBe(false);
    });
  });

  it("displays helper text for email field", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByText } = renderWithProviders(<ProfileScreen />);

    await waitFor(() => {
      expect(
        getByText("Email is managed by your account authentication"),
      ).toBeTruthy();
    });
  });

  it("handles form submission successfully", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);
    mockUpdateProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue, getByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    // Change first name
    const firstNameInput = getByDisplayValue("John");
    fireEvent.changeText(firstNameInput, "Jane");

    // Submit form
    const submitButton = getByText("Save Changes");
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Jane",
          last_name: "Doe",
          phone_number: "+15555555555", // Should be converted to E.164
          street_address: "123 Main St",
          address_line_2: "Apt 4",
          city: "San Francisco",
          state_or_territory: "CA",
          postal_code: "94102",
        }),
      );
    });

    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          text1: "Success",
          text2: "Profile updated successfully!",
        }),
      );
    });
  });

  it("displays error when form submission fails", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);
    const error = new Error("Update failed");
    mockUpdateProfile.mockRejectedValue(error);

    const { getByDisplayValue, getByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    // Submit form
    const submitButton = getByText("Save Changes");
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          text1: "Error",
          text2: "Update failed",
        }),
      );
    });
  });

  it("shows saving state during submission", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);
    
    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockUpdateProfile.mockImplementation(() => pendingPromise);

    const { getByDisplayValue, getByText, queryByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    const submitButton = getByText("Save Changes");
    fireEvent.press(submitButton);

    // Wait for the mutation to start and UI to update
    // Give React time to process the state change
    await new Promise((resolve) => setImmediate(resolve));
    
    // The button should show ActivityIndicator (and hide "Save Changes" text)
    await waitFor(
      () => {
        expect(queryByText("Save Changes")).toBeFalsy();
      },
      { timeout: 1000 },
    );

    // Resolve the promise to complete the mutation
    resolvePromise!(mockProfile);

    // Wait for success toast
    await waitFor(
      () => {
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "success",
          }),
        );
      },
      { timeout: 2000 },
    );
  });

  it("handles missing optional address_line_2", async () => {
    const profileWithoutAddress2 = {
      user: {
        ...mockProfile.user,
        address_line_2: null,
      },
    };

    mockGetProfile.mockResolvedValue(profileWithoutAddress2);

    const { getByDisplayValue, getByPlaceholderText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    const address2Input = getByPlaceholderText("Apt 4B (optional)");
    expect(address2Input.props.value).toBe("");
  });

  it("formats phone number correctly for submission", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);
    mockUpdateProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue, getByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    // Change phone number to a formatted version
    const phoneInput = getByDisplayValue("5555555555");
    fireEvent.changeText(phoneInput, "(555) 123-4567");

    // Submit form
    const submitButton = getByText("Save Changes");
    fireEvent.press(submitButton);

    await waitFor(() => {
      // Should convert to E.164 format
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: "+15551234567",
        }),
      );
    });
  });

  it("displays validation errors for invalid fields", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue, getByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    // Clear required field
    const firstNameInput = getByDisplayValue("John");
    fireEvent.changeText(firstNameInput, "");

    // Submit form
    const submitButton = getByText("Save Changes");
    fireEvent.press(submitButton);

    await waitFor(() => {
      // Should show validation error
      expect(getByText(/First name is required/)).toBeTruthy();
    });

    // updateProfile should not be called when validation fails
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("clears validation errors when user starts typing", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue, getByText, queryByText } = renderWithProviders(
      <ProfileScreen />,
    );

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    // Clear required field and submit to trigger error
    const firstNameInput = getByDisplayValue("John");
    fireEvent.changeText(firstNameInput, "");
    const submitButton = getByText("Save Changes");
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(getByText(/First name is required/)).toBeTruthy();
    });

    // Start typing again - error should clear
    fireEvent.changeText(firstNameInput, "Jane");

    await waitFor(() => {
      expect(queryByText(/First name is required/)).toBeFalsy();
    });
  });

  it("handles profile with phone number without +1 prefix", async () => {
    const profileWithLocalPhone = {
      user: {
        ...mockProfile.user,
        phone_number: "5555555555", // No +1 prefix
      },
    };

    mockGetProfile.mockResolvedValue(profileWithLocalPhone);

    const { getByDisplayValue } = renderWithProviders(<ProfileScreen />);

    await waitFor(() => {
      // Should display phone number as-is if no +1 prefix
      expect(getByDisplayValue("5555555555")).toBeTruthy();
    });
  });

  it("allows changing form fields", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { getByDisplayValue } = renderWithProviders(<ProfileScreen />);

    await waitFor(() => {
      expect(getByDisplayValue("John")).toBeTruthy();
    });

    const firstNameInput = getByDisplayValue("John");
    fireEvent.changeText(firstNameInput, "Jane");
    expect(firstNameInput.props.value).toBe("Jane");

    const cityInput = getByDisplayValue("San Francisco");
    fireEvent.changeText(cityInput, "Los Angeles");
    expect(cityInput.props.value).toBe("Los Angeles");
  });
});

