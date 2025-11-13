import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// Make React available globally for test files using JSX
// This is necessary because test files use JSX syntax which requires React in scope
global.React = React;

// Mock PrismaClient to prevent DATABASE_URL requirement during tests
// This prevents PrismaClient from trying to initialize when modules are imported
// We use importOriginal to preserve other exports like enums (USStateTerritory, etc.)
vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  const mockPrismaClient = vi.fn(() => ({
    $extends: vi.fn((extensions) => mockPrismaClient()),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  }));
  return {
    ...actual,
    PrismaClient: mockPrismaClient,
  };
});

// Set a dummy DATABASE_URL to prevent Prisma schema validation errors
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

// Next.js router/navigation minimal mocks for component tests
vi.mock("next/navigation", async () => {
  const actual =
    await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    usePathname: () => "/",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

// Supabase browser client mock to avoid env requirement in tests
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({}),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
    },
  }),
}));
