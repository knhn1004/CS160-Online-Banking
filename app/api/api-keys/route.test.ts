import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

vi.mock("@/app/lib/prisma");
vi.mock("@/lib/auth");

describe("GET /api/api-keys", () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findMany: vi.fn(),
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

    const request = new Request("http://localhost/api/api-keys");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("should return list of API keys", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      auth_user_id: "user-123",
    });

    mockPrisma.apiKey.findMany.mockResolvedValue([
      {
        id: 1,
        key_prefix: "cs_160xxx",
        internal_account_id: 1,
        expires_at: null,
        is_active: true,
        created_at: new Date("2024-01-01"),
        last_used_at: null,
        internal_account: {
          id: 1,
          account_number: "1234567890",
          account_type: "checking",
        },
      },
    ]);

    const request = new Request("http://localhost/api/api-keys");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      api_keys: Array<{ key_prefix: string; api_key?: string }>;
    };
    expect(data.api_keys).toHaveLength(1);
    expect(data.api_keys[0].key_prefix).toBe("cs_160xxx");
    expect(data.api_keys[0].api_key).toBeUndefined(); // Should not include full key
  });
});
