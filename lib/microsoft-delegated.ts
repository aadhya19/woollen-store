import { randomBytes } from "node:crypto";

import {
  getOneDriveRefreshToken,
  saveOneDriveRefreshToken,
} from "@/lib/one-drive-token-store";

/** Cookies from `await cookies()` or `NextResponse.cookies` */
export type MutableCookieJar = {
  get: (name: string) => { value: string } | undefined;
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    },
  ) => void;
};

/** Delegated Microsoft Graph scopes (user signs in; uploads go to `/me/drive`). */
export const MICROSOFT_GRAPH_SCOPES = "offline_access Files.ReadWrite";

const COOKIE_ACCESS = "ms_graph_at";
const COOKIE_REFRESH = "ms_graph_rt";
const COOKIE_EXPIRES = "ms_graph_exp";
export const COOKIE_OAUTH_STATE = "ms_oauth_state";

function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

function getOAuthConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim() ?? "";
  /** Personal Microsoft accounts (OneDrive consumer). Override with `common` or a tenant id for work/school. */
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "consumers";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Microsoft OAuth env: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri, tenant };
}

export function getMicrosoftAuthorizeUrl(state: string) {
  const { clientId, redirectUri, tenant } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MICROSOFT_GRAPH_SCOPES,
    state,
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const { tenant } = getOAuthConfig();
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    const msg =
      json.error_description ?? json.error ?? "Token request failed";
    throw new Error(msg);
  }
  return json;
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  return postToken(body);
}

export async function refreshMicrosoftTokens(refreshToken: string) {
  const { clientId, clientSecret } = getOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return postToken(body);
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}

/** Short-lived Graph access token (+ expiry) in httpOnly cookies. Refresh token lives in `"One Drive"` only. */
export function applyAccessTokenCookies(
  cookieJar: MutableCookieJar,
  tokens: { access_token: string; expires_in: number },
) {
  const maxAccess = Math.max(60, tokens.expires_in);
  const accessExpiresAt = Date.now() + maxAccess * 1000;

  cookieJar.set(COOKIE_ACCESS, tokens.access_token, {
    ...cookieBaseOptions(),
    maxAge: maxAccess,
  });
  cookieJar.set(COOKIE_EXPIRES, String(accessExpiresAt), {
    ...cookieBaseOptions(),
    maxAge: maxAccess,
  });
  cookieJar.set(COOKIE_REFRESH, "", {
    ...cookieBaseOptions(),
    maxAge: 0,
  });
}

/**
 * Returns a valid Graph access token, refreshing when close to expiry.
 * Mutates cookies via `cookieJar.set` (access token only). Refresh token is loaded from `"One Drive"`.
 */
export async function getValidMicrosoftAccessToken(
  cookieJar: MutableCookieJar,
): Promise<string | null> {
  const access = cookieJar.get(COOKIE_ACCESS)?.value;
  const expRaw = cookieJar.get(COOKIE_EXPIRES)?.value;
  const exp = expRaw ? Number(expRaw) : 0;

  const refreshSkewMs = 5 * 60 * 1000;
  if (access && exp && Date.now() < exp - refreshSkewMs) {
    return access;
  }

  let refresh: string | null = null;
  try {
    refresh = await getOneDriveRefreshToken();
  } catch {
    refresh = null;
  }

  if (!refresh) {
    const legacy = cookieJar.get(COOKIE_REFRESH)?.value?.trim();
    if (legacy) {
      try {
        await saveOneDriveRefreshToken(legacy);
        refresh = legacy;
        cookieJar.set(COOKIE_REFRESH, "", {
          ...cookieBaseOptions(),
          maxAge: 0,
        });
      } catch {
        refresh = legacy;
      }
    }
  }

  if (!refresh) return null;

  try {
    const json = await refreshMicrosoftTokens(refresh);
    if (!json.access_token || !json.expires_in) {
      return null;
    }
    if (json.refresh_token) {
      try {
        await saveOneDriveRefreshToken(json.refresh_token);
      } catch {
        // access token still usable; reconnect may be required if rotation was missed
      }
    }
    applyAccessTokenCookies(cookieJar, {
      access_token: json.access_token,
      expires_in: json.expires_in,
    });
    return json.access_token;
  } catch {
    return null;
  }
}
