import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

vi.mock("@/app/lib/prisma");
vi.mock("@/lib/auth");

describe("POST /api/api-keys/generate", () => {
  const mockPrisma = {
    internalAccount: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      create: vi.fn(),
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

    const request = new Request("http://localhost/api/api-keys/generate", {
      method: "POST",
      body: JSON.stringify({ account_id: 1 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should return 404 if account not found", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123", email: "test@example.com" },
    });

    mockPrisma.internalAccount.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost/api/api-keys/generate", {
      method: "POST",
      body: JSON.stringify({ account_id: 999 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Account not found");
  });

  it("should return 403 if user doesn't own account", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123", email: "test@example.com" },
    });

    mockPrisma.internalAccount.findUnique.mockResolvedValue({
      id: 1,
      account_number: "1234567890",
      user: { auth_user_id: "different-user" },
      is_active: true,
    });

    const request = new Request("http://localhost/api/api-keys/generate", {
      method: "POST",
      body: JSON.stringify({ account_id: 1 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("do not own this account");
  });

  it("should generate API key successfully", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123", email: "test@example.com" },
    });

    mockPrisma.internalAccount.findUnique.mockResolvedValue({
      id: 1,
      account_number: "1234567890",
      user: { auth_user_id: "user-123" },
      is_active: true,
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      auth_user_id: "user-123",
    });

    mockPrisma.apiKey.create.mockResolvedValue({
      id: 1,
      created_at: new Date("2024-01-01"),
    });

    const request = new Request("http://localhost/api/api-keys/generate", {
      method: "POST",
      body: JSON.stringify({ account_id: 1 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      api_key: string;
      account_id: number;
    };
    expect(data.api_key).toMatch(/^cs_160/);
    expect(data.account_id).toBe(1);
    expect(mockPrisma.apiKey.create).toHaveBeenCalled();
  });
});
