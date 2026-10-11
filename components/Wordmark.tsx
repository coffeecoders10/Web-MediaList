import Link from "next/link";
import styles from "./AppHeader.module.css";

export function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="The Archive, home">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none">
        {/* Steam */}
        <path
          d="M8 1.5c-1 1 1 2 0 3.2M12 1c-1 1.2 1 2.3 0 3.7"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Handle */}
        <path d="M17.5 9.5h1.4a2.6 2.6 0 0 1 0 5.2h-1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* Cup, with the coffee line inside */}
        <path d="M3.5 7.5h14v7.5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M5 11h11v4a3.5 3.5 0 0 1-3.5 3.5h-4A3.5 3.5 0 0 1 5 15z" fill="var(--lit)" />
        {/* Saucer */}
        <path d="M2 22.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>The Archive</span>
    </Link>
  );
}
