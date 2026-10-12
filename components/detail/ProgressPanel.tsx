"use client";

import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { useId, useState } from "react";
import { ProgressLeader } from "@/components/media/Marks";
import { Button } from "@/components/ui/Button";
import { setCurrent, trackerOf, type Unit } from "@/lib/media/progress";
import type { MediaItem } from "@/lib/media/types";
import styles from "./ProgressPanel.module.css";

interface Props {
  item: MediaItem;
  editable: boolean;
  onChange: (item: MediaItem) => void;
}

const STEPPER_LABEL: Record<Unit, string> = {
  chapter: "Chapters read",
  season: "Current season",
  episode: "Current episode",
};

/** The progress bar for whatever the entry is counted in, plus (in edit mode) a stepper to move it. Nothing else belongs here. */
export function ProgressPanel({ item, editable, onChange }: Props) {
  const tracker = trackerOf(item);
  if (!tracker) return null;
  return (
    <div className={styles.panel}>
      <ProgressLeader item={item} />
      {editable && <Stepper label={STEPPER_LABEL[tracker.unit]} value={tracker.current} max={tracker.total} onChange={(n) => onChange(setCurrent(item, n))} />}
    </div>
  );
}

/** Number field with − and + buttons. Typing commits on blur or Enter so half-typed values don't jump around. */
function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number | null; onChange: (n: number) => void }) {
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
        <Button variant="outline" size="sm" icon aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= 0} onClick={() => onChange(clamp(value - 1))}>
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
        <Button variant="outline" size="sm" icon aria-label={`Increase ${label.toLowerCase()}`} disabled={max !== null && value >= max} onClick={() => onChange(clamp(value + 1))}>
          <PlusIcon />
        </Button>
        {max !== null && <span className={styles.stepMax}>of {max}</span>}
      </div>
    </div>
  );
}
