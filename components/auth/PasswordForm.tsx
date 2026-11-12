"use client";

import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { Toggle } from "radix-ui";
import Link from "next/link";
import { useActionState, useId, useState, type ReactNode } from "react";
import { changePassword, resetPassword, type PasswordFormState } from "@/app/actions/auth";
import { BuiltBy } from "@/components/BuiltBy";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/Button";
import { describedBy, Field, inputClass } from "@/components/ui/Field";
import styles from "./AuthForm.module.css";

/** `reset` is the signed-out page (username + admin-issued code); `change` lives inside the app. */
export function PasswordForm({ mode, covers }: { mode: "reset" | "change"; covers?: ReactNode }) {
  const uid = useId();
  const reset = mode === "reset";
  const [state, formAction, pending] = useActionState<PasswordFormState | undefined, FormData>(reset ? resetPassword : changePassword, undefined);
  const [show, setShow] = useState(false);
  const fields = state?.fields ?? {};
  const id = (name: string) => `${uid}-${name}`;

  const secret = (name: "current" | "password" | "confirm", label: string, autoComplete: string, hint?: string) => (
    <Field label={label} htmlFor={id(name)} error={fields[name]} hint={hint}>
      <div className={styles.secret}>
        <input
          id={id(name)}
          name={name}
          className={`${inputClass} ${styles.secretInput}`}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={fields[name] ? true : undefined}
          aria-describedby={describedBy(id(name), { error: fields[name], hint })}
        />
        {name === "password" || name === "current" ? (
          <Toggle.Root className={styles.reveal} pressed={show} onPressedChange={setShow} aria-label="Show passwords">
            {show ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </Toggle.Root>
        ) : null}
      </div>
    </Field>
  );

  const body = state?.done ? (
    <div className={styles.form}>
      <p className={styles.notice} role="status">
        {reset ? "Your password has been reset." : "Your password has been changed."}
      </p>
      {reset && (
        <p className={styles.switch}>
          <Link href="/login">Sign in with your new password</Link>
        </p>
      )}
    </div>
  ) : (
    <form action={formAction} className={styles.form} noValidate>
      {state?.error && (
        <p className={styles.alert} role="alert">
          {state.error}
        </p>
      )}
      {reset ? (
        <>
          <Field label="Username" htmlFor={id("username")}>
            <input
              id={id("username")}
              name="username"
              className={inputClass}
              defaultValue={state?.username}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field label="Reset code" htmlFor={id("code")} hint="The one-time code your admin gave you. It is case-sensitive.">
            <input
              id={id("code")}
              name="code"
              className={inputClass}
              autoComplete="one-time-code"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-describedby={`${id("code")}-hint`}
            />
          </Field>
        </>
      ) : (
        secret("current", "Current password", "current-password")
      )}
      {secret("password", "New password", "new-password", "At least 8 characters.")}
      {secret("confirm", "Confirm new password", "new-password")}
      <Button type="submit" variant="solid" className={styles.submit} disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : reset ? "Reset password" : "Change password"}
      </Button>
    </form>
  );

  if (!reset) {
    return (
      <section className={`${styles.panel} ${styles.inApp}`} aria-labelledby={id("heading")}>
        <div className={styles.head}>
          <h1 id={id("heading")} className={styles.title}>
            Change password
          </h1>
          <p className={styles.lede}>Enter your current password, then choose a new one.</p>
        </div>
        {body}
      </section>
    );
  }

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
            Reset your password
          </h1>
          <p className={styles.lede}>Forgot it? Ask the admin for a one-time reset code, then enter it here with your username.</p>
        </div>
        {body}
        <p className={styles.switch}>
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </section>
      <div className={styles.credit}>
        <BuiltBy />
      </div>
    </div>
  );
}
