import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ApiDoc from "./page";

// Mock next/dynamic
vi.mock("next/dynamic", () => ({
  default: () => {
    const Component = ({ spec }: { spec?: object | string }) => (
      <div data-testid="swagger-ui">
        Swagger UI with spec: {spec ? "loaded" : "empty"}
      </div>
    );
    Component.displayName = "SwaggerUI";
    return Component;
  },
}));

// Mock swagger-ui-react CSS import
vi.mock("swagger-ui-react/swagger-ui.css", () => ({}));

describe("API Documentation Page", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("should render loading state initially", () => {
    mockFetch.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );

    render(<ApiDoc />);
    expect(
      screen.getByText("Loading API Documentation..."),
    ).toBeInTheDocument();
  });

  it("should fetch API spec on mount", async () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {},
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSpec,
    } as Response);

    render(<ApiDoc />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/doc");
    });
  });

  it("should render Swagger UI after spec is loaded", async () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {},
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSpec,
    } as Response);

    render(<ApiDoc />);

    await waitFor(() => {
      expect(screen.getByTestId("swagger-ui")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Swagger UI with spec: loaded/),
    ).toBeInTheDocument();
  });

  it("should display error message when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<ApiDoc />);

    await waitFor(() => {
      expect(
        screen.getByText(/Error loading API documentation: Network error/),
      ).toBeInTheDocument();
    });
  });

  it("should display error message when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    render(<ApiDoc />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Error loading API documentation: HTTP error! status: 500/,
        ),
      ).toBeInTheDocument();
    });
  });

  it("should redirect to 404 in production mode", () => {
    vi.stubEnv("NODE_ENV", "production");

    let redirectUrl = "";
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    Object.defineProperty(window.location, "href", {
      set: (url: string) => {
        redirectUrl = url;
      },
      get: () => redirectUrl,
    });

    render(<ApiDoc />);

    expect(redirectUrl).toBe("/404");
  });

  it("should allow access in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {},
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSpec,
    } as Response);

    let redirectUrl = "";
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    Object.defineProperty(window.location, "href", {
      set: (url: string) => {
        redirectUrl = url;
      },
      get: () => redirectUrl,
    });

    render(<ApiDoc />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/doc");
    });

    expect(redirectUrl).toBe("");
  });

  it("should suppress console errors for React warnings", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = vi.fn();
    console.error = mockConsoleError;

    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {},
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSpec,
    } as Response);

    render(<ApiDoc />);

    await waitFor(() => {
      expect(screen.getByTestId("swagger-ui")).toBeInTheDocument();
    });

    // Simulate the React warning that should be suppressed
    console.error("Warning: UNSAFE_componentWillReceiveProps");
    expect(mockConsoleError).not.toHaveBeenCalled();

    // Other errors should still be logged
    console.error("Some other error");
    expect(mockConsoleError).toHaveBeenCalledWith("Some other error");

    console.error = originalConsoleError;
  });
});
