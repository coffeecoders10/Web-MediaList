"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authRequest, requestResetCode, updatePassword } from "@/lib/server/backbone";
import { registerHandle } from "@/lib/server/directory";
import { endSession, requireSession, startSession } from "@/lib/server/session";
import type { SessionUser } from "@/lib/session-token";
import { clearFailures, isThrottled, recordAttempt } from "@/lib/server/throttle";

export interface AuthFormState {
  /** Problem with the form as a whole (wrong credentials, throttled, server down). */
  error?: string;
  /** Problems with individual fields, keyed by field name. */
  fields?: Partial<Record<"username" | "fullName" | "password", string>>;
  /** Echoed back so a failed submit doesn't clear what was typed. Never the password. */
  values?: { username: string; fullName: string };
}

/** Makes the account findable by username for profile links and friends. Never blocks signing in. */
async function listInDirectory(user: SessionUser) {
  try {
    await registerHandle(user);
  } catch (error) {
    console.error("[auth] couldn't list the user in the directory:", error);
  }
}

const field = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

async function clientId() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "local";
}

/** Same rules as Backbone's /auth/signup, checked first for fast feedback. */
function validateSignup(username: string, fullName: string, password: string): AuthFormState["fields"] {
  const fields: NonNullable<AuthFormState["fields"]> = {};
  if (!/^\w{3,30}$/.test(username)) fields.username = "Use 3 to 30 letters, numbers or underscores.";
  if (fullName.length > 120 || fullName.split(/\s+/).filter(Boolean).length < 2) fields.fullName = "Enter your first and last name.";
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  return fields;
}

export async function login(_prev: AuthFormState | undefined, data: FormData): Promise<AuthFormState> {
  const username = field(data, "username").trim();
  const password = field(data, "password");
  const values = { username, fullName: "" };
  if (!username || !password) return { error: "Enter your username and password.", values };

  const ip = await clientId();
  const keys = [`ip:${ip}`, `user:${ip}:${username.toLowerCase()}`];
  if (isThrottled(keys[0], 30) || isThrottled(keys[1], 6)) {
    return { error: "Too many attempts. Wait a few minutes and try again.", values };
  }

  let result;
  try {
    result = await authRequest("login", { username, password });
  } catch (error) {
    console.error("[auth] login request failed:", error);
    return { error: "Couldn't reach the sign-in service. Try again in a moment.", values };
  }

  if (result.status === 401) {
    keys.forEach(recordAttempt);
    return { error: "Invalid username or password.", values };
  }
  if (!result.ok || !result.data.user) {
    console.error("[auth] login failed:", result.url, result.status, result.data);
    return { error: result.data.error ?? "Couldn't sign you in. Try again.", values };
  }

  keys.forEach(clearFailures);
  const user = { userId: result.data.user.user_id, username: result.data.user.username, fullName: result.data.user.full_name };
  await startSession(user);
  await listInDirectory(user);
  redirect("/");
}

export async function signup(_prev: AuthFormState | undefined, data: FormData): Promise<AuthFormState> {
  const username = field(data, "username").trim();
  const fullName = field(data, "fullName").trim().replace(/\s+/g, " ");
  const password = field(data, "password");
  const values = { username, fullName };

  const fields = validateSignup(username, fullName, password);
  if (Object.keys(fields ?? {}).length) return { fields, values };

  const ip = await clientId();
  if (isThrottled(`signup:${ip}`, 10)) return { error: "Too many sign-ups from here. Try again later.", values };
  recordAttempt(`signup:${ip}`);

  let result;
  try {
    result = await authRequest("signup", { username, full_name: fullName, password });
  } catch (error) {
    console.error("[auth] signup request failed:", error);
    return { error: "Couldn't reach the sign-up service. Try again in a moment.", values };
  }

  if (result.status === 409) return { fields: { username: "That username is taken." }, values };
  if (!result.ok || !result.data.user) {
    console.error("[auth] signup failed:", result.url, result.status, result.data);
    return { error: result.data.error ?? "Couldn't create your account. Try again.", values };
  }

  const user = { userId: result.data.user.user_id, username: result.data.user.username, fullName: result.data.user.full_name };
  await startSession(user);
  await listInDirectory(user);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

export interface PasswordFormState {
  error?: string;
  fields?: Partial<Record<"username" | "code" | "current" | "password" | "confirm", string>>;
  /** Echoed back so a failed submit doesn't clear what was typed. Never a password or code. */
  username?: string;
  done?: boolean;
}

function validateNewPassword(password: string, confirm: string): PasswordFormState["fields"] {
  const fields: NonNullable<PasswordFormState["fields"]> = {};
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  else if (password !== confirm) fields.confirm = "The passwords don't match.";
  return fields;
}

/**
 * Signed-out reset. The code comes from the admin, who issues it out of band; this form only
 * redeems it. Every "no" is answered the same way so it can't be used to discover usernames.
 */
export async function resetPassword(_prev: PasswordFormState | undefined, data: FormData): Promise<PasswordFormState> {
  const username = field(data, "username").trim();
  const code = field(data, "code").trim();
  const password = field(data, "password");
  const confirm = field(data, "confirm");
  if (!username || !code) return { error: "Enter your username and the reset code.", username };
  const fields = validateNewPassword(password, confirm);
  if (Object.keys(fields ?? {}).length) return { fields, username };

  const ip = await clientId();
  const keys = [`reset-ip:${ip}`, `reset-user:${username.toLowerCase()}`];
  if (isThrottled(keys[0], 20) || isThrottled(keys[1], 6)) {
    return { error: "Too many attempts. Wait a few minutes and try again.", username };
  }

  let result;
  try {
    result = await updatePassword({ username, code, password });
  } catch (error) {
    console.error("[auth] password reset request failed:", error);
    return { error: "Couldn't reach the sign-in service. Try again in a moment.", username };
  }

  if (result.ok) {
    keys.forEach(clearFailures);
    return { done: true };
  }
  if (result.status === 404 || result.status === 400) {
    keys.forEach(recordAttempt);
    return { error: "That username and reset code don't match. Check them, or ask for a new code.", username };
  }
  console.error("[auth] password reset failed:", result.url, result.status, result.data);
  return { error: "Couldn't reset your password. Try again.", username };
}

/** Signed-in change. The current password proves who is asking, then the reset flow is run on their behalf. */
export async function changePassword(_prev: PasswordFormState | undefined, data: FormData): Promise<PasswordFormState> {
  const session = await requireSession();
  const current = field(data, "current");
  const password = field(data, "password");
  const confirm = field(data, "confirm");
  if (!current) return { fields: { current: "Enter your current password." } };
  const fields = validateNewPassword(password, confirm);
  if (Object.keys(fields ?? {}).length) return { fields };

  const key = `change:${session.userId}`;
  if (isThrottled(key, 6)) return { error: "Too many attempts. Wait a few minutes and try again." };

  try {
    const check = await authRequest("login", { username: session.username, password: current });
    if (check.status === 401) {
      recordAttempt(key);
      return { fields: { current: "That isn't your current password." } };
    }
    if (!check.ok) throw new Error(`login check failed (${check.status})`);

    const issued = await requestResetCode(session.username);
    if (!issued.ok || !issued.data.reset_code) throw new Error(`reset code failed (${issued.status})`);
    const updated = await updatePassword({ username: session.username, code: issued.data.reset_code, password });
    if (!updated.ok) throw new Error(`update failed (${updated.status}): ${updated.data.error}`);
  } catch (error) {
    console.error("[auth] change password failed:", error);
    return { error: "Couldn't change your password. Try again in a moment." };
  }

  clearFailures(key);
  return { done: true };
}
