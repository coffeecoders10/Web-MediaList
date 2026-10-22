"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Cover } from "@/components/Cover";
import { Rating, StatusMark } from "@/components/media/Marks";
import { displayName, useLinks, useProfile } from "@/components/profile/ProfileProviders";
import { formatDate, formatNumber } from "@/lib/media/format";
import { computeStats } from "@/lib/media/stats";
import { useMedia } from "@/lib/media/store";
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, STATUSES } from "@/lib/media/types";
import styles from "./StatsView.module.css";

function Panel({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(" ")}>
      <header className={styles.panelHead}>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

export function StatsView() {
  const { items } = useMedia();
  const links = useLinks();
  const profile = useProfile();
  const subject = profile ? displayName(profile.owner) : null;
  const stats = useMemo(() => computeStats(items, new Date()), [items]);

  if (stats.total === 0) {
    return (
      <div className={`shell ${styles.page}`}>
        <h1 className={styles.heading}>Stats</h1>
        <p className={styles.lead}>
          {subject ? (
            <>{subject} hasn&apos;t added any titles yet, so there&apos;s nothing to count.</>
          ) : (
            <>
              Nothing to count yet. <Link href="/">Add a few titles</Link> and they&apos;ll show up here.
            </>
          )}
        </p>
      </div>
    );
  }

  const done = stats.byStatus.completed;
  const maxCategory = Math.max(...CATEGORIES.map((c) => stats.byCategory[c]));
  const maxGenre = Math.max(1, ...stats.topGenres.map((g) => g.count));
  const maxBin = Math.max(1, ...stats.ratingBins.map((b) => b.count));
  const maxMonth = Math.max(1, ...stats.months.map((m) => m.total));
  const finishedLastYear = stats.months.reduce((n, m) => n + m.total, 0);
  const hours = Math.round(stats.movieMinutes / 60);

  return (
    <div className={`shell ${styles.page}`}>
      <h1 className={styles.heading}>Stats</h1>

      <p className={styles.lead}>
        {subject ? `${subject} has` : "You've"} finished <strong>{done}</strong> of {stats.total} titles
        {stats.byStatus["in-progress"] > 0 && (
          <>
            , with <strong>{stats.byStatus["in-progress"]}</strong> in progress
          </>
        )}
        {stats.byStatus.planned > 0 && <> and {stats.byStatus.planned} still waiting</>}.
      </p>

      <div className={styles.statusBar}>
        <ul className={styles.segments} role="img" aria-label={STATUSES.map((s) => `${stats.byStatus[s]} ${STATUS_LABEL[s].toLowerCase()}`).join(", ")}>
          {STATUSES.filter((s) => stats.byStatus[s] > 0).map((s) => (
            <li key={s} className={styles.segment} data-status={s} style={{ flexGrow: stats.byStatus[s] }} />
          ))}
        </ul>
        <ul className={styles.legend}>
          {STATUSES.map((s) => (
            <li key={s}>
              <StatusMark status={s} />
              <span className={styles.legendCount}>{stats.byStatus[s]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.grid}>
        <Panel title={subject ? "What they've taken in" : "What you've taken in"} className={styles.wide}>
          <dl className={styles.totals}>
            <div>
              <dt>Chapters read</dt>
              <dd>{formatNumber(stats.chaptersRead)}</dd>
            </div>
            <div>
              <dt>Hours of film</dt>
              <dd>{formatNumber(hours)}</dd>
            </div>
            <div>
              <dt>Seasons watched</dt>
              <dd>{formatNumber(stats.seasonsWatched)}</dd>
            </div>
            <div>
              <dt>Completion rate</dt>
              <dd>{Math.round((done / stats.total) * 100)}%</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="By type">
          <ul className={styles.rows}>
            {CATEGORIES.map((c) => (
              <li key={c} className={`${styles.row} ${styles.rowWide}`}>
                <span className={styles.rowLabel}>{CATEGORY_LABEL[c].plural}</span>
                <span className={styles.rowTrack} aria-hidden="true">
                  <span className={styles.rowTotal} style={{ width: `${(stats.byCategory[c] / maxCategory) * 100}%` }}>
                    <span className={styles.rowDone} style={{ width: `${stats.byCategory[c] ? (stats.completedByCategory[c] / stats.byCategory[c]) * 100 : 0}%` }} />
                  </span>
                </span>
                <span className={styles.rowValue}>
                  {stats.completedByCategory[c]}
                  <span className={styles.muted}> / {stats.byCategory[c]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={subject ? "How they rate" : "How you rate"}
          note={stats.rated ? `${stats.rated} of ${stats.total} titles rated` : subject ? "No ratings yet." : "Rate a few titles to see the shape of your taste."}
        >
          <ol className={styles.columns} aria-label="Number of titles at each rating">
            {stats.ratingBins.map((b) => (
              <li key={b.value} className={styles.column}>
                <span className={styles.columnCount}>{b.count || ""}</span>
                <span className={styles.columnBar} style={{ height: `${(b.count / maxBin) * 100}%` }} data-empty={b.count === 0 || undefined} />
                <span className={styles.columnLabel}>
                  {b.value === 4.5 ? "≤4.5" : b.value}
                  <span className="sr-only">: {b.count} titles</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Top genres" className={styles.wide}>
          <ul className={`${styles.rows} ${styles.twoCol}`}>
            {stats.topGenres.map((g) => (
              <li key={g.name} className={styles.row}>
                <Link href={links.genre(g.name)} className={styles.rowLabel}>
                  {g.name}
                </Link>
                <span className={styles.rowTrack} aria-hidden="true">
                  <span className={styles.rowTotal} style={{ width: `${(g.count / maxGenre) * 100}%` }}>
                    <span className={styles.rowDone} style={{ width: "100%" }} />
                  </span>
                </span>
                <span className={styles.rowValue}>{g.count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Finished, month by month"
          note={`${finishedLastYear} in the last 12 months`}
          className={styles.wide}
        >
          <ol className={styles.columns} aria-label="Titles finished each month">
            {stats.months.map((m, i) => (
              <li key={m.key} className={styles.column}>
                <span className={styles.columnCount}>{m.total || ""}</span>
                <span className={styles.columnBar} style={{ height: `${(m.total / maxMonth) * 100}%` }} data-empty={m.total === 0 || undefined} />
                <span className={styles.columnLabel}>
                  {m.label}
                  {(i === 0 || m.key.endsWith("-01")) && <span className={styles.year}>{m.key.slice(2, 4)}</span>}
                  <span className="sr-only">
                    {" "}
                    {m.key.slice(0, 4)}: {m.total} finished
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Recently finished" className={styles.wide}>
          {stats.recentlyFinished.length === 0 ? (
            <p className={styles.muted}>Nothing finished yet.</p>
          ) : (
            <ul className={styles.recent}>
              {stats.recentlyFinished.map((item) => (
                <li key={item.id} className={styles.recentItem}>
                  <div className={styles.thumb}>
                    <Cover item={item} compact />
                  </div>
                  <div className={styles.recentText}>
                    <Link href={links.media(item.id)} className={styles.recentLink}>
                      {item.title}
                    </Link>
                    <span className={styles.muted}>{item.finishedAt && formatDate(item.finishedAt)}</span>
                  </div>
                  <Rating value={item.rating} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
