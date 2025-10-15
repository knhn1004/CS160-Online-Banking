import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("API Documentation Route", () => {
  it("should return OpenAPI spec as JSON", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it("should have correct OpenAPI version", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.openapi).toBe("3.0.0");
  });

  it("should have correct API info", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.info).toBeDefined();
    expect(data.info.title).toBe("CS160 Online Banking API");
    expect(data.info.version).toBe("1.0.0");
    expect(data.info.description).toContain("CS160 Online Banking");
  });

  it("should have server configuration", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.servers).toBeDefined();
    expect(Array.isArray(data.servers)).toBe(true);
    expect(data.servers.length).toBeGreaterThan(0);
    expect(data.servers[0].url).toBe("http://localhost:3000");
  });

  it("should have Bearer auth security scheme", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.components).toBeDefined();
    expect(data.components.securitySchemes).toBeDefined();
    expect(data.components.securitySchemes.BearerAuth).toBeDefined();
    expect(data.components.securitySchemes.BearerAuth.type).toBe("http");
    expect(data.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });

  it("should have required component schemas", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.components.schemas).toBeDefined();
    expect(data.components.schemas.Amount).toBeDefined();
    expect(data.components.schemas.Transaction).toBeDefined();
    expect(data.components.schemas.User).toBeDefined();
    expect(data.components.schemas.Error).toBeDefined();
  });

  it("should document transactions API endpoints", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.paths).toBeDefined();
    expect(data.paths["/api/transactions"]).toBeDefined();
    expect(data.paths["/api/transactions"].get).toBeDefined();
    expect(data.paths["/api/transactions"].post).toBeDefined();
  });

  it("should document user profile API endpoints", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.paths["/api/user/profile"]).toBeDefined();
    expect(data.paths["/api/user/profile"].get).toBeDefined();
    expect(data.paths["/api/user/profile"].put).toBeDefined();
  });

  it("should have tags for organizing endpoints", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    expect(data.paths["/api/transactions"].get.tags).toContain("Transactions");
    expect(data.paths["/api/user/profile"].get.tags).toContain("User Profile");
  });

  it("should document request examples for POST /api/transactions", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    const postEndpoint = data.paths["/api/transactions"].post;
    expect(postEndpoint.requestBody).toBeDefined();
    expect(
      postEndpoint.requestBody.content["application/json"].examples,
    ).toBeDefined();

    const examples =
      postEndpoint.requestBody.content["application/json"].examples;
    expect(examples.deposit).toBeDefined();
    expect(examples.withdrawal).toBeDefined();
    expect(examples.billpay).toBeDefined();
    expect(examples.internal_transfer).toBeDefined();
    expect(examples.external_outbound).toBeDefined();
    expect(examples.external_inbound).toBeDefined();
  });

  it("should document all HTTP response codes for transactions POST", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    const postEndpoint = data.paths["/api/transactions"].post;
    expect(postEndpoint.responses["200"]).toBeDefined();
    expect(postEndpoint.responses["400"]).toBeDefined();
    expect(postEndpoint.responses["401"]).toBeDefined();
    expect(postEndpoint.responses["403"]).toBeDefined();
    expect(postEndpoint.responses["404"]).toBeDefined();
    expect(postEndpoint.responses["409"]).toBeDefined();
    expect(postEndpoint.responses["422"]).toBeDefined();
    expect(postEndpoint.responses["500"]).toBeDefined();
    expect(postEndpoint.responses["502"]).toBeDefined();
  });

  it("should document Idempotency-Key header for transactions", async () => {
    const response = await GET();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;

    const postEndpoint = data.paths["/api/transactions"].post;
    expect(postEndpoint.parameters).toBeDefined();

    const idempotencyParam = postEndpoint.parameters.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.name === "Idempotency-Key",
    );
    expect(idempotencyParam).toBeDefined();
    expect(idempotencyParam.in).toBe("header");
    expect(idempotencyParam.required).toBe(false);
  });
});
