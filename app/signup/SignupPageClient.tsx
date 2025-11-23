// page.tsx will render this client component.
// This only acts as a lightweight client validator and submit controller.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SignupSchema } from "../../lib/schemas/user";
import type { z as zType } from "zod";
import { Button } from "@/components/ui/button";

// Validation things...
const _PrefillSchema = SignupSchema.omit({
  password: true,
  confirmPassword: true,
});

type Prefill = zType.infer<typeof _PrefillSchema> | null;

interface SignupPageClientProps {
  formId: string;
  initialDraft?: Prefill | null;
}

const FIELD_NAMES = [
  "username",
  "email",
  "password",
  "confirmPassword",
  "firstName",
  "lastName",
  "phoneNumber",
  "streetAddress",
  "addressLine2",
  "city",
  "stateOrTerritory",
  "postalCode",
];

export default function SignupPageClient({
  formId,
  initialDraft,
}: SignupPageClientProps) {
  const [validating, setValidating] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearPlaceholders = useCallback(() => {
    FIELD_NAMES.forEach((n) => {
      const errEl = document.getElementById(`${n}-error`);
      if (errEl) errEl.textContent = "";
      const input = document.getElementsByName(n)[0] as HTMLElement | undefined;
      if (input) {
        try {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
        } catch {}
      }
    });
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  // Prefill DOM inputs if an initial draft is provided
  useEffect(() => {
    if (!initialDraft) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    try {
      Object.entries(initialDraft).forEach(([k, v]) => {
        const el = form.querySelector(`[name="${k}"]`) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          | null;
        if (!el || v == null) return;

        // Narrow to known element types before setting value
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          // handle checkbox/radio if needed:
          if (el.type === "checkbox") {
            (el as HTMLInputElement).checked = Boolean(v);
          } else if (el.type === "radio") {
            // radio: set checked on matching radio input(s)
            const radios = form.querySelectorAll<HTMLInputElement>(
              `[name="${k}"]`,
            );
            radios.forEach((r) => {
              r.checked = r.value === String(v);
            });
          } else {
            el.value = String(v);
          }
        } else if (el instanceof HTMLSelectElement) {
          el.value = String(v);
        }
      });
    } catch {
      // be conservative: ignore prefill errors
    }
  }, [formId, initialDraft]);

  // Client-side validation + submit handler
  const handleValidateAndSubmit = useCallback(
    async (e?: React.MouseEvent | Event) => {
      if (e && (e as Event).preventDefault) (e as Event).preventDefault();
      setGeneralError(null);
      setFieldErrors({});
      setValidating(true);
      clearPlaceholders();

      try {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (!form) {
          setGeneralError("Form not found.");
          setValidating(false);
          return;
        }

        const formData = new FormData(form);

        // ensure expected inputs exist on the form (structural check)
        const EXPECTED = ["username", "email", "password", "confirmPassword"];
        const missingNames = EXPECTED.filter(
          (name) => !form.querySelector(`[name="${name}"]`),
        );
        if (missingNames.length > 0) {
          const perField: Record<string, string> = {};
          missingNames.forEach((n) => {
            perField[n] = "Missing input name";
            // set aria + describedby on the input node if present
            const input = document.getElementById(
              String(n),
            ) as HTMLElement | null;
            if (input) {
              try {
                input.setAttribute("aria-invalid", "true");
              } catch {}
              try {
                input.setAttribute("aria-describedby", `${n}-error`);
              } catch {}
            }
            // write the per-field error into the corresponding placeholder element
            const errEl = document.getElementById(`${n}-error`);
            if (errEl) errEl.textContent = "Missing input name";
          });
          setFieldErrors(perField);
          setValidating(false);
          return;
        }

        const REQUIRED = [
          "username",
          "email",
          "password",
          "confirmPassword",
          "firstName",
          "lastName",
          "phoneNumber",
          "streetAddress",
          "city",
          "stateOrTerritory",
          "postalCode",
        ];
        const missingRequired = REQUIRED.filter((name) => !formData.has(name));
        if (missingRequired.length > 0) {
          const errors: Record<string, string> = {};
          missingRequired.forEach((m) => {
            errors[m] = "This field is required";
            const placeholder = document.getElementById(`${m}-error`);
            if (placeholder) placeholder.textContent = "This field is required";
            const input = document.getElementsByName(m)[0] as
              | HTMLElement
              | undefined;
            if (input) {
              try {
                input.setAttribute("aria-invalid", "true");
                input.setAttribute("aria-describedby", `${m}-error`);
              } catch {}
            }
          });
          setFieldErrors(errors);
          setValidating(false);
          return;
        }

        const raw = Object.fromEntries(formData.entries()) as Record<
          string,
          unknown
        >;

        // Normalize to strings for schema validation.
        const payload: Record<string, unknown> = {
          username: String(raw.username ?? "").trim(),
          email: String(raw.email ?? "").trim(),
          password: String(raw.password ?? ""),
          confirmPassword: String(raw.confirmPassword ?? ""),
          firstName: String(raw.firstName ?? "").trim(),
          lastName: String(raw.lastName ?? "").trim(),
          phoneNumber: String(raw.phoneNumber ?? "").trim(),
          streetAddress: String(raw.streetAddress ?? "").trim(),
          addressLine2: String(raw.addressLine2 ?? "").trim(),
          city: String(raw.city ?? "").trim(),
          stateOrTerritory: String(raw.stateOrTerritory ?? "").trim(),
          postalCode: String(raw.postalCode ?? "").trim(),
        };

        const result = SignupSchema.safeParse(payload);
        if (!result.success) {
          // Map zod issues to fieldErrors.
          const errors: Record<string, string> = {};
          for (const issue of result.error.issues) {
            const path = String(issue.path[0] ?? "");
            if (path) {
              errors[path] = issue.message;
              const placeholder = document.getElementById(`${path}-error`);
              if (placeholder) placeholder.textContent = issue.message;
              const input = document.getElementById(String(path));
              if (input) {
                try {
                  (input as HTMLElement).setAttribute("aria-invalid", "true");
                } catch {}
                try {
                  (input as HTMLElement).setAttribute(
                    "aria-describedby",
                    `${path}-error`,
                  );
                } catch {}
              }
            }
          }
          setFieldErrors(errors);
          // Set a general error to show first message.
          setGeneralError(
            result.error.issues[0]?.message ?? "Validation failed.",
          );
          // Focus first invalid input if present.
          const firstField = result.error.issues[0]?.path?.[0];
          if (firstField) {
            const el = document.getElementById(String(firstField));
            if (el && typeof (el as HTMLElement).focus === "function")
              (el as HTMLElement).focus();
          }
          setValidating(false);
          return;
        }

        // Validation passed: submit form in a way that React expects:
        const submitBtn = document.createElement("button");
        submitBtn.type = "submit";
        submitBtn.style.display = "none";
        // attach to the form so requestSubmit/click sets `event.submitter`
        form.appendChild(submitBtn);

        // mark programmatic so our submit listener will allow the native submit
        programmaticSubmitRef.current = true;
        // clicking a real button triggers React synthetic handlers properly
        submitBtn.click();

        // cleanup after the submit has been dispatched (next tick)
        setTimeout(() => {
          try {
            submitBtn.remove();
          } catch {}
          programmaticSubmitRef.current = false;
        }, 0);
      } catch (err) {
        setGeneralError(
          err instanceof Error ? err.message : "Validation failed",
        );
      } finally {
        setValidating(false);
      }
    },
    [formId, clearPlaceholders],
  );

  // Intercept native form submit (Enter key) and route through our validator.
  const programmaticSubmitRef = useRef(false);
  const submitHandlerRef = useRef<((e: Event) => void) | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    // Remove previous handler if present (protects against stale listeners).
    if (submitHandlerRef.current) {
      try {
        form.removeEventListener("submit", submitHandlerRef.current);
      } catch {}
      submitHandlerRef.current = null;
    }

    const submitHandler = (e: Event) => {
      // If this submit was triggered programmatically by our code, allow native submit.
      if (programmaticSubmitRef.current) {
        programmaticSubmitRef.current = false;
        return;
      }
      e.preventDefault();
      void handleValidateAndSubmit(e);
    };

    submitHandlerRef.current = submitHandler;
    form.addEventListener("submit", submitHandler);
  }, [formId, handleValidateAndSubmit]);

  // Render only error UI and the submit control — server page renders inputs.
  return (
    <>
      {generalError ? (
        <p className="text-sm text-destructive mb-2">{generalError}</p>
      ) : null}
      {Object.keys(fieldErrors).length > 0 && (
        <ul className="mb-2 text-sm text-destructive space-y-1">
          {Object.entries(fieldErrors).map(([k, v]) => (
            <li key={k}>
              <strong>{k}:</strong> {v}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={(e) => handleValidateAndSubmit(e)}
          disabled={validating}
          aria-busy={validating}
          className="w-full rounded-md bg-primary px-4 py-2 text-white"
        >
          {validating ? "Validating..." : "Sign up"}
        </Button>
      </div>
    </>
  );
}
