import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { getAuthUserFromRequest } from "@/lib/auth";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  externalAccount: {
    create: vi.fn(),
  },
};

// Mock the getPrisma function
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock auth helper
vi.mock("@/lib/auth", () => ({
  getAuthUserFromRequest: vi.fn(),
}));

describe("GET /api/accounts/external", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const response = await GET(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
    const data = (await response.json()) as { message: string };
    expect(data).toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when user is not onboarded", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: { message: string } };
    expect(data).toEqual({ error: { message: "User not onboarded" } });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { auth_user_id: "test-uuid" },
      include: { external_accounts: true },
    });
  });

  it("returns empty array when user has no external accounts", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      external_accounts: [],
    });

    const response = await GET(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { accounts: unknown[] };
    expect(data.accounts).toEqual([]);
  });

  it("returns user's external accounts successfully", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      external_accounts: [
        {
          id: 1,
          user_id: 1,
          routing_number: "123456789",
          account_number: "9876543210",
          nickname: "Chase Savings",
        },
        {
          id: 2,
          user_id: 1,
          routing_number: "987654321",
          account_number: "1234567890",
          nickname: null,
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      accounts: Array<{
        id: number;
        user_id: number;
        routing_number: string;
        account_number: string;
        nickname: string | null;
      }>;
    };
    expect(data.accounts).toHaveLength(2);
    expect(data.accounts[0]).toEqual({
      id: 1,
      user_id: 1,
      routing_number: "123456789",
      account_number: "9876543210",
      nickname: "Chase Savings",
    });
    expect(data.accounts[1]).toEqual({
      id: 2,
      user_id: 1,
      routing_number: "987654321",
      account_number: "1234567890",
      nickname: null,
    });
  });
});

describe("POST /api/accounts/external", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(401);
    const data = (await response.json()) as { message: string };
    expect(data).toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when user is not onboarded", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: { message: string } };
    expect(data).toEqual({ error: { message: "User not onboarded" } });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { auth_user_id: "test-uuid" },
    });
  });

  it("returns 400 when routing number is missing", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe("Routing number must be exactly 9 digits");
  });

  it("returns 400 when routing number is invalid format", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "12345",
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe("Routing number must be exactly 9 digits");
  });

  it("returns 400 when account number is missing", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe(
      "Account number is required and cannot exceed 17 characters",
    );
  });

  it("returns 400 when account number exceeds 17 characters", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "123456789012345678", // 18 characters
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe(
      "Account number is required and cannot exceed 17 characters",
    );
  });

  it("returns 400 when nickname exceeds 30 characters", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
          nickname: "This nickname is way too long and exceeds the limit",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe("Nickname cannot exceed 30 characters");
  });

  it("creates external account successfully without nickname", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    const mockUser = {
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    };

    const mockAccount = {
      id: 1,
      user_id: 1,
      routing_number: "123456789",
      account_number: "9876543210",
      nickname: null,
    };

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.externalAccount.create.mockResolvedValue(mockAccount);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as {
      account: {
        id: number;
        user_id: number;
        routing_number: string;
        account_number: string;
        nickname: string | null;
      };
    };
    expect(data.account).toEqual({
      id: 1,
      user_id: 1,
      routing_number: "123456789",
      account_number: "9876543210",
      nickname: null,
    });

    expect(mockPrisma.externalAccount.create).toHaveBeenCalledWith({
      data: {
        user_id: 1,
        routing_number: "123456789",
        account_number: "9876543210",
        nickname: null,
      },
    });
  });

  it("creates external account successfully with nickname", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    const mockUser = {
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    };

    const mockAccount = {
      id: 1,
      user_id: 1,
      routing_number: "123456789",
      account_number: "9876543210",
      nickname: "Chase Savings",
    };

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.externalAccount.create.mockResolvedValue(mockAccount);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
          nickname: "Chase Savings",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as {
      account: {
        id: number;
        user_id: number;
        routing_number: string;
        account_number: string;
        nickname: string | null;
      };
    };
    expect(data.account).toEqual({
      id: 1,
      user_id: 1,
      routing_number: "123456789",
      account_number: "9876543210",
      nickname: "Chase Savings",
    });

    expect(mockPrisma.externalAccount.create).toHaveBeenCalledWith({
      data: {
        user_id: 1,
        routing_number: "123456789",
        account_number: "9876543210",
        nickname: "Chase Savings",
      },
    });
  });

  it("returns 409 when external account already exists", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    mockPrisma.externalAccount.create.mockRejectedValue({
      code: "P2002",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(409);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe("This external account is already saved");
  });

  it("returns 500 on database error", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "testuser",
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    });

    mockPrisma.externalAccount.create.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_number: "123456789",
          account_number: "9876543210",
        }),
      }),
    );

    expect(response.status).toBe(500);
    const data = (await response.json()) as {
      error: { message: string; details: string };
    };
    expect(data.error.message).toBe("Failed to create external account");
    expect(data.error.details).toBe("Database connection failed");
  });
});
