import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/app/lib/prisma";

type CreateUserRequest = {
  auth_user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  street_address: string;
  address_line_2?: string;
  city: string;
  state_or_territory: string;
  postal_code: string;
  role?: "customer" | "bank_manager";
};

export async function POST(request: NextRequest) {
  try {
    const body: CreateUserRequest = await request.json();
    const {
      auth_user_id,
      username,
      email,
      first_name,
      last_name,
      phone_number,
      street_address,
      address_line_2,
      city,
      state_or_territory,
      postal_code,
      role = "customer",
    } = body;

    // Validate required fields
    if (
      !auth_user_id ||
      !username ||
      !email ||
      !first_name ||
      !last_name ||
      !phone_number ||
      !street_address ||
      !city ||
      !state_or_territory ||
      !postal_code
    ) {
      return NextResponse.json(
        {
          message: "Missing required fields.",
        },
        { status: 400 },
      );
    }

    // Check if email or username already exists
    const prisma = getPrisma();
    const existingUserByEmail = await prisma.user.findFirst({
      where: { email: email },
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        {
          message:
            "Email already exists. Please use a different email address.",
        },
        { status: 409 },
      );
    }

    const existingUserByUsername = await prisma.user.findFirst({
      where: { username: username },
    });

    if (existingUserByUsername) {
      return NextResponse.json(
        {
          message: "Username already exists. Please use a different username.",
        },
        { status: 409 },
      );
    }

    // Generate a unique user_id
    const user_id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user in database
    const user = await prisma.user.create({
      data: {
        auth_user_id,
        username,
        email,
        first_name,
        last_name,
        phone_number,
        street_address,
        address_line_2: address_line_2 || null,
        city,
        state_or_territory: state_or_territory as
          | "AL"
          | "AK"
          | "AZ"
          | "AR"
          | "CA"
          | "CO"
          | "CT"
          | "DE"
          | "DC"
          | "FL"
          | "GA"
          | "HI"
          | "ID"
          | "IL"
          | "IN"
          | "IA"
          | "KS"
          | "KY"
          | "LA"
          | "ME"
          | "MD"
          | "MA"
          | "MI"
          | "MN"
          | "MS"
          | "MO"
          | "MT"
          | "NE"
          | "NV"
          | "NH"
          | "NJ"
          | "NM"
          | "NY"
          | "NC"
          | "ND"
          | "OH"
          | "OK"
          | "OR"
          | "PA"
          | "RI"
          | "SC"
          | "SD"
          | "TN"
          | "TX"
          | "UT"
          | "VT"
          | "VA"
          | "WA"
          | "WV"
          | "WI"
          | "WY"
          | "PR"
          | "GU"
          | "VI"
          | "AS"
          | "MP",
        postal_code,
        role: role as "customer" | "bank_manager",
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user.id,
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
