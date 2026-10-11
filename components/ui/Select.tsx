"use client";

import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { Select as RadixSelect } from "radix-ui";
import type { ReactNode } from "react";
import styles from "./Select.module.css";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading element, e.g. a status glyph. */
  leading?: ReactNode;
}

interface SelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Accessible name; also shown as a muted prefix when `prefix` is true. */
  label: string;
  prefix?: boolean;
  id?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  prefix = false,
  id,
  size = "md",
  className,
}: SelectProps<T>) {
  const current = options.find((o) => o.value === value);
  return (
    <RadixSelect.Root value={value} onValueChange={(v) => onValueChange(v as T)}>
      <RadixSelect.Trigger
        id={id}
        aria-label={label}
        className={[styles.trigger, size === "sm" ? styles.sm : "", className].filter(Boolean).join(" ")}
      >
        {prefix && <span className={styles.prefix}>{label}</span>}
        <span className={styles.value}>
          {current?.leading}
          <RadixSelect.Value />
        </span>
        <RadixSelect.Icon className={styles.chevron}>
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className={styles.content} position="popper" sideOffset={6} collisionPadding={12}>
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((o) => (
              <RadixSelect.Item key={o.value} value={o.value} className={styles.item}>
                {o.leading}
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className={styles.indicator}>
                  <CheckIcon />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
