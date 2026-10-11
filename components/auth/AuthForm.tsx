"use client";

import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { Toggle } from "radix-ui";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { login, signup, type AuthFormState } from "@/app/actions/auth";
import { BuiltBy } from "@/components/BuiltBy";
import { Wordmark } from "@/components/Wordmark";
import { Cover } from "@/components/Cover";
import { Button } from "@/components/ui/Button";
import { describedBy, Field, inputClass } from "@/components/ui/Field";
import { normalizeItem } from "@/lib/media/normalize";
import type { MediaItem } from "@/lib/media/types";
import styles from "./AuthForm.module.css";

/** Decorative covers for the lit panel, drawn from the generated-cover system rather than real artwork. */
const COVERS = [
  { title: "Dune", category: "book", art: { hue: 62, pattern: "sun" } },
  { title: "Piranesi", category: "book", art: { hue: 195, pattern: "arches" } },
  { title: "Spirited Away", category: "movie", art: { hue: 330, pattern: "rays" } },
]
  .map((c, i) => normalizeItem({ ...c, id: `cover-${i}` }))
  .filter((c): c is MediaItem => c !== null);

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

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const copy = COPY[mode];
  const uid = useId();
  const [state, formAction, pending] = useActionState<AuthFormState | undefined, FormData>(copy.action, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const fields = state?.fields ?? {};
  const id = (name: string) => `${uid}-${name}`;
  const passwordHint = mode === "signup" ? "At least 8 characters." : undefined;
  const usernameHint = mode === "signup" ? "Letters, numbers and underscores." : undefined;

  return (
    <div className={styles.page}>
      <aside className={styles.lit} aria-hidden="true">
        <div className={styles.covers}>
          {COVERS.map((item, i) => (
            <div key={item.id} className={styles.coverSlot} data-slot={i}>
              <Cover item={item} />
            </div>
          ))}
        </div>
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
              id={id("username")}
              name="username"
              className={inputClass}
              defaultValue={state?.values?.username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
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

        <BuiltBy />
      </section>
    </div>
  );
}
