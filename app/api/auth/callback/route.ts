import { NextRequest, NextResponse } from "next/server";
import {
  applyAccessTokenCookies,
  COOKIE_OAUTH_STATE,
  exchangeCodeForTokens,
} from "@/lib/microsoft-delegated";
import { saveOneDriveRefreshToken } from "@/lib/one-drive-token-store";

export async function GET(request: NextRequest) {
  const base = request.nextUrl.origin;
  const redirectDocuments = (search: string) =>
    NextResponse.redirect(new URL(`/documents${search}`, base));

  const errParam = request.nextUrl.searchParams.get("error");
  if (errParam) {
    return redirectDocuments(`?error=${encodeURIComponent(errParam)}`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get(COOKIE_OAUTH_STATE)?.value;

  if (!state || !expected || state !== expected) {
    return redirectDocuments("?error=invalid_state");
  }

  if (!code) {
    return redirectDocuments("?error=missing_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token || !tokens.expires_in) {
      return redirectDocuments("?error=invalid_token_response");
    }
    if (!tokens.refresh_token) {
      return redirectDocuments(
        "?error=" +
          encodeURIComponent(
            "No refresh token. Ensure API permissions use delegated Files.ReadWrite and scope includes offline_access.",
          ),
      );
    }

    const res = redirectDocuments("?connected=1");
    res.cookies.set(COOKIE_OAUTH_STATE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
    await saveOneDriveRefreshToken(tokens.refresh_token);
    applyAccessTokenCookies(res.cookies, {
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "sign_in_failed";
    return redirectDocuments(`?error=${encodeURIComponent(message)}`);
  }
}
