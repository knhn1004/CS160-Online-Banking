import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { BillPayRuleUpdateSchema } from "@/lib/schemas/billpay";
import { Decimal } from "@prisma/client/runtime/library";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Helper function to unschedule a pg_cron job for a billpay rule
 */
async function unscheduleCronJob(ruleId: number): Promise<void> {
  const prisma = getPrisma();
  const jobName = `billpay_rule_${ruleId}`;

  try {
    await prisma.$executeRawUnsafe(`SELECT cron.unschedule($1::text)`, jobName);
  } catch (error) {
    // If job doesn't exist, that's okay - just log it
    console.warn(`Failed to unschedule cron job ${jobName}:`, error);
  }
}

/**
 * Helper function to schedule a pg_cron job for a billpay rule
 */
async function scheduleCronJob(
  ruleId: number,
  frequency: string,
): Promise<void> {
  const prisma = getPrisma();
  const jobName = `billpay_rule_${ruleId}`;

  // Schedule the cron job to call the process_billpay_rule function
  // Note: This assumes the function exists in the database (created via migration)
  // pg_cron.schedule(job_name, schedule, command)
  // Use parameterized query to prevent SQL injection
  await prisma.$executeRawUnsafe(
    `SELECT cron.schedule($1, $2, $3)`,
    jobName,
    frequency,
    `SELECT process_billpay_rule(${ruleId})`,
  );
}

