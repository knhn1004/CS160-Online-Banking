import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

/**
 * @swagger
 * /api/accounts/external:
 *   get:
 *     summary: Get user's external accounts
 *     description: Retrieves all saved external accounts for the authenticated user
 *     tags:
 *       - Accounts
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved external accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       user_id:
 *                         type: integer
 *                       routing_number:
 *                         type: string
 *                       account_number:
 *                         type: string
 *                       nickname:
 *                         type: string
 *                         nullable: true
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not onboarded
 *   post:
 *     summary: Create external account
 *     description: Saves a new external bank account for the authenticated user to enable transfers
 *     tags:
 *       - Accounts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routing_number
 *               - account_number
 *             properties:
 *               routing_number:
 *                 type: string
 *                 pattern: '^\d{9}$'
 *                 example: "123456789"
 *               account_number:
 *                 type: string
 *                 maxLength: 17
 *                 example: "9876543210"
 *               nickname:
 *                 type: string
 *                 maxLength: 30
 *                 example: "Chase Savings"
 *     responses:
 *       201:
 *         description: External account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     user_id:
 *                       type: integer
 *                       example: 1
 *                     routing_number:
 *                       type: string
 *                       example: "123456789"
 *                     account_number:
 *                       type: string
 *                       example: "9876543210"
 *                     nickname:
 *                       type: string
 *                       nullable: true
 *                       example: "Chase Savings"
 *       400:
 *         description: Bad Request - Invalid routing number, account number, or nickname
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Routing number must be exactly 9 digits"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: Not Found - User not found or not onboarded
 *       409:
 *         description: Conflict - External account already exists for this user
 *       500:
 *         description: Internal Server Error - Failed to create external account
 */

interface CreateExternalAccountRequest {
  routing_number: string;
  account_number: string;
  nickname?: string;
}

export async function GET(request: Request) {
  // Auth check
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }

  // Get current user with external accounts
  const currentUser = await getPrisma().user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
    include: { external_accounts: true },
  });

  if (!currentUser) {
    return new Response(
      JSON.stringify({
        error: { message: "User not onboarded" },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }

  // Format response
  const accounts = currentUser.external_accounts.map((account) => ({
    id: account.id,
    user_id: account.user_id,
    routing_number: account.routing_number,
    account_number: account.account_number,
    nickname: account.nickname,
  }));

  return new Response(JSON.stringify({ accounts }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

export async function POST(request: Request) {
  // Auth check
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }

  // Get current user
  const currentUser = await getPrisma().user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
  });

  if (!currentUser) {
    return new Response(
      JSON.stringify({
        error: { message: "User not onboarded" },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }

  try {
    const data = (await request.json()) as CreateExternalAccountRequest;

    // Validate routing number
    if (!data.routing_number || !/^\d{9}$/.test(data.routing_number)) {
      return new Response(
        JSON.stringify({
          error: { message: "Routing number must be exactly 9 digits" },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Validate account number
    if (
      !data.account_number ||
      data.account_number.length === 0 ||
      data.account_number.length > 17
    ) {
      return new Response(
        JSON.stringify({
          error: {
            message:
              "Account number is required and cannot exceed 17 characters",
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Validate nickname if provided
    if (data.nickname && data.nickname.length > 30) {
      return new Response(
        JSON.stringify({
          error: { message: "Nickname cannot exceed 30 characters" },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Create external account
    const account = await getPrisma().externalAccount.create({
      data: {
        user_id: currentUser.id,
        routing_number: data.routing_number,
        account_number: data.account_number,
        nickname: data.nickname || null,
      },
    });

    return new Response(
      JSON.stringify({
        account: {
          id: account.id,
          user_id: account.user_id,
          routing_number: account.routing_number,
          account_number: account.account_number,
          nickname: account.nickname,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 201,
      },
    );
  } catch (error) {
    // Handle unique constraint violations (duplicate external account)
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        return new Response(
          JSON.stringify({
            error: {
              message: "This external account is already saved",
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 409,
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to create external account",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
