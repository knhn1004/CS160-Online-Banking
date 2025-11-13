import { describe, it, expect, beforeEach, vi } from "vitest";
import { DELETE } from "./route";
import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

vi.mock("@/app/lib/prisma");
vi.mock("@/lib/auth");

describe("DELETE /api/api-keys/[id]", () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrisma).mockReturnValue(
      mockPrisma as unknown as ReturnType<typeof getPrisma>,
    );
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    });

    const request = new Request("http://localhost/api/api-keys/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "1" }),
    });
    expect(response.status).toBe(401);
  });

  it("should return 404 if API key not found", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      auth_user_id: "user-123",
    });

    mockPrisma.apiKey.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost/api/api-keys/999", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "999" }),
    });
    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("API key not found");
  });

  it("should revoke API key successfully", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      auth_user_id: "user-123",
    });

    mockPrisma.apiKey.findUnique.mockResolvedValue({
      id: 1,
      user_id: 1,
      is_active: true,
    });

    mockPrisma.apiKey.update.mockResolvedValue({
      id: 1,
      is_active: false,
    });

    const request = new Request("http://localhost/api/api-keys/1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "1" }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { message: string };
    expect(data.message).toContain("revoked");
    expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { is_active: false },
    });
  });
});
