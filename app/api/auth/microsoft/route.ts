import { NextResponse } from "next/server";
import {
  COOKIE_OAUTH_STATE,
  createOAuthState,
  getMicrosoftAuthorizeUrl,
} from "@/lib/microsoft-delegated";

export async function GET(request: Request) {
  try {
    const state = createOAuthState();
    const authorizeUrl = getMicrosoftAuthorizeUrl(state);
    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set(COOKIE_OAUTH_STATE, state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
    });
    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Microsoft sign-in is not configured.";
    return NextResponse.redirect(
      new URL(`/documents?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