/**
 * @swagger
 * /api/billpay/rules/{id}:
 *   put:
 *     summary: Update a billpay rule
 *     description: Updates a billpay rule and reschedules its cron job if frequency changes
 *     tags:
 *       - Billpay
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source_account_id:
 *                 type: integer
 *               payee_id:
 *                 type: integer
 *               amount:
 *                 type: string
 *               frequency:
 *                 type: string
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *     responses:
 *       200:
 *         description: Billpay rule updated successfully
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded or rule not found
 *       403:
 *         description: Forbidden - Rule does not belong to user
 *       500:
 *         description: Internal Server Error
 *   delete:
 *     summary: Delete a billpay rule
 *     description: Deletes a billpay rule and unschedules its cron job
 *     tags:
 *       - Billpay
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Billpay rule deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded or rule not found
 *       403:
 *         description: Forbidden - Rule does not belong to user
 *       500:
 *         description: Internal Server Error
 */

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Await params in Next.js 15
  const { id } = await params;

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
    include: { internal_accounts: true },
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
    const ruleId = parseInt(id, 10);
    if (isNaN(ruleId)) {
      return new Response(
        JSON.stringify({
          error: "Invalid rule ID",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Find rule and verify ownership
    const rule = await getPrisma().billPayRule.findUnique({
      where: { id: ruleId },
      include: {
        payee: true,
        source_internal: true,
      },
    });

    if (!rule) {
      return new Response(
        JSON.stringify({
          error: "Billpay rule not found",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    if (rule.user_id !== currentUser.id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: You do not have permission to update this rule",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // Parse and validate request body
    let raw: unknown;
    try {
      raw = await request.json();
    } catch (error) {
      console.error("Error parsing JSON body:", error);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const parseResult = BillPayRuleUpdateSchema.safeParse(raw);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parseResult.error.issues,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 422,
        },
      );
    }

    const updateData = parseResult.data;

    // Validate source account if being updated
    if (updateData.source_account_id !== undefined) {
      const sourceAccount = currentUser.internal_accounts.find(
        (acc) => acc.id === updateData.source_account_id,
      );

      if (!sourceAccount) {
        return new Response(
          JSON.stringify({
            error: "Source account not found or does not belong to user",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 404,
          },
        );
      }

      if (!sourceAccount.is_active) {
        return new Response(
          JSON.stringify({
            error: "Source account is inactive",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          },
        );
      }
    }

    // Validate payee if being updated
    if (updateData.payee_id !== undefined) {
      const payee = await getPrisma().billPayPayee.findUnique({
        where: { id: updateData.payee_id },
      });

      if (!payee) {
        return new Response(
          JSON.stringify({
            error: "Payee not found",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 404,
          },
        );
      }
    }

    // Determine start_time and end_time for validation
    const startTime = updateData.start_time
      ? new Date(updateData.start_time)
      : rule.start_time;
    const endTime =
      updateData.end_time !== undefined
        ? updateData.end_time
          ? new Date(updateData.end_time)
          : null
        : rule.end_time;

    // Validate start_time is in the future if being updated
    if (updateData.start_time !== undefined && startTime <= new Date()) {
      return new Response(
        JSON.stringify({
          error: "Start time must be in the future",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Validate end_time is after start_time if both are provided
    if (endTime && startTime && endTime <= startTime) {
      return new Response(
        JSON.stringify({
          error: "End time must be after start time",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Determine if frequency is changing (need to reschedule cron)
    const frequencyChanged =
      updateData.frequency !== undefined &&
      updateData.frequency !== rule.frequency;

    // Prepare update data
    const updatePayload: {
      source_internal_id?: number;
      payee_id?: number;
      amount?: Decimal;
      frequency?: string;
      start_time?: Date;
      end_time?: Date | null;
    } = {};

    if (updateData.source_account_id !== undefined) {
      updatePayload.source_internal_id = updateData.source_account_id;
    }

    if (updateData.payee_id !== undefined) {
      updatePayload.payee_id = updateData.payee_id;
    }

    if (updateData.amount !== undefined) {
      // Convert amount from cents to dollars for database storage
      updatePayload.amount = new Decimal(updateData.amount / 100);
    }

    if (updateData.frequency !== undefined) {
      updatePayload.frequency = updateData.frequency;
    }

    if (updateData.start_time !== undefined) {
      updatePayload.start_time = startTime;
    }

    if (updateData.end_time !== undefined) {
      updatePayload.end_time = endTime;
    }

    // Update the rule
    const updatedRule = await getPrisma().billPayRule.update({
      where: { id: ruleId },
      data: updatePayload,
      include: {
        payee: true,
        source_internal: true,
      },
    });

    // Reschedule cron job if frequency changed
    if (frequencyChanged) {
      // Unschedule old cron job
      await unscheduleCronJob(ruleId);

      // Schedule new cron job
      try {
        await scheduleCronJob(ruleId, updateData.frequency!);
      } catch (error) {
        console.error(
          `Failed to reschedule cron job for rule ${ruleId}:`,
          error,
        );
        // Continue even if cron scheduling fails - rule is still updated
      }
    }

    // Format response
    const formattedRule = {
      id: updatedRule.id,
      user_id: updatedRule.user_id,
      source_internal_id: updatedRule.source_internal_id,
      payee_id: updatedRule.payee_id,
      amount: Number(updatedRule.amount),
      frequency: updatedRule.frequency,
      start_time: updatedRule.start_time.toISOString(),
      end_time: updatedRule.end_time?.toISOString() || null,
    };

    return new Response(JSON.stringify({ rule: formattedRule }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error updating billpay rule:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to update billpay rule",
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Await params in Next.js 15
  const { id } = await params;

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
    const ruleId = parseInt(id, 10);
    if (isNaN(ruleId)) {
      return new Response(
        JSON.stringify({
          error: "Invalid rule ID",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Find rule and verify ownership
    const rule = await getPrisma().billPayRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return new Response(
        JSON.stringify({
          error: "Billpay rule not found",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    if (rule.user_id !== currentUser.id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: You do not have permission to delete this rule",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // Unschedule cron job first
    await unscheduleCronJob(ruleId);

    // Delete the rule
    await getPrisma().billPayRule.delete({
      where: { id: ruleId },
    });

    return new Response(
      JSON.stringify({
        message: "Billpay rule deleted successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error deleting billpay rule:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to delete billpay rule",
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
