import OpenAI from "openai";
import { z } from "zod";

// Lazy initialization of Groq client to avoid throwing at module load time
function getGroqClient() {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  return new OpenAI({
    apiKey: groqApiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// Schema for extracted check data
export const CheckDataSchema = z.object({
  is_check: z.boolean().optional().default(true), // Verify this is actually a check
  amount: z.number().positive("Amount must be positive").optional(),
  routing_number: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : undefined)),
  account_number: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : undefined)),
  check_number: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : undefined)),
  payee_name: z.string().optional(),
  payor_name: z.string().optional(),
  date: z.string().optional(),
  rejection_reason: z.string().optional(), // Reason if not a check
});

export type CheckData = z.infer<typeof CheckDataSchema>;

// Clean check data type (without validation fields)
export type ExtractedCheckData = {
  amount: number;
  routing_number?: string;
  account_number?: string;
  check_number?: string;
  payee_name?: string;
  payor_name?: string;
  date?: string;
};

export type CheckExtractionResult =
  | { success: true; data: ExtractedCheckData }
  | { success: false; error: string };

/**
 * Extract check data from an image using Groq Vision API
 * @param imageUrl - URL of the check image (can be Supabase storage URL or public URL)
 * @returns Extracted check data or error
 */
export async function extractCheckData(
  imageUrl: string,
): Promise<CheckExtractionResult> {
  try {
    // Check if API key is set
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return {
        success: false,
        error:
          "GROQ_API_KEY environment variable is not set. Please add it to your .env.local file.",
      };
    }

    // Create client lazily
    const client = getGroqClient();

    const prompt = `You are analyzing an image to determine if it is a bank check. CRITICAL: First verify that this image is actually a check.

A valid check should have:
- Check-like formatting (typically rectangular with standard check layout)
- Bank routing information (MICR line at bottom or routing number visible)
- Payee line ("Pay to the order of")
- Amount field (both written and numeric)
- Signature line
- Bank name/logo
- Account holder information

If this image is NOT a check (e.g., random photo, document, screenshot, meme, etc.), return:
{
  "is_check": false,
  "rejection_reason": "Brief explanation of why this is not a check (e.g., 'This appears to be a random photo, not a bank check')"
}

If this IS a valid check, extract the following information as a JSON object:
- is_check: true
- amount: The dollar amount written on the check (as a number, e.g., 100.50 for $100.50)
- routing_number: The 9-digit routing number if visible (as a string)
- account_number: The account number if visible (as a string)
- check_number: The check number if visible (as a string - convert numbers to strings)
- payee_name: The name of the person/entity the check is made payable to
- payor_name: The name of the person/entity who wrote the check
- date: The date written on the check

Return ONLY a valid JSON object with these fields. If a field is not visible or cannot be determined, omit it from the JSON object. All numeric fields like routing_number, account_number, and check_number should be returned as strings, not numbers.`;

    const completion = await client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1, // Lower temperature for more consistent extraction
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: "No response from Groq API",
      };
    }

    // Check if response is HTML (error page) instead of JSON
    if (content.trim().startsWith("<")) {
      return {
        success: false,
        error:
          "Received HTML response instead of JSON. This usually means the API key is invalid or missing. Please check your GROQ_API_KEY environment variable.",
      };
    }

    // Parse the JSON response
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        success: false,
        error: `Failed to parse JSON response. Response content: ${content.substring(0, 200)}...`,
      };
    }

    // Validate against schema
    const validationResult = CheckDataSchema.safeParse(parsed);
    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid check data format: ${validationResult.error.message}`,
      };
    }

    const validatedData = validationResult.data;

    // Check if this is actually a check
    if (validatedData.is_check === false) {
      return {
        success: false,
        error:
          validatedData.rejection_reason ||
          "This image does not appear to be a valid bank check",
      };
    }

    // Ensure amount exists for valid checks
    if (!validatedData.amount || validatedData.amount <= 0) {
      return {
        success: false,
        error: "Could not extract a valid amount from the check",
      };
    }

    return {
      success: true,
      data: {
        amount: validatedData.amount,
        routing_number: validatedData.routing_number,
        account_number: validatedData.account_number,
        check_number: validatedData.check_number,
        payee_name: validatedData.payee_name,
        payor_name: validatedData.payor_name,
        date: validatedData.date,
      },
    };
  } catch (error) {
    // Better error handling for API errors
    if (error instanceof Error) {
      // Check if it's an API error with response details
      if ("response" in error && error.response) {
        const apiError = error as {
          response?: { status?: number; statusText?: string };
        };
        return {
          success: false,
          error: `Groq API error: ${apiError.response?.status} ${apiError.response?.statusText || "Unknown error"}. Make sure GROQ_API_KEY is set correctly.`,
        };
      }

      // Check for authentication errors
      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized")
      ) {
        return {
          success: false,
          error:
            "Groq API authentication failed. Please check your GROQ_API_KEY environment variable.",
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: String(error),
    };
  }
}
