import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { json } from "@/app/lib/transactions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * DELETE /api/api-keys/[id]
 * Revokes (soft deletes) an API key
 * Requires JWT Bearer token
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate user
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id } = await params;
    const keyId = parseInt(id, 10);
    if (isNaN(keyId)) {
      return json(400, { error: "Invalid API key ID" });
    }

    const prisma = getPrisma();

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { auth_user_id: auth.supabaseUser.id },
    });

    if (!user) {
      return json(404, { error: "User not found" });
    }

    // Find the API key and verify ownership
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      return json(404, { error: "API key not found" });
    }

    if (apiKey.user_id !== user.id) {
      return json(403, { error: "Forbidden: You do not own this API key" });
    }

    // Soft delete (set is_active = false)
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { is_active: false },
    });

    return json(200, { message: "API key revoked successfully" });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return json(500, { error: "Internal server error" });
  }
}
