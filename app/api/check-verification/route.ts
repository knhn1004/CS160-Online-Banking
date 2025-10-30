import { Buffer } from "buffer";
import { getAuthUserFromRequest } from "../../../lib/auth";
import { getPrisma } from "../../lib/prisma";

// OCR DEBUG:
const ENABLE_OCR_DEBUG = true;

type AnyObj = Record<string, unknown>;
type OCRJson = Record<string, unknown>;

function collectStrings(obj: unknown, out: string[]) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) {
    for (const v of obj) collectStrings(v, out);
  } else if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj as Record<string, unknown>)) {
      collectStrings((obj as Record<string, unknown>)[k], out);
    }
  }
}

function extractCheckId(ocrJson: AnyObj): string | null {
  const ocr = ocrJson as OCRJson;
  const toStr = (v: unknown) =>
    v === null || v === undefined
      ? null
      : typeof v === "string" || typeof v === "number"
        ? String(v)
        : null;

  const routing = toStr(ocr["routing_number"] ?? ocr["routing"] ?? ocr["aba"]);
  const account = toStr(ocr["account_number"] ?? ocr["account"]);
  const check = toStr(
    ocr["check_number"] ?? ocr["check_no"] ?? ocr["cheque_number"],
  );
  if (routing && account && check) {
    return `${routing}_${account}_${check}`;
  }

  const parts: string[] = [];
  collectStrings(ocrJson, parts);
  const allText = parts.join(" ");
  const routingMatch = allText.match(/(\d{9})/);
  if (!routingMatch) return null;
  const routingNum = routingMatch[1];

  const digitGroups = Array.from(allText.matchAll(/(\d{4,})/g)).map(
    (m) => m[1],
  );
  const filtered = digitGroups.filter((g) => g !== routingNum);
  if (filtered.length < 2) return null;
  const accountNum = filtered[0];
  const checkNum = filtered[1];
  return `${routingNum}_${accountNum}_${checkNum}`;
}

function extractAmount(ocrJson: AnyObj): string | null {
  const ocr = ocrJson as OCRJson;
  const toStr = (v: unknown) =>
    v === null || v === undefined
      ? null
      : typeof v === "string" || typeof v === "number"
        ? String(v)
        : null;

  const structured =
    toStr(ocr["amount"]) ??
    toStr(ocr["amount_numeric"]) ??
    toStr(ocr["legal_amount"]) ??
    toStr(ocr["written_amount"]);
  if (structured) return structured;

  const parts: string[] = [];
  collectStrings(ocrJson, parts);
  const allText = parts.join(" ");
  const moneyWithDollar = allText.match(
    /(?:\$|USD\s?)\s*([0-9]+(?:[.,][0-9]{2})?)/i,
  );
  if (moneyWithDollar) return moneyWithDollar[1].replace(",", ".");
  const plainMoney = allText.match(/([0-9]+(?:[.,][0-9]{2}))/);
  if (plainMoney) return plainMoney[1].replace(",", ".");
  return null;
}

function detectEndorsement(ocrJson: AnyObj): boolean {
  const ocr = ocrJson as OCRJson;
  if (ocr["endorsement"] === true) return true;
  if (ocr["signature_present"] === true) return true;
  if (ocr["endorsement_image"]) return true;

  const parts: string[] = [];
  collectStrings(ocrJson, parts);
  const allText = parts.join(" ").toLowerCase();
  return /endorse|endorsement|signed by|signature/i.test(allText);
}

