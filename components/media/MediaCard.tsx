"use client";

import { Pencil1Icon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { Button } from "@/components/ui/Button";
import { StatusGlyph } from "@/components/ui/Icons";
import { useWorkspace } from "@/components/workspace/Workspace";
import { bylineOf } from "@/lib/media/format";
import { quickStep } from "@/lib/media/progress";
import { useMedia } from "@/lib/media/store";
import { STATUS_LABEL, type MediaItem } from "@/lib/media/types";
import { CategoryTag, ProgressLeader, Rating, SeriesLine } from "./Marks";
import styles from "./MediaCard.module.css";

export function MediaCard({ item }: { item: MediaItem }) {
  const { editMode, openEditor, requestDelete } = useWorkspace();
  const { save } = useMedia();
  const step = editMode ? quickStep(item) : null;
  const showProgress = item.status === "in-progress" || item.status === "on-hold";

  return (
    <article className={styles.card}>
      <div className={styles.frame}>
        <Cover item={item} />
        <span className={styles.status} data-status={item.status} title={STATUS_LABEL[item.status]}>
          <StatusGlyph status={item.status} size={15} />
          <span className="sr-only">{STATUS_LABEL[item.status]}</span>
        </span>
      </div>
      {showProgress && (
        <div className={styles.progress}>
          <ProgressLeader item={item} label={false} />
        </div>
      )}

      <div className={styles.meta}>
        <h3 className={styles.title}>
          <Link href={`/media/${item.id}`} className={styles.link}>
            {item.title}
          </Link>
        </h3>
        <p className={styles.byline}>{bylineOf(item)}</p>
        {item.category === "book" && item.series && <SeriesLine series={item.series} />}
        <div className={styles.foot}>
          <CategoryTag category={item.category} />
          <Rating value={item.rating} />
        </div>
      </div>

      {editMode && (
        <div className={styles.actions}>
          {step && (
            <Button size="sm" variant="float" onClick={() => save(step.apply())} aria-label={`${step.label} for ${item.title}`}>
              <PlusIcon aria-hidden="true" />
              {step.label.replace("+", "")}
            </Button>
          )}
          <Button size="sm" variant="float" icon aria-label={`Edit ${item.title}`} onClick={() => openEditor({ mode: "edit", id: item.id })}>
            <Pencil1Icon />
          </Button>
          <Button size="sm" variant="float" icon aria-label={`Delete ${item.title}`} onClick={() => requestDelete(item)}>
            <TrashIcon />
          </Button>
        </div>
      )}
    </article>
  );
}
