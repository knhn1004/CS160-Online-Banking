import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "@/app/api/billpay/rules/[id]/route";
import { getAuthUserFromRequest } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/library";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  billPayRule: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  billPayPayee: {
    findUnique: vi.fn(),
  },
  $executeRawUnsafe: vi.fn(),
};

// Mock the getPrisma function
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock auth helper
vi.mock("@/lib/auth", () => ({
  getAuthUserFromRequest: vi.fn(),
}));

describe("Billpay Rules API - PUT /api/billpay/rules/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({ amount: "100.00" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(401);
    expect(data).toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when user is not onboarded", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({ amount: "100.00" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: { message: "User not onboarded" } });
  });

  it("returns 404 when rule is not found", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        {
          id: 1,
          is_active: true,
        },
      ],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.billPayRule.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/billpay/rules/999", {
      method: "PUT",
      body: JSON.stringify({ amount: "100.00" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "999" }),
    });
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(data.error).toBe("Billpay rule not found");
  });

  it("returns 403 when user does not own the rule", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        {
          id: 1,
          is_active: true,
        },
      ],
    };

    const mockRule = {
      id: 1,
      user_id: 2, // Different user
      source_internal_id: 1,
      payee_id: 1,
      amount: new Decimal("100.00"),
      frequency: "0 9 * * *",
      start_time: new Date("2025-12-01T09:00:00Z"),
      end_time: null,
      payee: { id: 1 },
      source_internal: { id: 1 },
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.billPayRule.findUnique.mockResolvedValue(mockRule);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({ amount: "100.00" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(data.error).toContain("Forbidden");
  });

  it("successfully updates rule amount", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        {
          id: 1,
          is_active: true,
        },
      ],
    };

    const mockRule = {
      id: 1,
      user_id: 1,
      source_internal_id: 1,
      payee_id: 1,
      amount: new Decimal("100.00"),
      frequency: "0 9 * * *",
      start_time: new Date("2025-12-01T09:00:00Z"),
      end_time: null,
      payee: { id: 1 },
      source_internal: { id: 1 },
    };

    const updatedRule = {
      ...mockRule,
      amount: new Decimal("150.00"),
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.billPayRule.findUnique.mockResolvedValue(mockRule);
    mockPrisma.billPayRule.update.mockResolvedValue(updatedRule);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({ amount: "150.00" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { rule: unknown };

    expect(response.status).toBe(200);
    expect(data.rule).toMatchObject({
      id: 1,
      amount: 150,
    });
    expect(mockPrisma.billPayRule.update).toHaveBeenCalled();
  });

  it("successfully updates rule frequency and reschedules cron", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        {
          id: 1,
          is_active: true,
        },
      ],
    };

    const mockRule = {
      id: 1,
      user_id: 1,
      source_internal_id: 1,
      payee_id: 1,
      amount: new Decimal("100.00"),
      frequency: "0 9 * * *",
      start_time: new Date("2025-12-01T09:00:00Z"),
      end_time: null,
      payee: { id: 1 },
      source_internal: { id: 1 },
    };

    const updatedRule = {
      ...mockRule,
      frequency: "0 10 * * *",
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.billPayRule.findUnique.mockResolvedValue(mockRule);
    mockPrisma.billPayRule.update.mockResolvedValue(updatedRule);
    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({ frequency: "0 10 * * *" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { rule: unknown };

    expect(response.status).toBe(200);
    expect(data.rule).toMatchObject({
      id: 1,
      frequency: "0 10 * * *",
    });
    // Should unschedule old cron and schedule new one
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it("returns 400 when source account is inactive", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        {
          id: 2,
          is_active: false, // Inactive account
        },
      ],
    };

    const mockRule = {
      id: 1,
      user_id: 1,
      source_internal_id: 1,
      payee_id: 1,
      amount: new Decimal("100.00"),
      frequency: "0 9 * * *",
      start_time: new Date("2025-12-01T09:00:00Z"),
      end_time: null,
      payee: { id: 1 },
      source_internal: { id: 1 },
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.billPayRule.findUnique.mockResolvedValue(mockRule);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({ source_account_id: 2 }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("inactive");
  });

  it("returns 422 when request body is invalid", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        {
          id: 1,
          is_active: true,
        },
      ],
    };

    const mockRule = {
      id: 1,
      user_id: 1,
      source_internal_id: 1,
      payee_id: 1,
      amount: new Decimal("100.00"),
      frequency: "0 9 * * *",
      start_time: new Date("2025-12-01T09:00:00Z"),
      end_time: null,
      payee: { id: 1 },
      source_internal: { id: 1 },
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.billPayRule.findUnique.mockResolvedValue(mockRule);

    const request = new Request("http://localhost:3000/api/billpay/rules/1", {
      method: "PUT",
      body: JSON.stringify({}), // Empty object should fail validation
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(422);
    expect(data.error).toBe("Invalid request body");
  });
});
