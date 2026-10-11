"use client";

import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { useId, useState } from "react";
import { ProgressLeader } from "@/components/media/Marks";
import { Button } from "@/components/ui/Button";
import { formatRuntime } from "@/lib/media/format";
import {
  episodePosition,
  setChaptersRead,
  setPagesRead,
  setWatchedEpisodes,
  totalEpisodes,
} from "@/lib/media/progress";
import type { Book, Episodic, MediaItem } from "@/lib/media/types";
import styles from "./ProgressPanel.module.css";

interface Props {
  item: MediaItem;
  editable: boolean;
  onChange: (item: MediaItem) => void;
}

export function ProgressPanel({ item, editable, onChange }: Props) {
  switch (item.category) {
    case "book":
      return <BookProgress book={item} editable={editable} onChange={onChange} />;
    case "movie":
      return item.runtimeMinutes ? (
        <p className={styles.plain}>
          Runtime <strong>{formatRuntime(item.runtimeMinutes)}</strong>
        </p>
      ) : null;
    default:
      return <EpisodeProgress item={item} editable={editable} onChange={onChange} />;
  }
}

/** Number field with − and + buttons. Typing commits on blur or Enter so half-typed values don't jump around. */
function Stepper({ label, value, max, step = 1, onChange }: { label: string; value: number; max: number | null; step?: number; onChange: (n: number) => void }) {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(0, max ? Math.min(max, n) : n);
  const commit = () => {
    if (typed !== null && /^\d+$/.test(typed.trim())) onChange(clamp(Number(typed)));
    setTyped(null);
  };
  return (
    <div className={styles.stepper}>
      <label htmlFor={id} className={styles.stepLabel}>
        {label}
      </label>
      <div className={styles.stepControls}>
        <Button variant="outline" size="sm" icon aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= 0} onClick={() => onChange(clamp(value - step))}>
          <MinusIcon />
        </Button>
        <input
          id={id}
          className={styles.stepInput}
          inputMode="numeric"
          value={typed ?? value}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        />
        <Button variant="outline" size="sm" icon aria-label={`Increase ${label.toLowerCase()}`} disabled={max !== null && value >= max} onClick={() => onChange(clamp(value + step))}>
          <PlusIcon />
        </Button>
        {max !== null && <span className={styles.stepMax}>of {max}</span>}
      </div>
    </div>
  );
}

function BookProgress({ book, editable, onChange }: { book: Book; editable: boolean; onChange: (b: Book) => void }) {
  const hasPages = book.pagesTotal !== null;
  const hasChapters = book.chaptersTotal !== null;
  return (
    <div className={styles.panel}>
      {book.series && (
        <p className={styles.plain}>
          {book.series.name}, book <strong>{book.series.volume}</strong>
          {book.series.of ? ` of ${book.series.of}` : ""}
        </p>
      )}
      {(hasPages || hasChapters) && <ProgressLeader item={book} />}
      {editable ? (
        <div className={styles.steppers}>
          {(hasPages || !hasChapters) && (
            <Stepper label="Pages read" value={book.pagesRead} max={book.pagesTotal} step={10} onChange={(n) => onChange(setPagesRead(book, n))} />
          )}
          {hasChapters && <Stepper label="Chapters read" value={book.chaptersRead} max={book.chaptersTotal} onChange={(n) => onChange(setChaptersRead(book, n))} />}
        </div>
      ) : (
        hasPages &&
        hasChapters && (
          <p className={styles.plain}>
            Chapter <strong>{book.chaptersRead}</strong> of {book.chaptersTotal}
          </p>
        )
      )}
    </div>
  );
}

function EpisodeProgress({ item, editable, onChange }: { item: Episodic; editable: boolean; onChange: (i: Episodic) => void }) {
  const total = totalEpisodes(item);
  const position = episodePosition(item);
  const multi = item.seasons.length > 1;
  const dense = total > 40;
  // Episode number before each season starts, so season rows don't depend on render order.
  const starts = item.seasons.map((_, i) => item.seasons.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className={styles.panel}>
      <ProgressLeader item={item} />
      <p className={styles.plain}>
        {position ? (
          <>
            Last watched <strong>{multi ? `season ${position.season}, episode ${position.episode}` : `episode ${position.episode}`}</strong>
          </>
        ) : (
          "Not started yet"
        )}
      </p>

      {editable && (
        <div className={styles.quick}>
          <Button variant="solid" size="sm" disabled={item.watchedEpisodes >= total} onClick={() => onChange(setWatchedEpisodes(item, item.watchedEpisodes + 1))}>
            <PlusIcon aria-hidden="true" /> Watched next episode
          </Button>
          <Button variant="outline" size="sm" disabled={item.watchedEpisodes === 0} onClick={() => onChange(setWatchedEpisodes(item, item.watchedEpisodes - 1))}>
            <MinusIcon aria-hidden="true" /> Undo one
          </Button>
        </div>
      )}

      <div className={styles.seasons}>
        {item.seasons.map((count, s) => {
          const start = starts[s];
          const watched = Math.max(0, Math.min(count, item.watchedEpisodes - start));
          return (
            <section key={s} className={styles.season} aria-label={`Season ${s + 1}`}>
              {(multi || editable) && (
                <h3 className={styles.seasonHead}>
                  {multi ? `Season ${s + 1}` : "Episodes"}
                  <span>
                    {watched} / {count}
                  </span>
                </h3>
              )}
              <ol className={`${styles.pips} ${dense ? styles.dense : ""}`}>
                {Array.from({ length: count }, (_, e) => {
                  const overall = start + e + 1;
                  const done = overall <= item.watchedEpisodes;
                  return (
                    <li key={e}>
                      {editable ? (
                        <button
                          type="button"
                          className={styles.pip}
                          data-done={done || undefined}
                          aria-pressed={done}
                          aria-label={`${multi ? `Season ${s + 1}, ` : ""}episode ${e + 1}`}
                          title={`${multi ? `S${s + 1} ` : ""}E${e + 1}`}
                          // Pressing the last watched episode again steps back one.
                          onClick={() => onChange(setWatchedEpisodes(item, overall === item.watchedEpisodes ? overall - 1 : overall))}
                        />
                      ) : (
                        <span className={styles.pip} data-done={done || undefined} title={`${multi ? `S${s + 1} ` : ""}E${e + 1}${done ? ", watched" : ""}`} />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
