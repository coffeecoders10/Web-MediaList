"use client";

import { ToggleGroup } from "radix-ui";
import { useId, type InputHTMLAttributes } from "react";
import { Field } from "@/components/ui/Field";
import { isTrackingMode, type TrackingMode } from "@/lib/media/types";
import type { Draft, DraftErrors, TextKey } from "./draft";
import styles from "./EditorDrawer.module.css";

export type Bind = (key: TextKey, extra?: InputHTMLAttributes<HTMLInputElement>) => InputHTMLAttributes<HTMLInputElement> & { id: string };

interface Props {
  draft: Draft;
  errors: DraftErrors;
  bind: Bind;
  onTracking: (mode: TrackingMode) => void;
}

const MODES: { value: TrackingMode; label: string }[] = [
  { value: "seasons", label: "Seasons" },
  { value: "episodes", label: "Episodes" },
];

/** A "current of total" pair of number inputs. */
function Pair({ current, total, currentLabel, totalLabel, bind, errors }: {
  current: TextKey;
  total: TextKey;
  currentLabel: string;
  totalLabel: string;
  bind: Bind;
  errors: DraftErrors;
}) {
  const currentProps = bind(current, { inputMode: "numeric" });
  const totalProps = bind(total, { inputMode: "numeric" });
  return (
    <div className={styles.row}>
      <Field label={currentLabel} htmlFor={currentProps.id} error={errors[current]}>
        <input {...currentProps} />
      </Field>
      <Field label={totalLabel} htmlFor={totalProps.id} error={errors[total]}>
        <input {...totalProps} />
      </Field>
    </div>
  );
}

/**
 * The progress inputs for a category, showing only what applies: chapters for books, seasons for TV,
 * and for anime either seasons or episodes depending on the mode picked. Movies have no progress.
 */
export function ProgressFields({ draft, errors, bind, onTracking }: Props) {
  const trackingLabel = useId();
  const pair = (current: TextKey, total: TextKey, noun: string, past: string) => (
    <Pair current={current} total={total} currentLabel={past} totalLabel={`Total ${noun}`} bind={bind} errors={errors} />
  );

  let body;
  switch (draft.category) {
    case "book":
      body = pair("chaptersRead", "chaptersTotal", "chapters", "Chapters read");
      break;
    case "series":
      body = pair("currentSeason", "totalSeasons", "seasons", "Current season");
      break;
    case "anime":
      body = (
        <>
          <div className={styles.field}>
            <span className={styles.groupLabel} id={trackingLabel}>
              Track progress by
            </span>
            <ToggleGroup.Root
              type="single"
              value={draft.tracking}
              onValueChange={(v) => isTrackingMode(v) && onTracking(v)}
              aria-labelledby={trackingLabel}
              className={styles.segmented}
            >
              {MODES.map((m) => (
                <ToggleGroup.Item key={m.value} value={m.value} className={styles.segment}>
                  {m.label}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>
          {draft.tracking === "seasons"
            ? pair("currentSeason", "totalSeasons", "seasons", "Current season")
            : pair("currentEpisode", "totalEpisodes", "episodes", "Current episode")}
        </>
      );
      break;
    default:
      return null;
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Progress</legend>
      {body}
    </fieldset>
  );
}
