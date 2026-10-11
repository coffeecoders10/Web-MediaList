import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "solid" | "quiet" | "outline" | "danger" | "float";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  /** Square button for a single icon; always pass an aria-label. */
  icon?: boolean;
}

export function buttonClass({ variant = "outline", size = "md", icon = false }: Pick<ButtonProps, "variant" | "size" | "icon">) {
  return [styles.button, styles[variant], styles[size], icon ? styles.icon : ""].filter(Boolean).join(" ");
}

export function Button({ variant, size, icon, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={[buttonClass({ variant, size, icon }), className].filter(Boolean).join(" ")} {...props} />;
}
