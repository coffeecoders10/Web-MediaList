import Link from "next/link";
import styles from "./AppHeader.module.css";

export function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="Lightbox, home">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="6" y="6" width="10" height="10" rx="2" fill="var(--lit)" />
      </svg>
      <span>Lightbox</span>
    </Link>
  );
}
