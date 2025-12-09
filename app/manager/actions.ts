"use server";

import { getPrisma } from "@/app/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { User, Transaction, InternalAccount } from "@prisma/client";

// Use Prisma generated types with select fields
export type ManagerUser = Pick<
  User,
  | "id"
  | "username"
  | "first_name"
  | "last_name"
  | "email"
  | "role"
  | "created_at"
  | "state_or_territory"
> & {
  _count: {
    internal_accounts: number;
  };
};

export type ManagerTransaction = Pick<
  Transaction,
  "id" | "created_at" | "status" | "transaction_type" | "direction"
> & {
  amount: number; // Converted from Decimal to number for client components
  internal_account: {
    account_number: string;
    user: Pick<User, "id" | "username" | "first_name" | "last_name">;
  };
};

export type DetailedUser = Pick<
  User,
  | "id"
  | "username"
  | "first_name"
  | "last_name"
  | "email"
  | "phone_number"
  | "street_address"
  | "address_line_2"
  | "city"
  | "state_or_territory"
  | "postal_code"
  | "country"
  | "role"
  | "created_at"
> & {
  internal_accounts: (Pick<
    InternalAccount,
    "id" | "account_number" | "account_type" | "is_active"
  > & {
    balance: number; // Converted from Decimal to number for client components
  })[];
  _count: {
    internal_accounts: number;
  };
};

export type DetailedTransaction = Pick<
  Transaction,
  | "id"
  | "created_at"
  | "status"
  | "transaction_type"
  | "direction"
  | "check_number"
  | "external_routing_number"
  | "external_account_number"
  | "external_nickname"
> & {
  amount: number; // Converted from Decimal to number for client components
  internal_account: {
    account_number: string;
    user: Pick<User, "id" | "username" | "first_name" | "last_name" | "email">;
  };
};

// Helper function to verify manager role
async function verifyManagerRole(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return false;
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { auth_user_id: supabaseUser.id },
      select: { role: true },
    });

    return user?.role === "bank_manager";
  } catch {
    return false;
  }
}

