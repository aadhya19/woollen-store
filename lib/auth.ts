import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "user";

type AuthPayload = {
  role: UserRole;
  userId: string;
  userName: string;
  exp: number;
};

export const AUTH_COOKIE_NAME = "auth_token";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

function getAuthSecret() {
  return process.env.AUTH_TOKEN_SECRET ?? "dev-only-secret-change-me";
}

function base64UrlEncode(text: string) {
  return Buffer.from(text, "utf8").toString("base64url");
}

function base64UrlDecode(text: string) {
  return Buffer.from(text, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function createAuthToken(role: UserRole, userId: string, userName: string) {
  const payload: AuthPayload = {
    role,
    userId,
    userName,
    exp: Date.now() + ONE_WEEK_SECONDS * 1000,
  };
  const payloadText = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadText);
  return `${payloadText}.${signature}`;
}

function parseAuthToken(token: string): AuthPayload | null {
  const [payloadText, signature] = token.split(".");
  if (!payloadText || !signature) return null;

  const expected = sign(payloadText);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadText)) as AuthPayload;
    if (
      (payload.role !== "admin" && payload.role !== "user") ||
      !payload.exp ||
      typeof payload.userId !== "string" ||
      !payload.userId.trim() ||
      typeof payload.userName !== "string" ||
      !payload.userName.trim()
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(
  role: UserRole,
  userId: string,
  userName: string,
) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, createAuthToken(role, userId, userName), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE_NAME);
}

export async function getAuthSession(): Promise<{
  role: UserRole;
  userId: string;
  userName: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = parseAuthToken(token);
  if (!payload) return null;
  return { role: payload.role, userId: payload.userId, userName: payload.userName };
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/");
  }
  return session;
}

export async function requireActionRole(allowedRoles: UserRole[]) {
  const session = await getAuthSession();
  if (!session) return "Not authenticated. Please log in.";
  if (!allowedRoles.includes(session.role)) {
    return "You do not have permission to perform this action.";
  }
  return null;
}
