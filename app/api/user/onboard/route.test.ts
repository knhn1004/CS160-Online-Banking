// ...existing code...
import { vi, beforeEach, describe, test, expect } from "vitest";
import type { Mock } from "vitest";

type PrismaMock = { user: { findUnique: Mock; createMany: Mock } };

vi.mock("@/utils/supabase/server", () => {
  const createClient = vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      updateUser: vi.fn().mockResolvedValue({}),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: () => {} } },
      })),
    },
  }));
  return { createClient };
});

vi.mock("@/app/lib/prisma", () => {
  const findUnique = vi.fn().mockResolvedValue(null);
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const sharedPrisma = { user: { findUnique, createMany } };
  const getPrisma = vi.fn().mockReturnValue(sharedPrisma);
  return { getPrisma };
});

import { POST } from "./route";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";

// Helper typed wrappers to avoid using `any` casts in tests
const createClientMock = createClient as unknown as {
  mockReturnValue: (v: unknown) => void;
  mockImplementation?: unknown;
};
const getPrismaFactory = getPrisma as unknown as () => unknown;

describe("POST /api/user/onboard", () => {
  beforeEach(() => {
    // Clear call history but preserve top-level mockReturnValue set by vi.mock factories
    vi.clearAllMocks();
  });

  test("returns 401 when not authenticated", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        updateUser: vi.fn(),
      },
    });

    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 200 when user already exists and clears draft", async () => {
    const fakeUser = {
      id: "u1",
      user_metadata: { profileDraft: { username: "a", email: "a@b.com" } },
    };
    const updateUserSpy = vi.fn().mockResolvedValue({});

    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }),
        updateUser: updateUserSpy,
      },
    });

    const prismaMock = getPrismaFactory() as unknown as PrismaMock;
    prismaMock.user.findUnique.mockResolvedValue({ id: "db1" });
    prismaMock.user.createMany = vi.fn();

    const res = await POST();
    expect(res.status).toBe(200);
    expect(updateUserSpy).toHaveBeenCalled();
  });

  test("returns 400 when no profileDraft present", async () => {
    const fakeUser = { id: "u2", user_metadata: {} as unknown };
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }),
        updateUser: vi.fn(),
      },
    });

    const prismaMock = getPrismaFactory() as unknown as PrismaMock;
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.createMany.mockResolvedValue({ count: 1 });

    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "No profile draft available.");
  });

  test("returns 400 for invalid draft schema (invalid state)", async () => {
    const badDraft = {
      username: "alice",
      firstName: "Alice",
      lastName: "L",
      email: "alice@example.com",
      city: "Town",
      stateOrTerritory: "XX", // invalid state code
      postalCode: "12345",
    };
    const fakeUser = { id: "u3", user_metadata: { profileDraft: badDraft } };
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }),
        updateUser: vi.fn(),
      },
    });

    const prismaMock = getPrismaFactory() as unknown as PrismaMock;
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.createMany = vi.fn();

    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Invalid draft.");
  });

  test("returns 400 for missing/invalid phone number after schema pass", async () => {
    const draftMissingPhone = {
      username: "bob",
      firstName: "Bob",
      lastName: "B",
      email: "bob@example.com",
      city: "Town",
      stateOrTerritory: "CA",
      postalCode: "94105",
    };
    const fakeUser = {
      id: "u4",
      user_metadata: { profileDraft: draftMissingPhone },
    };
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }),
        updateUser: vi.fn(),
      },
    });

    const prismaMock = getPrismaFactory() as unknown as PrismaMock;
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.createMany = vi.fn();

    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Invalid or missing phone number.");
  });

  test("creates user and returns 201 and clears profileDraft on success", async () => {
    const validDraft = {
      username: "carol",
      firstName: "Carol",
      lastName: "C",
      email: "carol@example.com",
      phoneNumber: "(555) 123-4567",
      streetAddress: "1 Main St",
      addressLine2: null,
      city: "San Francisco",
      stateOrTerritory: "CA",
      postalCode: "94105",
      country: "USA",
      role: "customer",
    };
    const fakeUser = { id: "u5", user_metadata: { profileDraft: validDraft } };
    const updateUserSpy = vi.fn().mockResolvedValue({});
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }),
        updateUser: updateUserSpy,
      },
    });

    const prismaMock = getPrismaFactory() as unknown as PrismaMock;
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.createMany.mockResolvedValue({ count: 1 });

    const res = await POST();
    expect(res.status).toBe(201);
    expect(prismaMock.user.createMany).toHaveBeenCalled();
    expect(updateUserSpy).toHaveBeenCalled();
  });

  test("duplicate insert (createMany count 0) treated as success (200) and clears draft", async () => {
    const validDraft = {
      username: "dan",
      firstName: "Dan",
      lastName: "D",
      email: "dan@example.com",
      phoneNumber: "5551234567",
      streetAddress: "2 Main St",
      addressLine2: null,
      city: "City",
      stateOrTerritory: "CA",
      postalCode: "94105",
      country: "USA",
      role: "customer",
    };
    const fakeUser = { id: "u6", user_metadata: { profileDraft: validDraft } };
    const updateUserSpy = vi.fn().mockResolvedValue({});
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }),
        updateUser: updateUserSpy,
      },
    });

    const prismaMock = getPrismaFactory() as unknown as PrismaMock;
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.createMany.mockResolvedValue({ count: 0 });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(prismaMock.user.createMany).toHaveBeenCalled();
    expect(updateUserSpy).toHaveBeenCalled();
  });
});