// Get all users with optional filters
export async function getUsers(params: {
  search?: string;
  role?: string;
  state?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: ManagerUser[]; total: number }> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const { search, role, state, page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { first_name: { contains: search, mode: "insensitive" } },
      { last_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (state) {
    where.state_or_territory = state;
  }

  const prisma = getPrisma();
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        created_at: true,
        state_or_territory: true,
        _count: {
          select: {
            internal_accounts: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

// Get single user with detailed information
export async function getUserById(
  userId: number,
): Promise<DetailedUser | null> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
      street_address: true,
      address_line_2: true,
      city: true,
      state_or_territory: true,
      postal_code: true,
      country: true,
      role: true,
      created_at: true,
      internal_accounts: {
        select: {
          id: true,
          account_number: true,
          account_type: true,
          balance: true,
          is_active: true,
        },
        orderBy: { created_at: "desc" },
      },
      _count: {
        select: {
          internal_accounts: true,
        },
      },
    },
  });

  // Convert Decimal balances to numbers for client components
  return user
    ? {
        ...user,
        internal_accounts: user.internal_accounts.map((account) => ({
          ...account,
          balance: Number(account.balance),
        })),
      }
    : null;
}

// Get all transactions with optional filters
export async function getTransactions(params: {
  search?: string;
  type?: string;
  status?: string;
  direction?: string;
  page?: number;
  limit?: number;
}): Promise<{ transactions: ManagerTransaction[]; total: number }> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const { search, type, status, direction, page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      {
        internal_account: {
          user: {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  if (type) {
    where.transaction_type = type;
  }

  if (status) {
    where.status = status;
  }

  if (direction) {
    where.direction = direction;
  }

  const prisma = getPrisma();
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        amount: true,
        status: true,
        transaction_type: true,
        direction: true,
        internal_account: {
          select: {
            account_number: true,
            user: {
              select: {
                id: true,
                username: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  // Convert Decimal amounts to numbers for client components
  const transactionsWithNumbers = transactions.map((transaction) => ({
    ...transaction,
    amount: Number(transaction.amount),
  }));

  return { transactions: transactionsWithNumbers, total };
}

// Get single transaction with detailed information
export async function getTransactionById(
  transactionId: number,
): Promise<DetailedTransaction | null> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const prisma = getPrisma();
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      created_at: true,
      amount: true,
      status: true,
      transaction_type: true,
      direction: true,
      check_number: true,
      external_routing_number: true,
      external_account_number: true,
      external_nickname: true,
      internal_account: {
        select: {
          account_number: true,
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  // Convert Decimal amount to number for client components
  return transaction
    ? {
        ...transaction,
        amount: Number(transaction.amount),
      }
    : null;
}

// Get user's recent transactions
export async function getUserTransactions(
  userId: number,
  limit = 10,
): Promise<ManagerTransaction[]> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const prisma = getPrisma();
  const transactions = await prisma.transaction.findMany({
    where: {
      internal_account: {
        user_id: userId,
      },
    },
    select: {
      id: true,
      created_at: true,
      amount: true,
      status: true,
      transaction_type: true,
      direction: true,
      internal_account: {
        select: {
          account_number: true,
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  // Convert Decimal amounts to numbers for client components
  const transactionsWithNumbers = transactions.map((transaction) => ({
    ...transaction,
    amount: Number(transaction.amount),
  }));

  return transactionsWithNumbers;
}

// Generate unique account number (shared utility)
async function generateUniqueAccountNumber(): Promise<string> {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate 17-digit account number
    const accountNumber = Array.from({ length: 17 }, () =>
      Math.floor(Math.random() * 10),
    ).join("");

    // Check if account number exists
    const existing = await getPrisma().internalAccount.findUnique({
      where: { account_number: accountNumber },
    });

    if (!existing) {
      return accountNumber;
    }

    attempts++;
  }

  throw new Error(
    "Failed to generate unique account number after multiple attempts",
  );
}

// Open account for a user (manager only)
export async function openAccountForUser(
  userId: number,
  accountType: "checking" | "savings",
  initialDeposit?: number,
): Promise<{
  success: boolean;
  account?: {
    id: number;
    account_number: string;
    routing_number: string;
    account_type: "checking" | "savings";
    balance: number;
    is_active: boolean;
    created_at: Date;
  };
  error?: string;
}> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    return {
      success: false,
      error: "Unauthorized: Manager role required",
    };
  }

  const prisma = getPrisma();

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      success: false,
      error: "User not found",
    };
  }

  // Validate account type
  if (!["checking", "savings"].includes(accountType)) {
    return {
      success: false,
      error: "Invalid account type",
    };
  }

  try {
    const accountNumber = await generateUniqueAccountNumber();

    // Create account
    const account = await prisma.internalAccount.create({
      data: {
        account_type: accountType,
        account_number: accountNumber,
        balance: initialDeposit || 0,
        user_id: userId,
        is_active: true,
      },
    });

    // Invalidate cache for the user
    const { revalidateTag } = await import("next/cache");
    await revalidateTag(`user-${user.id}`);
    await revalidateTag(`accounts-${user.id}`);

    return {
      success: true,
      account: {
        id: account.id,
        account_number: account.account_number,
        routing_number: account.routing_number,
        account_type: account.account_type,
        balance: Number(account.balance),
        is_active: account.is_active,
        created_at: account.created_at,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create account",
    };
  }
}

// Close account for a user (manager only)
export async function closeAccountForUser(accountId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    return {
      success: false,
      error: "Unauthorized: Manager role required",
    };
  }

  const prisma = getPrisma();

  try {
    // Get account with user info for cache invalidation
    const account = await prisma.internalAccount.findUnique({
      where: { id: accountId },
      select: { user_id: true, balance: true },
    });

    if (!account) {
      return {
        success: false,
        error: "Account not found",
      };
    }

    // Check if account has zero balance
    if (Number(account.balance) !== 0) {
      return {
        success: false,
        error: "Account must have zero balance before closing",
      };
    }

    // Update account to inactive
    await prisma.internalAccount.update({
      where: { id: accountId },
      data: { is_active: false },
    });

    // Invalidate cache for the user
    const { revalidateTag } = await import("next/cache");
    await revalidateTag(`user-${account.user_id}`);
    await revalidateTag(`accounts-${account.user_id}`);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to close account",
    };
  }
}
