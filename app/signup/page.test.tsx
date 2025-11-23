import React from "react";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, afterEach, vi } from "vitest";
import SignupPageClient from "./SignupPageClient";
import { USStateTerritory } from "../../lib/schemas/user";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SignupPageClient (client-side behaviour)", () => {
  const formId = "signup-form-test";

  function makeBasicForm(includeAllNames = true) {
    const existing = document.getElementById(formId);
    if (existing) existing.remove();
    const container = document.createElement("div");
    container.innerHTML = `
      <form id="${formId}">
        <input id="username" name="username" />
        <input id="email" name="email" />
        <input id="password" name="password" />
        <input id="confirmPassword" name="confirmPassword" />
        <input id="firstName" name="firstName" />
        <input id="lastName" name="lastName" />
        <input id="phoneNumber" name="phoneNumber" />
        <input id="streetAddress" name="streetAddress" />
        <input id="addressLine2" name="addressLine2" />
        <input id="city" name="city" />
        <select id="stateOrTerritory" name="stateOrTerritory">
          <option value="">Select</option>
          <option value="AL">AL</option>
        </select>
        <input id="postalCode" name="postalCode" />
        <p id="username-error"></p>
        <p id="email-error"></p>
        <p id="password-error"></p>
        <p id="confirmPassword-error"></p>
        <p id="firstName-error"></p>
        <p id="lastName-error"></p>
        <p id="phoneNumber-error"></p>
        <p id="streetAddress-error"></p>
        <p id="addressLine2-error"></p>
        <p id="city-error"></p>
        <p id="stateOrTerritory-error"></p>
        <p id="postalCode-error"></p>
      </form>
    `;
    if (!includeAllNames) {
      const el = container.querySelector("[name='email']");
      if (el) el.removeAttribute("name");
    }
    document.body.appendChild(container);
    return container;
  }

  it("prefills inputs from initialDraft", async () => {
    makeBasicForm(true);
    const initialDraft = {
      username: "alice",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      phoneNumber: "+11234567890",
      streetAddress: "1 Road",
      addressLine2: "Apt 2",
      city: "Town",
      stateOrTerritory: "AL" as unknown as USStateTerritory,
      postalCode: "12345",
    };

    render(<SignupPageClient formId={formId} initialDraft={initialDraft} />);

    await waitFor(() => {
      expect(
        (document.getElementById("username") as HTMLInputElement).value,
      ).toBe("alice");
    });

    expect((document.getElementById("email") as HTMLInputElement).value).toBe(
      "alice@example.com",
    );
    expect(
      (document.getElementById("firstName") as HTMLInputElement).value,
    ).toBe("Alice");
    expect(
      (document.getElementById("lastName") as HTMLInputElement).value,
    ).toBe("Smith");
    expect(
      (document.getElementById("phoneNumber") as HTMLInputElement).value,
    ).toBe("+11234567890");
    expect(
      (document.getElementById("streetAddress") as HTMLInputElement).value,
    ).toBe("1 Road");
    expect(
      (document.getElementById("addressLine2") as HTMLInputElement).value,
    ).toBe("Apt 2");
    expect((document.getElementById("city") as HTMLInputElement).value).toBe(
      "Town",
    );
    const stateEl = document.getElementById("stateOrTerritory");
    if (!(stateEl instanceof HTMLSelectElement))
      throw new Error("expected #stateOrTerritory to be a <select>");
    expect(stateEl.value).toBe("AL");
    expect(
      (document.getElementById("postalCode") as HTMLInputElement).value,
    ).toBe("12345");
  });

  it("reports missing form names and marks inputs aria-invalid", async () => {
    makeBasicForm(false); // remove email name attribute to simulate missing field
    render(<SignupPageClient formId={formId} initialDraft={null} />);

    const form = document.getElementById(formId) as HTMLFormElement;
    fireEvent.submit(form);

    // Expect the general validation/banner message (component uses a general error area).
    await waitFor(() => {
      const emailErrText =
        document.getElementById("email-error")?.textContent ?? "";
      expect(emailErrText).toMatch(/Missing input name/i);
    });

    // Ensure the email input indeed has no name attribute (the condition we simulated)
    const emailInput = document.getElementById("email") as HTMLInputElement;
    expect(emailInput.hasAttribute("name")).toBe(false);
    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("intercepts native submit and routes through validator (prevents native submit when invalid)", async () => {
    makeBasicForm(true);
    const nativeSubmitSpy = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => {});
    render(<SignupPageClient formId={formId} initialDraft={null} />);

    (document.getElementById("username") as HTMLInputElement).value = ""; // required
    (document.getElementById("email") as HTMLInputElement).value = ""; // required

    const form = document.getElementById(formId) as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(nativeSubmitSpy).not.toHaveBeenCalled();
    });

    nativeSubmitSpy.mockRestore();
  });
});
