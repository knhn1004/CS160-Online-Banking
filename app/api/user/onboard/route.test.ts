import { vi, beforeEach, describe, test, expect } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getAuthUserFromRequest: vi.fn(),
}));
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("POST /api/user/onboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/user/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("message", "Invalid JSON body");
  });

  test("returns 422 when payload validation fails", async () => {
    // send an empty object which should fail the OnboardSchema validation
    const req = new Request("http://localhost/api/user/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const body = (await res.json()) as { message?: string; issues?: unknown };
    expect(body).toHaveProperty("message");
    expect(body.message).toMatch(/validation failed/i);
    expect(body).toHaveProperty("issues");
    expect(Array.isArray(body.issues)).toBe(true);
    expect((body.issues as unknown[]).length).toBeGreaterThan(0);
  });
});
