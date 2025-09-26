import "@testing-library/jest-dom/vitest";

// Next.js router/navigation minimal mocks for component tests
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<any>("next/navigation");
  return {
    ...actual,
    usePathname: () => "/",
  };
});
