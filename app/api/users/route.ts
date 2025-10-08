import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/app/lib/prisma";

type CreateUserRequest = {
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  zip_code: number;
  role?: "customer" | "bank_manager";
};

export async function POST(request: NextRequest) {
  try {
    const body: CreateUserRequest = await request.json();
    const {
      auth_user_id,
      email,
      first_name,
      last_name,
      phone,
      zip_code,
      role = "customer",
    } = body;

    // Validate required fields
    if (!auth_user_id || !email || !first_name || !last_name || !zip_code) {
      return NextResponse.json(
        {
          message: "Missing required fields.",
        },
        { status: 400 },
      );
    }

    // Check if email already exists
    const prisma = getPrisma();
    const existingUser = await prisma.user.findFirst({
      where: { email: email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          message:
            "Email already exists. Please use a different email address.",
        },
        { status: 409 },
      );
    }

    // Generate a unique user_id
    const user_id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user in database
    const user = await prisma.user.create({
      data: {
        user_id,
        auth_user_id,
        email: email,
        first_name: first_name,
        last_name: last_name,
        phone: phone || null,
        zip_code: zip_code,
        role: role as "customer" | "bank_manager",
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user.id,
          user_id: user.user_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating user:", error);

    // Handle Prisma unique constraint errors
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { message: "User with this auth_user_id already exists" },
        { status: 409 },
      );
    }

    // Handle other Prisma errors
    if (error instanceof Error && error.message.includes("prisma")) {
      return NextResponse.json(
        { message: "Database error occurred" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
