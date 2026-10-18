"use client";

import { Slider } from "radix-ui";
import { useState } from "react";
import { useMedia } from "@/lib/media/store";
import type { MediaItem } from "@/lib/media/types";
import styles from "./RatingEditor.module.css";

const format = (value: number | null) => (value === null ? "Not rated" : `${value.toFixed(value % 1 ? 1 : 0)} / 10`);

/** The rating as a slider (0 means not rated). The value follows the thumb while dragging and is saved on release. */
export function RatingEditor({ item }: { item: MediaItem }) {
  const { save } = useMedia();
  const [dragging, setDragging] = useState<number | null>(null);
  const value = dragging ?? item.rating ?? 0;

  return (
    <div className={styles.editor}>
      <Slider.Root
        className={styles.slider}
        min={0}
        max={10}
        step={0.5}
        value={[value]}
        onValueChange={([v]) => setDragging(v)}
        onValueCommit={([v]) => {
          setDragging(null);
          const next = v > 0 ? v : null;
          if (next !== item.rating) save({ ...item, rating: next });
        }}
      >
        <Slider.Track className={styles.track}>
          <Slider.Range className={styles.range} />
        </Slider.Track>
        <Slider.Thumb className={styles.thumb} aria-label={`Rating for ${item.title}`} />
      </Slider.Root>
      <output className={styles.value} aria-live="polite">
        {format(value > 0 ? value : null)}
      </output>
    </div>
  );
}
