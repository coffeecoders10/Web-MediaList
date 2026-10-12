"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { useState, type KeyboardEvent } from "react";
import { inputClass } from "@/components/ui/Field";
import styles from "./GenreInput.module.css";

interface GenreInputProps {
  id: string;
  value: string[];
  onChange: (genres: string[]) => void;
  suggestions: string[];
}

const clean = (text: string) => text.trim().replace(/\s+/g, " ");

/** Tag-style genre entry: Enter or comma adds, Backspace on an empty field removes the last one. */
export function GenreInput({ id, value, onChange, suggestions }: GenreInputProps) {
  const [text, setText] = useState("");
  const has = (g: string) => value.some((v) => v.toLowerCase() === g.toLowerCase());

  const add = (raw: string) => {
    const g = clean(raw);
    if (g && !has(g)) onChange([...value, g.charAt(0).toUpperCase() + g.slice(1)]);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const open = suggestions
    .filter((s) => !has(s) && s.toLowerCase().includes(text.toLowerCase()))
    .slice(0, 8);

  return (
    <div className={styles.wrap}>
      {value.length > 0 && (
        <ul className={styles.tags} aria-label="Selected genres">
          {value.map((g) => (
            <li key={g} className={styles.tag}>
              {g}
              <button type="button" className={styles.remove} onClick={() => onChange(value.filter((v) => v !== g))} aria-label={`Remove ${g}`}>
                <Cross2Icon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className={inputClass}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(text)}
        placeholder="Type a genre, press Enter"
        autoComplete="off"
      />
      {open.length > 0 && (
        <ul className={styles.suggestions} aria-label="Suggested genres">
          {open.map((s) => (
            <li key={s}>
              <button type="button" className={styles.suggestion} onClick={() => add(s)}>
                + {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
