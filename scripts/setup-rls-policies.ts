/**
 * Script to set up Supabase Storage RLS policies for 'checks' bucket
 * This uses a direct database connection with service role permissions
 * Run: pnpm tsx scripts/setup-rls-policies.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nAlternatively, you can use DIRECT_URL or DATABASE_URL");
  if (!databaseUrl) {
    process.exit(1);
  }
}

async function setupRLSPolicies() {
  console.log("Setting up RLS policies for 'checks' storage bucket...\n");

  // Try using Supabase admin client first (preferred method)
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      console.log("Using Supabase admin client...");

      // Get the admin database connection
      const { data: dbData, error: dbError } = await supabase.rpc("exec_sql", {
        sql: `
          -- Ensure RLS is enabled
          ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
          
          -- Drop existing policies
          DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
          DROP POLICY IF EXISTS "Users can read from their own folder" ON storage.objects;
          DROP POLICY IF EXISTS "Users can delete from their own folder" ON storage.objects;
          DROP POLICY IF EXISTS "Public can read check images" ON storage.objects;
          DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
          DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
          DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
        `,
      });

      // Fall back to direct database connection
      if (dbError) {
        console.log(
          "RPC method not available, using direct database connection...",
        );
        throw new Error("RPC not available");
      }
    } catch (error) {
      // Fall through to direct database connection method
    }
  }

  // Use direct database connection with service role if available
  if (databaseUrl) {
    console.log("Using direct database connection...");

    // If we have service role key, try to construct connection with it
    let connectionString = databaseUrl;
    if (supabaseServiceKey && databaseUrl.includes("@")) {
      // Replace password in connection string with service role key
      const urlParts = new URL(databaseUrl);
      urlParts.password = supabaseServiceKey;
      connectionString = urlParts.toString();
    }

    const pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    try {
      // Ensure RLS is enabled
      console.log("1. Ensuring RLS is enabled...");
      await pool.query(`
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      `);
      console.log("   ✓ RLS enabled\n");

      // Drop existing policies that might conflict
      console.log("2. Dropping existing policies...");
      const dropPolicies = [
        "Users can upload to their own folder",
        "Users can read from their own folder",
        "Users can delete from their own folder",
        "Public can read check images",
        "Authenticated users can upload",
        "Authenticated users can read",
        "Authenticated users can delete",
      ];

      for (const policyName of dropPolicies) {
        try {
          await pool.query(
            `DROP POLICY IF EXISTS "${policyName}" ON storage.objects;`,
          );
        } catch (error) {
          // Ignore errors if policy doesn't exist
          console.log(`   - Policy "${policyName}" not found (skipping)`);
        }
      }
      console.log("   ✓ Policies cleared\n");

      // Create new policies
      console.log("3. Creating new policies...");

      // Policy 1: Allow authenticated users to upload
      await pool.query(`
        CREATE POLICY "Authenticated users can upload"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'checks');
      `);
      console.log("   ✓ Created upload policy");

      // Policy 2: Allow authenticated users to read
      await pool.query(`
        CREATE POLICY "Authenticated users can read"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'checks');
      `);
      console.log("   ✓ Created read policy");

      // Policy 3: Allow public read access (for Groq API)
      await pool.query(`
        CREATE POLICY "Public can read check images"
        ON storage.objects
        FOR SELECT
        TO public
        USING (bucket_id = 'checks');
      `);
      console.log("   ✓ Created public read policy");

      // Policy 4: Allow authenticated users to delete
      await pool.query(`
        CREATE POLICY "Authenticated users can delete"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (bucket_id = 'checks');
      `);
      console.log("   ✓ Created delete policy\n");

      console.log("✓ All RLS policies created successfully!");
      console.log("\nYou can now upload check images.");

      await pool.end();
      return;
    } catch (error) {
      console.error("\n❌ Error setting up policies:", error);
      if (error instanceof Error) {
        console.error("   Message:", error.message);
      }
      await pool.end();
      throw error;
    }
  }

  throw new Error("No database connection available");
}

setupRLSPolicies()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
