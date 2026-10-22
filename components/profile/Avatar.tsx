import { Blobatar } from "@blobatar/react";
import type { Person } from "./ProfileProviders";
import styles from "./Avatar.module.css";

const PIXELS = { sm: 28, md: 40, lg: 64 } as const;

/** A generated face seeded by username, so a person looks the same everywhere. */
export function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">
      <Blobatar name={person.username.toLowerCase()} size={PIXELS[size]} />
    </span>
  );
}
