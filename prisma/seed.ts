import {
  PrismaClient,
  RoleEnum,
  AccountTypeEnum,
  TransactionStatusEnum,
  TransactionTypeEnum,
  Prisma,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data (order matters due to FKs)
  await prisma.$transaction([
    prisma.paymentRule.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.account.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

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
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    role: RoleEnum;
    zip_code: number;
    password: string; // used only when creating auth users
  };

  const usersToCreate: SeedUser[] = [
    {
      user_id: "mgr-0001",
      first_name: "Morgan",
      last_name: "Banks",
      email: "manager@example.com",
      phone: "555-0001",
      address: "1 Manager Way, San Francisco, CA",
      role: RoleEnum.bank_manager,
      zip_code: 94105,
      password: "Password123!",
    },
    {
      user_id: "cust-1001",
      first_name: "Ava",
      last_name: "Smith",
      email: "ava@example.com",
      phone: "555-1001",
      address: "100 Main St, Daly City, CA",
      role: RoleEnum.customer,
      zip_code: 94016,
      password: "Password123!",
    },
    {
      user_id: "cust-1002",
      first_name: "Liam",
      last_name: "Jones",
      email: "liam@example.com",
      phone: "555-1002",
      address: "200 Main St, Daly City, CA",
      role: RoleEnum.customer,
      zip_code: 94016,
      password: "Password123!",
    },
  ];

  const createdUsers = [] as { id: number; email: string }[];

  for (const u of usersToCreate) {
    // Use existing Supabase user if found, otherwise create a new one
    let authUserId: string | null = await findSupabaseUserIdByEmail(u.email);
    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) {
        throw new Error(
          `Supabase admin createUser failed for ${u.email}: ${error.message}`,
        );
      }
      authUserId = data.user!.id;
    }

    const userData = {
      user_id: u.user_id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      role: u.role,
      zip_code: u.zip_code,
      auth_user_id: authUserId,
    } satisfies Prisma.UserCreateInput;

    const created = await prisma.user.create({
      data: userData,
    });
    createdUsers.push({ id: created.id, email: created.email ?? "" });
  }

  const manager = await prisma.user.findUniqueOrThrow({
    where: { user_id: "mgr-0001" },
  });
  const ava = await prisma.user.findUniqueOrThrow({
    where: { user_id: "cust-1001" },
  });
  const liam = await prisma.user.findUniqueOrThrow({
    where: { user_id: "cust-1002" },
  });

  // Accounts
  const [bankOps, avaChk, avaSav, liamChk] = await prisma.$transaction([
    prisma.account.create({
      data: {
        userId: manager.id,
        account_number: 10000001,
        routing_number: 121000000,
        account_type: AccountTypeEnum.checkings,
        active: true,
        balance: 100000,
        is_internal: true,
      },
    }),
    prisma.account.create({
      data: {
        userId: ava.id,
        account_number: 20000001,
        routing_number: 121000000,
        account_type: AccountTypeEnum.checkings,
        active: true,
        balance: 2500.5,
        is_internal: true,
      },
    }),
    prisma.account.create({
      data: {
        userId: ava.id,
        account_number: 20000002,
        routing_number: 121000000,
        account_type: AccountTypeEnum.savings,
        active: true,
        balance: 5000,
        is_internal: true,
      },
    }),
    prisma.account.create({
      data: {
        userId: liam.id,
        account_number: 30000001,
        routing_number: 121000000,
        account_type: AccountTypeEnum.checkings,
        active: true,
        balance: 1250.75,
        is_internal: true,
      },
    }),
  ]);

  // Transactions
  await prisma.$transaction([
    // Ava transfers to savings (internal)
    prisma.transaction.create({
      data: {
        sourceAccountId: avaChk.id,
        destinationAccountId: avaSav.id,
        amount: 500,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.internal_transfer,
      },
    }),
    // Payroll from bank ops to Ava (external)
    prisma.transaction.create({
      data: {
        sourceAccountId: bankOps.id,
        destinationAccountId: avaChk.id,
        amount: 1000,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.external_transfer,
      },
    }),
    // Failed bill pay from Liam to bank ops
    prisma.transaction.create({
      data: {
        sourceAccountId: liamChk.id,
        destinationAccountId: bankOps.id,
        amount: 50.25,
        status: TransactionStatusEnum.denial,
        transaction_type: TransactionTypeEnum.external_transfer,
      },
    }),
    // Cash deposit to Liam
    prisma.transaction.create({
      data: {
        sourceAccountId: null,
        destinationAccountId: liamChk.id,
        amount: 200,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.deposit,
      },
    }),
    // ATM withdrawal from Ava
    prisma.transaction.create({
      data: {
        sourceAccountId: avaChk.id,
        destinationAccountId: null,
        amount: 75,
        status: TransactionStatusEnum.approved,
        transaction_type: TransactionTypeEnum.withdrawal,
      },
    }),
  ]);

  // Payment rules
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(now.getMonth() + 1);

  await prisma.$transaction([
    prisma.paymentRule.create({
      data: {
        sourceAccountId: avaChk.id,
        destinationAccountId: avaSav.id,
        amount: 100,
        frequency: "0 0 1 * *", // monthly
        start_time: now,
        end_time: null,
      },
    }),
    prisma.paymentRule.create({
      data: {
        sourceAccountId: liamChk.id,
        destinationAccountId: bankOps.id,
        amount: 45,
        frequency: "0 0 1 * *", // monthly
        start_time: nextMonth,
        end_time: null,
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
