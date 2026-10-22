import type { Person } from "./ProfileProviders";
import styles from "./Avatar.module.css";

/** Two initials, from the full name when there is one. */
function initialsOf({ username, fullName }: Person): string {
  const words = fullName.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? username).slice(0, 2);
  return letters.toUpperCase();
}

/** A hue that is the same for the same username every time, so a person is recognisable at a glance. */
function hueOf(username: string): number {
  let hash = 0;
  for (const ch of username.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

export function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`} style={{ "--hue": hueOf(person.username) } as React.CSSProperties} aria-hidden="true">
      {initialsOf(person)}
    </span>
  );
}
