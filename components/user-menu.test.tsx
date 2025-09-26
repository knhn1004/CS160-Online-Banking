import { render, screen, waitFor } from "@testing-library/react";
import { UserMenu } from "./user-menu";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({}),
    },
  }),
}));

describe("UserMenu", () => {
  it("shows Login when logged out (and not on /login)", async () => {
    render(<UserMenu />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
    });
  });
});
