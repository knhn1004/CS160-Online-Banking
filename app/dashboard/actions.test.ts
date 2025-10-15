import { describe, it, expect, vi } from "vitest";
import { revalidateDashboard, revalidateUserCache } from "./actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revalidatePath, revalidateTag } from "next/cache";

describe("Dashboard Server Actions", () => {
  describe("revalidateDashboard", () => {
    it("should revalidate all dashboard-related paths", async () => {
      await revalidateDashboard();

      expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
      expect(revalidatePath).toHaveBeenCalledWith("/api/user/profile");
      expect(revalidatePath).toHaveBeenCalledTimes(3);
    });
  });

  describe("revalidateUserCache", () => {
    it("should revalidate user-specific cache tag and dashboard", async () => {
      const userId = "user-123";

      await revalidateUserCache(userId);

      expect(revalidateTag).toHaveBeenCalledWith(`user-${userId}`);
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    });

    it("should work with different user IDs", async () => {
      const userId = "user-456";

      await revalidateUserCache(userId);

      expect(revalidateTag).toHaveBeenCalledWith(`user-${userId}`);
    });
  });
});
