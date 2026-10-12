"use client";

import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { Toggle } from "radix-ui";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { login, signup, type AuthFormState } from "@/app/actions/auth";
import { BuiltBy } from "@/components/BuiltBy";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/Button";
import { describedBy, Field, inputClass } from "@/components/ui/Field";
import styles from "./AuthForm.module.css";

const COPY = {
  login: {
    title: "Welcome back",
    lede: "Sign in to pick up where you left off.",
    action: login,
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "New to The Archive?",
    switchLink: { href: "/signup", label: "Create an account" },
  },
  signup: {
    title: "Start your library",
    lede: "One account keeps your books, films, series and anime together.",
    action: signup,
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLink: { href: "/login", label: "Sign in" },
  },
} as const;

export function AuthForm({ mode, covers }: { mode: "login" | "signup"; covers: ReactNode }) {
  const copy = COPY[mode];
  const uid = useId();
  const [state, formAction, pending] = useActionState<AuthFormState | undefined, FormData>(copy.action, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const fields = state?.fields ?? {};
  const id = (name: string) => `${uid}-${name}`;
  const passwordHint = mode === "signup" ? "At least 8 characters." : undefined;
  const usernameHint = mode === "signup" ? "Letters, numbers and underscores." : undefined;

  // Focus the first field on desktop only: on a phone it would raise the keyboard over the page before anyone has read it.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) usernameRef.current?.focus();
  }, []);

  return (
    <div className={styles.page}>
      <aside className={styles.lit} aria-hidden="true">
        {covers}
        <p className={styles.tagline}>Every story you’ve finished, filed away and kept.</p>
      </aside>

      <section className={styles.panel} aria-labelledby={id("heading")}>
        <Wordmark />

        <div className={styles.head}>
          <h1 id={id("heading")} className={styles.title}>
            {copy.title}
          </h1>
          <p className={styles.lede}>{copy.lede}</p>
        </div>

        {/* Remounted on each response so the values it echoes back become the new defaults. */}
        <form key={state ? `${state.error ?? ""}|${JSON.stringify(state.values)}|${JSON.stringify(state.fields)}` : "initial"} action={formAction} className={styles.form} noValidate>
          {state?.error && (
            <p className={styles.alert} role="alert">
              {state.error}
            </p>
          )}

          <Field label="Username" htmlFor={id("username")} error={fields.username} hint={usernameHint}>
            <input
              ref={usernameRef}
              id={id("username")}
              name="username"
              className={inputClass}
              defaultValue={state?.values?.username}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              required
              aria-invalid={fields.username ? true : undefined}
              aria-describedby={describedBy(id("username"), { error: fields.username, hint: usernameHint })}
            />
          </Field>

          {mode === "signup" && (
            <Field label="Full name" htmlFor={id("fullName")} error={fields.fullName}>
              <input
                id={id("fullName")}
                name="fullName"
                className={inputClass}
                defaultValue={state?.values?.fullName}
                autoComplete="name"
                enterKeyHint="next"
                required
                aria-invalid={fields.fullName ? true : undefined}
                aria-describedby={describedBy(id("fullName"), { error: fields.fullName })}
              />
            </Field>
          )}

          <Field label="Password" htmlFor={id("password")} error={fields.password} hint={passwordHint}>
            <div className={styles.secret}>
              <input
                id={id("password")}
                name="password"
                className={`${inputClass} ${styles.secretInput}`}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                enterKeyHint="go"
                required
                aria-invalid={fields.password ? true : undefined}
                aria-describedby={describedBy(id("password"), { error: fields.password, hint: passwordHint })}
              />
              <Toggle.Root className={styles.reveal} pressed={showPassword} onPressedChange={setShowPassword} aria-label="Show password">
                {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </Toggle.Root>
            </div>
          </Field>

          <Button type="submit" variant="solid" className={styles.submit} disabled={pending} aria-busy={pending}>
            {pending ? copy.pending : copy.submit}
          </Button>
        </form>

        <p className={styles.switch}>
          {copy.switchText} <Link href={copy.switchLink.href}>{copy.switchLink.label}</Link>
        </p>
      </section>

      <div className={styles.credit}>
        <BuiltBy />
      </div>
    </div>
  );
}
