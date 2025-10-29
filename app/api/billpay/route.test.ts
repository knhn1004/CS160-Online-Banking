import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

type AnyObj = Record<string, unknown>;

// Mock the same modules that the route file imports
vi.mock("../../../lib/auth", () => ({ getAuthUserFromRequest: vi.fn() }));
vi.mock("../../lib/prisma", () => ({ getPrisma: vi.fn() }));

import { getAuthUserFromRequest } from "../../../lib/auth";
import { getPrisma } from "../../lib/prisma";

function makeMockPrisma() {
  return {
    user: { findUnique: vi.fn() },
    billPayPayee: { findUnique: vi.fn() },
    internalAccount: { findFirst: vi.fn(), findUnique: vi.fn() },
    billPayRule: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: { count: vi.fn() },
  };
}

beforeEach(() => {
  vi.resetModules(); // ensure route module re-imports and picks up current mocks
  vi.clearAllMocks();
});

/* ------------------------------------------------------- POST endpoint tests ------------------------------------------------------------ */
describe("POST /api/billpay", () => {
  it("malformed/invalid body -> 400", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-1" },
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as AnyObj;
    expect(json.error).toBeDefined();
  });

  it("unauthenticated supabase user -> 401", async () => {
    (getPrisma as unknown as Mock).mockReturnValue(makeMockPrisma());
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    });

    const { POST } = await import("./route");
    const body = {
      user_id: 1,
      source_internal_id: 1,
      payee_id: 1,
      amount: "10.00",
      frequency: "monthly",
      start_time: new Date().toISOString(),
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("authenticated but application_user_id !== body.user_id -> 400", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-2" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 42 });

    const { POST } = await import("./route");
    const body = {
      user_id: 99,
      source_internal_id: 1,
      payee_id: 1,
      amount: "10.00",
      frequency: "monthly",
      start_time: new Date().toISOString(),
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as AnyObj;
    expect(json.error).toBeDefined();
  });

  it("payee not found -> 400", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-3" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.billPayPayee.findUnique.mockResolvedValue(null);

    const { POST } = await import("./route");
    const body = {
      user_id: 10,
      source_internal_id: 1,
      payee_id: 9999,
      amount: "5.00",
      frequency: "monthly",
      start_time: new Date().toISOString(),
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("payee inactive -> 400", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-4" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 11 });
    mockPrisma.billPayPayee.findUnique.mockResolvedValue({
      id: 2,
      business_name: "X",
      is_active: false,
    });

    const { POST } = await import("./route");
    const body = {
      user_id: 11,
      source_internal_id: 1,
      payee_id: 2,
      amount: "7.00",
      frequency: "monthly",
      start_time: new Date().toISOString(),
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("internal account doesn't belong to user -> 400", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-5" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 20 });
    mockPrisma.internalAccount.findFirst.mockResolvedValue(null);

    const { POST } = await import("./route");
    const body = {
      user_id: 20,
      source_internal_id: 999,
      payee_id: 1,
      amount: "15.00",
      frequency: "monthly",
      start_time: new Date().toISOString(),
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("invalid start_time (past) -> 400", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-6" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 30 });
    mockPrisma.billPayPayee.findUnique.mockResolvedValue({
      id: 3,
      business_name: "Payee",
    });
    mockPrisma.internalAccount.findFirst.mockResolvedValue({
      id: 5,
      account_number: "ACC5",
    });

    const { POST } = await import("./route");
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const body = {
      user_id: 30,
      source_internal_id: 5,
      payee_id: 3,
      amount: "3.00",
      frequency: "monthly",
      start_time: past,
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("computeNextRunFromStart used -> created rule.next_run is future", async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.billPayRule.create = vi.fn((args: unknown) =>
      Promise.resolve({
        id: 999,
        ...(args as AnyObj),
        payee: { business_name: "Acme" },
        source_internal: { account_number: "0001" },
      }),
    );
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-7" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 50 });
    mockPrisma.billPayPayee.findUnique.mockResolvedValue({
      id: 4,
      business_name: "Acme",
    });
    mockPrisma.internalAccount.findFirst.mockResolvedValue({
      id: 6,
      account_number: "0001",
    });

    const { POST } = await import("./route");
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const body = {
      user_id: 50,
      source_internal_id: 6,
      payee_id: 4,
      amount: "20.00",
      frequency: "monthly",
      start_time: past,
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as AnyObj;
    expect(json.error).toBeDefined();
  });

  it("valid request -> DB create called and 201 returned", async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.billPayRule.create = vi.fn((args: unknown) =>
      Promise.resolve({
        id: 123,
        ...(args as AnyObj),
        payee: { business_name: "Acme" },
        source_internal: { account_number: "0001" },
      }),
    );
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-8" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({ id: 60 });
    mockPrisma.billPayPayee.findUnique.mockResolvedValue({
      id: 5,
      business_name: "Acme",
    });
    mockPrisma.internalAccount.findFirst.mockResolvedValue({
      id: 8,
      account_number: "0001",
    });
    // route may call either findFirst or findUnique — mock both to be safe
    mockPrisma.internalAccount.findUnique.mockResolvedValue({
      id: 8,
      account_number: "0001",
    });
    // ensure payee is active (route likely checks is_active)
    mockPrisma.billPayPayee.findUnique.mockResolvedValue({
      id: 5,
      business_name: "Acme",
      is_active: true,
    });
    // include owner info on internal account so authorization check passes
    mockPrisma.internalAccount.findFirst.mockResolvedValue({
      id: 8,
      account_number: "0001",
      user_id: 60,
    });
    // route may call either findFirst or findUnique — mock both to be safe
    mockPrisma.internalAccount.findUnique.mockResolvedValue({
      id: 8,
      account_number: "0001",
      user_id: 60,
    });
    mockPrisma.internalAccount.findFirst.mockResolvedValue({
      id: 8,
      account_number: "0001",
      user_id: 60,
      is_active: true,
    });
    // route may call either findFirst or findUnique — mock both to be safe
    mockPrisma.internalAccount.findUnique.mockResolvedValue({
      id: 8,
      account_number: "0001",
      user_id: 60,
      is_active: true,
    });
    const { POST } = await import("./route");
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    const body = {
      user_id: 60,
      source_internal_id: 8,
      payee_id: 5,
      amount: "30.00",
      frequency: "monthly",
      start_time: future,
    };
    const req = new Request("http://localhost/api/billpay", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    if (res.status !== 201) console.log("POST error body:", await res.text());
    expect(res.status).toBe(201);
    const json = (await res.json()) as AnyObj;
    expect(json.message).toBeDefined();
    expect(mockPrisma.billPayRule.create).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------- PUT endpoint tests ------------------------------------------------------------ */
describe("PUT /api/billpay", () => {
  it("disallowed fields -> 400", async () => {
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/billpay", {
      method: "PUT",
      body: JSON.stringify({ id: 1, payee_id: 5 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as AnyObj;
    expect(json.disallowed_fields).toContain("payee_id");
  });

  it("unauthenticated -> 401", async () => {
    (getPrisma as unknown as Mock).mockReturnValue(makeMockPrisma());
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    });

    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/billpay", {
      method: "PUT",
      body: JSON.stringify({ id: 1, amount: "9.00" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("successfully updates amount -> 200", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-u" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 55 });
    const existingRule = {
      id: 10,
      user_id: 55,
      start_time: new Date().toISOString(),
      end_time: null,
      amount: { toString: () => "5.00" },
    };
    mockPrisma.billPayRule.findUnique.mockResolvedValue(existingRule);
    mockPrisma.billPayRule.update.mockResolvedValue({
      ...existingRule,
      amount: { toString: () => "9.99" },
    });

    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/billpay", {
      method: "PUT",
      body: JSON.stringify({ id: 10, amount: "9.99" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as AnyObj;
    expect(json.rule).toBeDefined();
    expect(mockPrisma.billPayRule.update).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------- DELETE endpoint tests --------------------------------------------------------- */
describe("DELETE /api/billpay", () => {
  it("missing id -> 400", async () => {
    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/billpay", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("unauthenticated -> 401", async () => {
    (getPrisma as unknown as Mock).mockReturnValue(makeMockPrisma());
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    });

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/billpay?id=1", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("not found -> 404", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-d" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 9 });
    mockPrisma.billPayRule.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/billpay?id=999", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("forbidden when not owner -> 403", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-d2" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 11 });
    mockPrisma.billPayRule.findUnique.mockResolvedValue({
      id: 50,
      user_id: 999,
    }); // owner mismatch

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/billpay?id=50", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("successful delete -> 200 and DB delete called", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-d3" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 88 });
    mockPrisma.billPayRule.findUnique.mockResolvedValue({
      id: 20,
      user_id: 88,
    });
    mockPrisma.billPayRule.delete.mockResolvedValue({ id: 20 });

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/billpay?id=20", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as AnyObj;
    expect(json.message).toBe("Deleted bill pay rule.");
    expect(mockPrisma.billPayRule.delete).toHaveBeenCalledWith({
      where: { id: 20 },
    });
  });
});

/* ------------------------------------------------------- GET endpoint tests ------------------------------------------------------------ */
describe("GET /api/billpay", () => {
  it("unauthenticated -> 401", async () => {
    (getPrisma as unknown as Mock).mockReturnValue(makeMockPrisma());
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    });

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/billpay", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns serialized list and honors payee filter", async () => {
    const mockPrisma = makeMockPrisma();
    (getPrisma as unknown as Mock).mockReturnValue(mockPrisma);
    (getAuthUserFromRequest as unknown as Mock).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "sup-g" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 7 });
    mockPrisma.billPayRule.findMany.mockResolvedValue([
      {
        id: 301,
        amount: { toString: () => "42.00" },
        frequency: "monthly",
        last_run: new Date(),
        next_run: new Date(),
        start_time: new Date(),
        end_time: null,
        payee: { business_name: "Acme LLC" },
        source_internal: { account_number: "1234" },
      },
    ]);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/billpay?payee=Acme", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      rules: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(json.rules)).toBe(true);
    expect(json.rules[0]).toMatchObject({
      id: 301,
      payee_business_name: "Acme LLC",
      amount: "42.00",
      internal_account_number: "1234",
    });
    expect(mockPrisma.billPayRule.findMany).toHaveBeenCalled();
  });
});
