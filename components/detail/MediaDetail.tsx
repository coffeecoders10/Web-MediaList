"use client";

import { ArrowLeftIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Cover } from "@/components/Cover";
import { CategoryTag, Rating, StatusMark } from "@/components/media/Marks";
import { MediaCard } from "@/components/media/MediaCard";
import { Button } from "@/components/ui/Button";
import { StatusGlyph } from "@/components/ui/Icons";
import { Select } from "@/components/ui/Select";
import { useWorkspace } from "@/components/workspace/Workspace";
import { formatDate, formatRuntime } from "@/lib/media/format";
import { setStatus } from "@/lib/media/progress";
import { useMedia } from "@/lib/media/store";
import { STATUS_LABEL, STATUSES, type MediaItem, type Status } from "@/lib/media/types";
import { ProgressPanel } from "./ProgressPanel";
import styles from "./MediaDetail.module.css";

export function MediaDetail({ id }: { id: string }) {
  const { get, items, ready, save } = useMedia();
  const { editMode, openEditor, requestDelete } = useWorkspace();
  const router = useRouter();
  const item = get(id);

  const related = useMemo(() => {
    if (!item) return [];
    return items
      .filter((o) => o.id !== item.id)
      .map((o) => ({ o, score: o.genres.filter((g) => item.genres.includes(g)).length + (o.category === item.category ? 0.5 : 0) }))
      .filter((r) => r.score >= 1)
      .sort((a, b) => b.score - a.score || (b.o.rating ?? 0) - (a.o.rating ?? 0))
      .slice(0, 6)
      .map((r) => r.o);
  }, [items, item]);

  if (!ready) {
    return (
      <div className={`shell ${styles.page}`} aria-busy="true">
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className={`shell ${styles.page}`}>
        <div className={styles.missing}>
          <h1>That title isn’t in your collection</h1>
          <p>It may have been deleted, or the link is out of date.</p>
          <Link href="/" className={styles.back}>
            <ArrowLeftIcon aria-hidden="true" /> Back to the library
          </Link>
        </div>
      </div>
    );
  }

  const seriesMates =
    item.category === "book" && item.series
      ? items.filter((o): o is typeof item => o.category === "book" && o.series?.name === item.series?.name && o.id !== item.id)
      : [];

  return (
    <article className={`shell ${styles.page}`}>
      <Link href="/" className={styles.back}>
        <ArrowLeftIcon aria-hidden="true" /> Library
      </Link>

      <div className={styles.layout}>
        <aside className={styles.side}>
          <div className={styles.cover} role="img" aria-label={`Cover of ${item.title}`}>
            <Cover item={item} />
          </div>
          {editMode && (
            <div className={styles.manage}>
              <Button variant="outline" onClick={() => openEditor({ mode: "edit", id: item.id })}>
                <Pencil1Icon aria-hidden="true" /> Edit details
              </Button>
              <Button variant="danger" icon aria-label={`Delete ${item.title}`} onClick={() => requestDelete(item, () => router.replace("/"))}>
                <TrashIcon />
              </Button>
            </div>
          )}
        </aside>

        <div className={styles.main}>
          <header className={styles.head}>
            <CategoryTag category={item.category} />
            <h1 className={styles.title}>{item.title}</h1>
            <p className={styles.byline}>{[item.creator, item.year].filter(Boolean).join(" · ")}</p>
          </header>

          <dl className={styles.facts}>
            <div>
              <dt>Status</dt>
              <dd>
                {editMode ? (
                  <Select<Status>
                    size="sm"
                    label="Status"
                    value={item.status}
                    onValueChange={(s) => save(setStatus(item, s))}
                    options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], leading: <StatusGlyph status={s} size={15} /> }))}
                  />
                ) : (
                  <StatusMark status={item.status} />
                )}
              </dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>
                <Rating value={item.rating} size="lg" />
              </dd>
            </div>
            {item.category === "movie" && item.runtimeMinutes && (
              <div>
                <dt>Runtime</dt>
                <dd>{formatRuntime(item.runtimeMinutes)}</dd>
              </div>
            )}
            {item.category === "book" && item.pagesTotal && (
              <div>
                <dt>Length</dt>
                <dd>{item.pagesTotal} pages</dd>
              </div>
            )}
          </dl>

          {item.category !== "movie" && (
            <section className={styles.section} aria-labelledby="progress-heading">
              <h2 id="progress-heading" className={styles.sectionHead}>
                Progress
              </h2>
              <ProgressPanel item={item} editable={editMode} onChange={(next: MediaItem) => save(next)} />
            </section>
          )}

          {item.genres.length > 0 && (
            <ul className={styles.genres} aria-label="Genres">
              {item.genres.map((g) => (
                <li key={g}>
                  <Link href={`/genres?genre=${encodeURIComponent(g)}`} className={styles.genre}>
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {item.synopsis && <p className={styles.synopsis}>{item.synopsis}</p>}

          {item.notes && (
            <section className={styles.section} aria-labelledby="notes-heading">
              <h2 id="notes-heading" className={styles.sectionHead}>
                Your notes
              </h2>
              <p className={styles.notes}>{item.notes}</p>
            </section>
          )}

          <dl className={styles.dates}>
            <div>
              <dt>Added</dt>
              <dd>{formatDate(item.addedAt)}</dd>
            </div>
            {item.startedAt && (
              <div>
                <dt>Started</dt>
                <dd>{formatDate(item.startedAt)}</dd>
              </div>
            )}
            {item.finishedAt && (
              <div>
                <dt>Finished</dt>
                <dd>{formatDate(item.finishedAt)}</dd>
              </div>
            )}
          </dl>

          {seriesMates.length > 0 && (
            <section className={styles.section} aria-labelledby="series-heading">
              <h2 id="series-heading" className={styles.sectionHead}>
                More from {item.category === "book" && item.series?.name}
              </h2>
              <ul className={styles.related}>
                {seriesMates.map((o) => (
                  <li key={o.id}>
                    <MediaCard item={o} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className={styles.more} aria-labelledby="related-heading">
          <h2 id="related-heading" className={styles.sectionHead}>
            If you like this
          </h2>
          <ul className={styles.related}>
            {related.map((o) => (
              <li key={o.id}>
                <MediaCard item={o} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
