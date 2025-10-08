import { render, screen } from "@testing-library/react";
import SignupPage from "./page";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
    },
  }),
}));

describe("SignupPage", () => {
  it("renders form controls", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
