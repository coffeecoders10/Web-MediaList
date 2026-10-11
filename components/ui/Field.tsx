import type { ReactNode } from "react";
import styles from "./Field.module.css";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired up with ids that match the input's aria attributes. */
export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const describedBy = (id: string, { error, hint }: { error?: string; hint?: string }) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export const inputClass = styles.input;
export const textareaClass = `${styles.input} ${styles.textarea}`;
