import { CategoryIcon, StatusGlyph } from "@/components/ui/Icons";
import { getProgress } from "@/lib/media/progress";
import { CATEGORY_LABEL, STATUS_LABEL, type BookSeries, type Category, type MediaItem, type Status } from "@/lib/media/types";
import styles from "./Marks.module.css";

export function StatusMark({ status, compact = false }: { status: Status; compact?: boolean }) {
  return (
    <span className={styles.status} data-status={status}>
      <StatusGlyph status={status} size={compact ? 14 : 16} />
      <span className={compact ? "sr-only" : undefined}>{STATUS_LABEL[status]}</span>
    </span>
  );
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className={styles.category}>
      <CategoryIcon category={category} size={14} />
      {CATEGORY_LABEL[category].singular}
    </span>
  );
}

export function Rating({ value, size = "md" }: { value: number | null; size?: "md" | "lg" }) {
  if (value === null) {
    return (
      <span className={`${styles.rating} ${styles.unrated}`}>
        <span aria-hidden="true">–</span>
        <span className="sr-only">Not rated</span>
      </span>
    );
  }
  return (
    <span className={`${styles.rating} ${size === "lg" ? styles.ratingLg : ""}`}>
      <span className="sr-only">Rated </span>
      {value.toFixed(value % 1 ? 1 : 0)}
      <span className={styles.outOf}>
        <span aria-hidden="true">/10</span>
        <span className="sr-only"> out of 10</span>
      </span>
    </span>
  );
}

/** A book's series on one row: the name (which truncates) and its volume number (which never does). */
export function SeriesLine({ series, className }: { series: BookSeries; className?: string }) {
  return (
    <p className={[styles.series, className].filter(Boolean).join(" ")}>
      <span className={styles.seriesName}>{series.name}</span>
      {series.volume !== null && <span className={styles.volume}>Vol. {series.volume}</span>}
    </p>
  );
}

/**
 * A measuring-rule progress bar: the ticks mark every tenth of the way. Without a known total there is
 * nothing to measure against, so only the position is shown.
 */
export function ProgressLeader({ item, label = true }: { item: MediaItem; label?: boolean }) {
  const progress = getProgress(item);
  if (!progress) return null;
  if (progress.fraction === null) return label ? <span className={styles.leaderLabel}>{progress.label}</span> : null;
  const pct = Math.round(progress.fraction * 100);
  return (
    <div className={styles.leader} data-status={item.status}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={`${item.title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${progress.label} (${pct}%)`}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      {label && <span className={styles.leaderLabel}>{progress.label}</span>}
    </div>
  );
}
