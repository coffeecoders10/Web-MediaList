import { Wordmark } from "@/components/Wordmark";
import header from "@/components/AppHeader.module.css";
import styles from "@/components/library/LibraryView.module.css";

/** Held on screen while the session and collection load, shaped like the library it becomes. */
export function AppFallback() {
  return (
    <div aria-busy="true">
      <header className={header.header}>
        <div className={`shell ${header.bar}`}>
          <Wordmark />
        </div>
      </header>
      <main>
        <div className={`shell ${styles.page}`}>
          <div className={styles.skeletonPanel} aria-hidden="true" />
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
          <p className="sr-only" role="status">
            Loading your collection
          </p>
        </div>
      </main>
    </div>
  );
}
