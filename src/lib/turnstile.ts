import { NextRequest } from "next/server";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileSiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }

  return request.headers.get("cf-connecting-ip") ?? undefined;
}

export async function verifyTurnstileToken(
  request: NextRequest,
  token: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY is not set");
  }

  const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: getClientIp(request),
    }),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as TurnstileSiteverifyResponse;
  if (!result.success) {
    console.warn("Turnstile verification failed:", result["error-codes"]);
  }

  return result.success;
}
