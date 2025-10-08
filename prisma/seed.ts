import {
  PrismaClient,
  RoleEnum,
  AccountTypeEnum,
  TransactionStatusEnum,
  TransactionTypeEnum,
  PaymentDirection,
  USStateTerritory,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data (order matters due to FKs)
  // Wrapped in try-catch for when database is freshly reset
  try {
    await prisma.$transaction([
      prisma.transaction.deleteMany({}),
      prisma.transferRule.deleteMany({}),
      prisma.billPayRule.deleteMany({}),
      prisma.billPayPayee.deleteMany({}),
      prisma.internalAccount.deleteMany({}),
      prisma.externalAccount.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);
  } catch {
    console.log("Database is empty or freshly reset, skipping cleanup");
  }

  // Users: create in Supabase Auth (require service role) and link via auth_user_id
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as
    | string
    | undefined;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as
    | string
    | undefined;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Seeding requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to set real auth_user_id values.",
    );
  }
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

  async function findSupabaseUserIdByEmail(
    email: string,
  ): Promise<string | null> {
    // Paginate through users and match by email (small project scale)
    let page = 1;
    const perPage = 1000;
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      const match = data.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      if (match) return match.id;
      if (data.users.length < perPage) break; // no more pages
      page += 1;
    }
    return null;
  }

  type SeedUser = {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    street_address: string;
    address_line_2?: string;
    city: string;
    state_or_territory: keyof typeof USStateTerritory;
    postal_code: string;
    role: keyof typeof RoleEnum;
    supabase_password: string; // used only when creating Supabase auth users
  };

  const usersToCreate: SeedUser[] = [
    {
      username: "manager",
      first_name: "Morgan",
      last_name: "Banks",
      email: "manager@example.com",
      phone_number: "+15550000001",
      street_address: "1 Manager Way",
      city: "San Francisco",
      state_or_territory: "CA",
      postal_code: "94105",
      role: "bank_manager",
      supabase_password: "Password123!",
    },
    {
      username: "ava",
      first_name: "Ava",
      last_name: "Smith",
      email: "ava@example.com",
      phone_number: "+15550001001",
      street_address: "100 Main St",
      city: "Daly City",
      state_or_territory: "CA",
      postal_code: "94016",
      role: "customer",
      supabase_password: "Password123!",
    },
    {
      username: "liam",
      first_name: "Liam",
      last_name: "Jones",
      email: "liam@example.com",
      phone_number: "+15550001002",
      street_address: "200 Main St",
      city: "Daly City",
      state_or_territory: "CA",
      postal_code: "94016",
      role: "customer",
      supabase_password: "Password123!",
    },
  ];

  const createdUsers = [] as { id: number; email: string }[];

  for (const u of usersToCreate) {
    // Use existing Supabase user if found, otherwise create a new one
    let authUserId: string | null = await findSupabaseUserIdByEmail(u.email);
    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.supabase_password,
        email_confirm: true,
      });
      if (error) {
        throw new Error(
          `Supabase admin createUser failed for ${u.email}: ${error.message}`,
        );
      }
      authUserId = data.user!.id;
    }

    if (!authUserId) {
      throw new Error(`Failed to get auth_user_id for ${u.email}`);
    }

    const created = await prisma.user.create({
      data: {
        username: u.username,
        auth_user_id: authUserId,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        phone_number: u.phone_number,
        street_address: u.street_address,
        address_line_2: u.address_line_2,
        city: u.city,
        state_or_territory: USStateTerritory[u.state_or_territory],
        postal_code: u.postal_code,
        role: RoleEnum[u.role],
      },
    });
    createdUsers.push({ id: created.id, email: created.email });
  }

  const manager = await prisma.user.findUniqueOrThrow({
    where: { username: "manager" },
  });
  const ava = await prisma.user.findUniqueOrThrow({
    where: { username: "ava" },
  });
  const liam = await prisma.user.findUniqueOrThrow({
    where: { username: "liam" },
  });

  // Internal Accounts
  const [_bankOpsAccount, avaChecking, _avaSavings, liamChecking] =
    await prisma.$transaction([
      prisma.internalAccount.create({
        data: {
          user_id: manager.id,
          account_number: "10000001",
          account_type: AccountTypeEnum.checking,
          is_active: true,
          balance: 100000,
        },
      }),
      prisma.internalAccount.create({
        data: {
          user_id: ava.id,
          account_number: "20000001",
          account_type: AccountTypeEnum.checking,
          is_active: true,
          balance: 2500.5,
        },
      }),
      prisma.internalAccount.create({
        data: {
          user_id: ava.id,
          account_number: "20000002",
          account_type: AccountTypeEnum.savings,
          is_active: true,
          balance: 5000,
        },
      }),
      prisma.internalAccount.create({
        data: {
          user_id: liam.id,
          account_number: "30000001",
          account_type: AccountTypeEnum.checking,
          is_active: true,
          balance: 1250.75,
        },
      }),
    ]);

  // Transactions
  await prisma.$transaction([
    // Ava transfers to savings (internal)
    prisma.transaction.create({
      data: {
        internal_account_id: avaChecking.id,
        amount: 500,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.internal_transfer,
        direction: PaymentDirection.outbound,
      },
    }),
    // Payroll from bank ops to Ava (inbound)
    prisma.transaction.create({
      data: {
        internal_account_id: avaChecking.id,
        amount: 1000,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.external_transfer,
        direction: PaymentDirection.inbound,
        external_routing_number: "121000000",
        external_account_number: "99999999",
      },
    }),
    // Failed transaction from Liam
    prisma.transaction.create({
      data: {
        internal_account_id: liamChecking.id,
        amount: 50.25,
        status: TransactionStatusEnum.denied,
        transaction_type: TransactionTypeEnum.external_transfer,
        direction: PaymentDirection.outbound,
      },
    }),
    // Cash deposit to Liam
    prisma.transaction.create({
      data: {
        internal_account_id: liamChecking.id,
        amount: 200,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.deposit,
        direction: PaymentDirection.inbound,
      },
    }),
    // ATM withdrawal from Ava
    prisma.transaction.create({
      data: {
        internal_account_id: avaChecking.id,
        amount: 75,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.withdrawal,
        direction: PaymentDirection.outbound,
      },
    }),
  ]);

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
