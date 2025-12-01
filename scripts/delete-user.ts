/**
 * Script to delete all user data from Supabase
 * Usage: pnpm tsx scripts/delete-user.ts <email>
 * Example: pnpm tsx scripts/delete-user.ts andy.k.liu@sjsu.edu
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findSupabaseUserIdByEmail(
  email: string,
): Promise<string | null> {
  // Paginate through users and match by email
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

async function deleteUserData(email: string) {
  console.log(`\n🔍 Searching for user with email: ${email}`);

  // Step 1: Try to find database user by email first (in case Auth user is already deleted)
  const dbUserByEmail = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      internal_accounts: {
        include: {
          transactions: {
            select: {
              id: true,
              check_image_url: true,
            },
          },
        },
      },
    },
  });

  let dbUser = dbUserByEmail;
  let authUserId: string | null = null;

  if (dbUser) {
    console.log(
      `✓ Found database user record (ID: ${dbUser.id}, username: ${dbUser.username})`,
    );
    authUserId = dbUser.auth_user_id;
    console.log(`   Auth user ID: ${authUserId}`);
  } else {
    // Step 2: Try to find Supabase Auth user
    authUserId = await findSupabaseUserIdByEmail(email);
    if (authUserId) {
      console.log(`✓ Found Supabase Auth user ID: ${authUserId}`);
      // Try to find database user by auth_user_id
      dbUser = await prisma.user.findUnique({
        where: { auth_user_id: authUserId },
        include: {
          internal_accounts: {
            include: {
              transactions: {
                select: {
                  id: true,
                  check_image_url: true,
                },
              },
            },
          },
        },
      });
      if (dbUser) {
        console.log(
          `✓ Found database user record (ID: ${dbUser.id}, username: ${dbUser.username})`,
        );
      }
    }
  }

  if (!dbUser && !authUserId) {
    console.log(`❌ No user found with email: ${email}`);
    console.log(`   (Checked both database and Supabase Auth)`);
    return;
  }

  if (!dbUser && authUserId) {
    console.log(`⚠️  No database user record found, but Auth user exists`);
    console.log(`   Deleting Auth user only...`);
    const { error: deleteError } =
      await supabase.auth.admin.deleteUser(authUserId);
    if (deleteError) {
      console.error(`❌ Error deleting Auth user:`, deleteError.message);
      return;
    }
    console.log(`✓ Deleted Supabase Auth user`);
    return;
  }

  if (!dbUser) {
    console.log(`❌ Database user record not found`);
    return;
  }

  // Step 3: Collect all check image URLs and paths
  const checkImagePaths: string[] = [];
  for (const account of dbUser.internal_accounts) {
    for (const transaction of account.transactions) {
      if (transaction.check_image_url) {
        // Extract path from URL
        // URL format: https://<project>.supabase.co/storage/v1/object/public/checks/<path>
        const urlMatch = transaction.check_image_url.match(/\/checks\/(.+)$/);
        if (urlMatch) {
          checkImagePaths.push(urlMatch[1]);
        }
      }
    }
  }

  if (checkImagePaths.length > 0) {
    console.log(
      `\n📁 Found ${checkImagePaths.length} check image(s) to delete`,
    );
  }

  // Step 4: Delete all related data in correct order (respecting foreign keys)
  console.log(`\n🗑️  Deleting user data...`);

  try {
    await prisma.$transaction(async (tx) => {
      // Delete transactions (they cascade from internal_accounts, but we'll delete explicitly)
      const transactionCount = await tx.transaction.deleteMany({
        where: {
          internal_account: {
            user_id: dbUser!.id,
          },
        },
      });
      console.log(`   ✓ Deleted ${transactionCount.count} transaction(s)`);

      // Delete transfer rules
      const transferRuleCount = await tx.transferRule.deleteMany({
        where: { user_id: dbUser!.id },
      });
      console.log(`   ✓ Deleted ${transferRuleCount.count} transfer rule(s)`);

      // Delete bill pay rules
      const billPayRuleCount = await tx.billPayRule.deleteMany({
        where: { user_id: dbUser!.id },
      });
      console.log(`   ✓ Deleted ${billPayRuleCount.count} bill pay rule(s)`);

      // Delete external accounts
      const externalAccountCount = await tx.externalAccount.deleteMany({
        where: { user_id: dbUser!.id },
      });
      console.log(
        `   ✓ Deleted ${externalAccountCount.count} external account(s)`,
      );

      // Delete API keys (cascade from user and internal_accounts)
      const apiKeyCount = await tx.apiKey.deleteMany({
        where: { user_id: dbUser!.id },
      });
      console.log(`   ✓ Deleted ${apiKeyCount.count} API key(s)`);

      // Delete internal accounts (cascade deletes transactions and api_keys)
      const internalAccountCount = await tx.internalAccount.deleteMany({
        where: { user_id: dbUser!.id },
      });
      console.log(
        `   ✓ Deleted ${internalAccountCount.count} internal account(s)`,
      );

      // Delete user record
      await tx.user.delete({
        where: { id: dbUser!.id },
      });
      console.log(`   ✓ Deleted user record`);
    });

    // Step 5: Delete check images from storage
    if (checkImagePaths.length > 0) {
      console.log(`\n🗑️  Deleting check images from storage...`);
      const { data: deletedFiles, error: storageError } = await supabase.storage
        .from("checks")
        .remove(checkImagePaths);

      if (storageError) {
        console.error(
          `   ⚠️  Error deleting some files:`,
          storageError.message,
        );
      } else {
        console.log(
          `   ✓ Deleted ${deletedFiles?.length || 0} file(s) from storage`,
        );
      }
    }

    // Step 6: Delete Supabase Auth user (if it exists)
    if (authUserId) {
      console.log(`\n🗑️  Deleting Supabase Auth user...`);
      const { error: deleteError } =
        await supabase.auth.admin.deleteUser(authUserId);
      if (deleteError) {
        console.error(`   ⚠️  Error deleting Auth user:`, deleteError.message);
        console.log(`   (This is okay if the Auth user was already deleted)`);
      } else {
        console.log(`   ✓ Deleted Supabase Auth user`);
      }
    } else {
      console.log(`\n⚠️  No Auth user ID found, skipping Auth user deletion`);
    }

    console.log(`\n✅ Successfully deleted all data for user: ${email}`);
  } catch (error) {
    console.error(`\n❌ Error deleting user data:`, error);
    throw error;
  }
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: pnpm tsx scripts/delete-user.ts <email>");
    console.error(
      "Example: pnpm tsx scripts/delete-user.ts andy.k.liu@sjsu.edu",
    );
    process.exit(1);
  }

  try {
    await deleteUserData(email);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