export async function POST(request: Request) {
  try {
    // auth
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return new Response(
        JSON.stringify(auth.body || { message: "Unauthorized" }),
        {
          status: auth.status ?? 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // form-data parsing (app router / node fetch supports request.formData())
    const form = await request.formData();
    const front = form.get("front") as File | null;
    const back = form.get("back") as File | null;

    if (!front || !back) {
      return new Response(
        JSON.stringify({
          error: "Both 'front' and 'back' images are required.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // read files to base64 (safe to send to third-party)
    const frontBuf = Buffer.from(await front.arrayBuffer());
    const backBuf = Buffer.from(await back.arrayBuffer());
    const frontBase64 = frontBuf.toString("base64");
    const backBase64 = backBuf.toString("base64");

    // call third-party OCR/Check-reading API (OCR.space)
    const ocrApiUrl = process.env.CHECK_OCR_API_URL;
    const ocrApiKey = process.env.CHECK_OCR_API_KEY;
    if (!ocrApiUrl || !ocrApiKey) {
      return new Response(
        JSON.stringify({ error: "OCR service not configured." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const apiUrl: string = ocrApiUrl;
    const apiKey: string = ocrApiKey;

    async function callOcrSpace(
      base64Image: string,
      apiUrl: string,
      apiKey: string,
    ): Promise<AnyObj> {
      const fd = new FormData();
      fd.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
      fd.append("language", "eng");
      fd.append("isOverlayRequired", "false");

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { apikey: apiKey },
        body: fd as unknown as BodyInit,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`OCR service error ${res.status}: ${txt}`);
      }

      const jsonUnknown = (await res.json().catch(() => ({}))) as unknown;
      if (jsonUnknown && typeof jsonUnknown === "object")
        return jsonUnknown as AnyObj;
      return {};
    }

    let frontResp: AnyObj = {};
    let backResp: AnyObj = {};
    try {
      frontResp = await callOcrSpace(frontBase64, apiUrl, apiKey);
      backResp = await callOcrSpace(backBase64, apiUrl, apiKey);
    } catch (ocrErr: unknown) {
      console.error("OCR.space call failed:", ocrErr);
      return new Response(JSON.stringify({ error: "OCR service error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (ENABLE_OCR_DEBUG) {
      console.log(
        "---- FRONT OCR JSON ----\n",
        JSON.stringify(frontResp, null, 2),
      );
      console.log(
        "---- BACK OCR JSON ----\n",
        JSON.stringify(backResp, null, 2),
      );
      try {
        // write JSON files so you can open them in VS Code / Finder
        const fs = await import("fs");
        fs.writeFileSync?.(
          "/tmp/front_ocr.json",
          JSON.stringify(frontResp, null, 2),
        );
        fs.writeFileSync?.(
          "/tmp/back_ocr.json",
          JSON.stringify(backResp, null, 2),
        );
      } catch (e) {
        /* ignore write errors in some runtimes */
      }
    }

    // normalize OCR.space result into searchable text fields for existing parsers
    function normalizeOcrSpaceResult(resp: AnyObj): string {
      const parsedResults = resp["ParsedResults"];
      if (Array.isArray(parsedResults) && parsedResults.length > 0) {
        const first = parsedResults[0] as Record<string, unknown> | undefined;
        const parsedText =
          first && typeof first["ParsedText"] === "string"
            ? String(first["ParsedText"])
            : "";
        return parsedText;
      }
      // fallback: try .ParsedText top-level or empty string
      const topText = resp["ParsedText"];
      return typeof topText === "string" ? topText : "";
    }

    const combinedText = `${normalizeOcrSpaceResult(frontResp)}\n${normalizeOcrSpaceResult(backResp)}`;
    const ocrJson: AnyObj = {
      parsed_text: combinedText,
      front: frontResp,
      back: backResp,
    };

    // extract check ID (do NOT persist full OCR result)
    const checkId = extractCheckId(ocrJson);
    if (!checkId) {
      return new Response(
        JSON.stringify({ error: "Could not extract check ID from images." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // extract amount and endorsement presence (do not store full OCR)
    const amountString = extractAmount(ocrJson); // e.g. "12.34"
    const endorsementPresent = detectEndorsement(ocrJson);

    // Validate & normalize the amount (null if invalid):
    let amountCents: number | null = null;

    if (amountString) {
      const parsed = Number(String(amountString).replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) {
        amountCents = Math.round(parsed * 100);
      } else {
        console.warn("Unable to parse amount from OCR:", amountString);
        amountCents = null;
      }
    }

    // resolve application user id BEFORE using them
    const prisma = getPrisma();
    let appUserId: number | null = null;
    if (auth.supabaseUser?.id) {
      const maybe = await prisma.user.findUnique({
        where: { auth_user_id: auth.supabaseUser.id }, // use the actual unique field
      });
      if (
        maybe &&
        typeof (maybe as Record<string, unknown>)["id"] === "number"
      ) {
        appUserId = (maybe as unknown as { id: number }).id;
      }
    }

    // We forward to transactions endpoint and return parsed data.
    const destAccount = appUserId
      ? await prisma.internalAccount.findFirst({
          where: { user_id: appUserId, is_active: true },
        })
      : null;

    if (destAccount && amountCents !== null) {
      // prefer server-to-server internal key; fall back to forwarded user auth if absent
      const internalKey = process.env.INTERNAL_API_KEY;
      const userAuthHeader = request.headers.get("authorization") ?? "";
      const authHeader = internalKey ? `Bearer ${internalKey}` : userAuthHeader;

      try {
        const idempotencyKey = `check-id-${String(checkId).replace(/[^a-zA-Z0-9-_]/g, "-")}`;
        const depositResp = await fetch(
          `${process.env.APP_BASE_URL ?? ""}/api/transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              requested_transaction_type: "deposit",
              transaction_direction: "inbound",
              destination_account_number: destAccount.account_number,
              requested_amount: amountCents,
              description: `Check deposit for check_id=${checkId}`,
              metadata: {
                check_id: checkId,
                front_filename: front.name,
                back_filename: back.name,
                endorsement: endorsementPresent,
              },
            }),
          },
        );

        if (!depositResp.ok) {
          console.error(
            "Deposit forward failed:",
            depositResp.status,
            await depositResp.text(),
          );
        } else {
          const depositJsonUnknown = (await depositResp
            .json()
            .catch(() => ({}))) as unknown;
          if (depositJsonUnknown && typeof depositJsonUnknown === "object") {
            const depositJson = depositJsonUnknown as Record<string, unknown>;
            const id = depositJson["id"];
            if (typeof id === "number") {
              console.info("Deposit created, transaction id:", id);
            }
          }
        }
      } catch (err: unknown) {
        console.error("Failed to forward deposit:", err);
      }
    } else {
      console.warn(
        "No destination account or amount; skipping deposit forward.",
      );
    }

    // DEBUG:
    const devDebug = ENABLE_OCR_DEBUG
      ? { ocr_front: frontResp, ocr_back: backResp, parsed_text: combinedText }
      : undefined;

    return new Response(
      JSON.stringify({
        message: "Check processed",
        check_id: checkId,
        amount: amountString ?? null,
        endorsement_present: endorsementPresent,
        ...(devDebug ? { debug: devDebug } : {}),
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("POST /api/check-verification error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
