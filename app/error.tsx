"use client";

import { Button } from "@/components/ui/Button";
import styles from "./error.module.css";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.page}>
      <h1>We couldn’t load your library</h1>
      <p>The library service didn’t respond. Your collection is safe; this is usually a short interruption.</p>
      <Button variant="solid" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
