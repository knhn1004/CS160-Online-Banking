import { createSwaggerSpec } from "next-swagger-doc";

const swaggerSpec = createSwaggerSpec({
  apiFolder: "app/api",
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CS160 Online Banking API",
      version: "1.0.0",
      description:
        "API documentation for the CS160 Online Banking application. This API provides endpoints for managing user profiles and processing various types of banking transactions.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase authentication token",
        },
      },
      schemas: {
        Amount: {
          type: "number",
          description: "Amount in cents (integer representation)",
          example: 10000,
        },
        Transaction: {
          type: "object",
          properties: {
            id: { type: "integer" },
            internal_account_id: { type: "integer" },
            amount: { type: "number" },
            transaction_type: {
              type: "string",
              enum: [
                "deposit",
                "withdrawal",
                "billpay",
                "internal_transfer",
                "external_transfer",
              ],
            },
            direction: {
              type: "string",
              enum: ["inbound", "outbound"],
            },
            status: {
              type: "string",
              enum: ["approved", "denied"],
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            auth_user_id: { type: "string", format: "uuid" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            phone_number: { type: "string" },
            street_address: { type: "string" },
            address_line_2: { type: "string", nullable: true },
            city: { type: "string" },
            state_or_territory: { type: "string" },
            postal_code: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            details: { type: "object" },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
});

export async function GET() {
  return Response.json(swaggerSpec);
}
