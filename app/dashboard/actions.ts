"use server";

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Server action to invalidate dashboard cache
 * Call this after updating user profile
 */
export async function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/api/user/profile");
}

/**
 * Server action to invalidate specific user cache
 */
export async function revalidateUserCache(userId: string) {
  revalidateTag(`user-${userId}`);
  revalidatePath("/dashboard");
}
