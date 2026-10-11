"use client";

import { Tabs } from "radix-ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { MediaCard } from "@/components/media/MediaCard";
import { allGenres } from "@/lib/media/filters";
import { useMedia } from "@/lib/media/store";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/media/types";
import styles from "./GenreExplorer.module.css";

export function GenreExplorer() {
  const { items, ready } = useMedia();
  const router = useRouter();
  const params = useSearchParams();
  const genres = useMemo(() => allGenres(items), [items]);

  if (!ready) {
    return (
      <div className={`shell ${styles.page}`} aria-busy="true">
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (genres.length === 0) {
    return (
      <div className={`shell ${styles.page}`}>
        <h1 className={styles.empty}>No genres yet</h1>
        <p className={styles.emptyText}>
          Genres appear as you tag titles. <Link href="/">Back to the library</Link>
        </p>
      </div>
    );
  }

  const requested = params.get("genre");
  const selected = genres.find((g) => g.name === requested) ?? genres[0];
  const max = genres[0].count;
  const inGenre = items
    .filter((i) => i.genres.includes(selected.name))
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title));
  const rated = inGenre.filter((i) => i.rating !== null);
  const average = rated.length ? rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length : null;
  const completed = inGenre.filter((i) => i.status === "completed").length;
  const noun = (label: string) => (label.startsWith("TV") ? label : label.toLowerCase());
  const split = CATEGORIES.map((c) => ({ c, n: inGenre.filter((i) => i.category === c).length })).filter((x) => x.n > 0);

  return (
    <div className={`shell ${styles.page}`}>
      <Tabs.Root
        className={styles.layout}
        orientation="vertical"
        value={selected.name}
        onValueChange={(value) => router.replace(`/genres?genre=${encodeURIComponent(value)}`, { scroll: false })}
      >
        <nav className={styles.index} aria-label="Genres">
          <h1 className={styles.heading}>Genres</h1>
          <Tabs.List className={styles.list} aria-label="Browse by genre">
            {genres.map((g) => (
              <Tabs.Trigger key={g.name} value={g.name} className={styles.trigger}>
                <span className={styles.name}>{g.name}</span>
                <span className={styles.count}>{g.count}</span>
                <span className={styles.bar} style={{ width: `${(g.count / max) * 100}%` }} aria-hidden="true" />
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </nav>

        <Tabs.Content value={selected.name} className={styles.content} tabIndex={-1}>
          <header className={styles.head}>
            <h2 className={styles.title}>{selected.name}</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Titles</dt>
                <dd>{inGenre.length}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{completed}</dd>
              </div>
              <div>
                <dt>Average rating</dt>
                <dd>{average === null ? "–" : average.toFixed(1)}</dd>
              </div>
              <div>
                <dt>Mix</dt>
                <dd className={styles.mix}>
                  {split.map(({ c, n }) => `${n} ${n === 1 ? noun(CATEGORY_LABEL[c].singular) : noun(CATEGORY_LABEL[c].plural)}`).join(", ")}
                </dd>
              </div>
            </dl>
          </header>

          <ul className={styles.grid}>
            {inGenre.map((item) => (
              <li key={item.id}>
                <MediaCard item={item} />
              </li>
            ))}
          </ul>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
