import { Suspense, type CSSProperties } from "react";
import { RandomCovers } from "./RandomCovers";
import styles from "./AuthForm.module.css";

/** Same footprint as the real covers, so the layout doesn't shift when the posters arrive. */
function CoverSkeletons() {
  return (
    <div className={styles.covers} role="status" aria-label="Loading posters">
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.coverSlot} data-slot={i}>
          <div className={styles.skeleton} style={{ "--i": i } as CSSProperties} />
        </div>
      ))}
    </div>
  );
}

export function AuthCovers() {
  return (
    <Suspense fallback={<CoverSkeletons />}>
      <RandomCovers />
    </Suspense>
  );
}
