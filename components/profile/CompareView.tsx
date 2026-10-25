"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Cover } from "@/components/Cover";
import { Rating } from "@/components/media/Marks";
import { MediaCard } from "@/components/media/MediaCard";
import { Button } from "@/components/ui/Button";
import { compareLibraries, type Measure } from "@/lib/media/compare";
import { formatNumber } from "@/lib/media/format";
import { useMedia } from "@/lib/media/store";
import type { MediaItem } from "@/lib/media/types";
import { Avatar } from "./Avatar";
import { displayName, useLinks, useProfile } from "./ProfileProviders";
import library from "@/components/library/LibraryView.module.css";
import styles from "./CompareView.module.css";

const SHOWN = 12;

function show(value: number, format: Measure["format"]) {
  if (format === "percent") return `${value}%`;
  if (format === "rating") return value ? value.toFixed(1) : "–";
  return formatNumber(value);
}

/**
 * Paired bars grow outward from the label, yours on the left and theirs on the right. Bars are scaled
 * per row, or across the whole group when the rows share a unit (`shared`).
 */
function Rows({ measures, name, shared }: { measures: Measure[]; name: string; shared?: boolean }) {
  const groupMax = Math.max(1, ...measures.flatMap((m) => [m.you, m.them]));
  return (
    <ul className={styles.rows}>
      {measures.map((m) => {
        const max = shared ? groupMax : Math.max(1, m.you, m.them);
        return (
          <li key={m.key} className={styles.row}>
            <span className={styles.label}>{m.label}</span>
            <span className={styles.you} data-lead={m.you >= m.them && m.you > 0 ? "" : undefined}>
              <span className={styles.value}>
                <span className="sr-only">You: </span>
                {show(m.you, m.format)}
                {m.youOf !== undefined && <span className={styles.of}> / {m.youOf}</span>}
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.barYou} style={{ width: `${(m.you / max) * 100}%` }} />
              </span>
            </span>
            <span className={styles.them} data-lead={m.them >= m.you && m.them > 0 ? "" : undefined}>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.barThem} style={{ width: `${(m.them / max) * 100}%` }} />
              </span>
              <span className={styles.value}>
                <span className="sr-only">{name}: </span>
                {show(m.them, m.format)}
                {m.themOf !== undefined && <span className={styles.of}> / {m.themOf}</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

type SharedRow = ReturnType<typeof compareLibraries>["shared"][number];
const gapOf = (s: SharedRow) => (s.yourRating !== null && s.theirRating !== null ? Math.abs(s.yourRating - s.theirRating) : -1);

/** Your collection (`mine`, from the server) beside the profile's (from the read-only store). */
export function CompareView({ mine }: { mine: MediaItem[] }) {
  const { items: theirs } = useMedia();
  const profile = useProfile();
  const links = useLinks();
  const [showAllShared, setShowAllShared] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const cmp = useMemo(() => compareLibraries(mine, theirs, new Date()), [mine, theirs]);

  if (!profile?.viewer) return null;
  const { owner, viewer } = profile;
  const name = owner.fullName ? owner.fullName.split(/\s+/)[0] : `@${owner.username}`;

  // Titles you rated furthest apart come first, since those are the interesting ones.
  const sharedSorted = [...cmp.shared].sort((a, b) => gapOf(b) - gapOf(a) || a.item.title.localeCompare(b.item.title));
  const sharedShown = showAllShared ? sharedSorted : sharedSorted.slice(0, SHOWN);

  // Titles you add stay on screen, marked as yours, so a click visibly lands somewhere.
  const missing = [...cmp.onlyThem].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const missingShown = showAllMissing ? missing : missing.slice(0, SHOWN);
  const toAdd = missing.filter((i) => !profile.owned.has(i.id));

  const addAll = async (status: "planned" | "completed") => {
    setAdding(true);
    await profile.addToList(toAdd.map((i) => i.id), status);
    setAdding(false);
    setConfirming(false);
  };

  return (
    <div className={`shell ${styles.page}`}>
      <h1 className={styles.heading}>Compare</h1>

      <p className={styles.lead}>
        {cmp.shared.length === 0 ? (
          <>You and {name} don&apos;t have any titles in common yet.</>
        ) : (
          <>
            You and {name} share <strong>{cmp.shared.length}</strong> {cmp.shared.length === 1 ? "title" : "titles"}
            {cmp.ratingGap !== null && (
              <>
                , and rated <strong>{cmp.agreed}</strong> of {cmp.bothRated} of them within a point of each other
              </>
            )}
            .
          </>
        )}
      </p>

      <div className={styles.cast} aria-hidden="true">
        <span className={styles.castYou}>
          <Avatar person={viewer} size="sm" /> You
        </span>
        <span className={styles.castThem}>
          {displayName(owner)} <Avatar person={owner} size="sm" />
        </span>
      </div>

      <Section title="By the numbers">
        <Rows measures={cmp.measures} name={name} />
      </Section>

      <Section title="Finished, by type" note="Completed titles, out of everything each of you has in that type.">
        <Rows measures={cmp.byType} name={name} shared />
      </Section>

      <Section
        title="In common"
        note={`${cmp.shared.length} shared · ${cmp.onlyYouCount} only yours · ${theirs.length - cmp.shared.length} only ${name}'s`}
      >
        {cmp.shared.length === 0 ? (
          <p className={styles.muted}>Once you both have a title, it shows up here with each of your ratings.</p>
        ) : (
          <>
            <table className={styles.shared}>
              <caption className="sr-only">Titles you both have, with each rating</caption>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col" className={styles.num}>
                    You
                  </th>
                  <th scope="col" className={styles.num}>
                    {name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sharedShown.map(({ item, yourRating, theirRating }) => (
                  <tr key={item.id}>
                    <td className={styles.titleCell}>
                      <span className={styles.thumb}>
                        <Cover item={item} compact />
                      </span>
                      <Link href={links.media(item.id)} className={styles.titleLink}>
                        {item.title}
                      </Link>
                    </td>
                    <td className={styles.num}>
                      <Rating value={yourRating} />
                    </td>
                    <td className={styles.num}>
                      <Rating value={theirRating} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cmp.shared.length > SHOWN && (
              <Button variant="quiet" size="sm" className={styles.more} onClick={() => setShowAllShared((v) => !v)}>
                {showAllShared ? "Show fewer" : `Show all ${cmp.shared.length}`}
              </Button>
            )}
          </>
        )}

        {cmp.sharedGenres.length > 0 && (
          <div className={styles.genres}>
            <h3>Genres you both lean toward</h3>
            <ul>
              {cmp.sharedGenres.map((g) => (
                <li key={g.name}>
                  <strong>{g.name}</strong>
                  <span>
                    <span className="sr-only">You </span>
                    {g.you}
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, {name} </span>
                    {g.them}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={`On ${name}'s shelf, not yours`} note={missing.length ? "Their highest-rated first." : undefined}>
        {missing.length === 0 ? (
          <p className={styles.muted}>You already have everything {name} has.</p>
        ) : (
          <>
            <div className={styles.addAll}>
              {toAdd.length === 0 ? (
                <p>All {missing.length} are in your list now.</p>
              ) : confirming ? (
                <>
                  <p>
                    Add {toAdd.length} {toAdd.length === 1 ? "title" : "titles"} to your list?
                  </p>
                  <Button variant="solid" size="sm" disabled={adding} onClick={() => void addAll("planned")}>
                    {adding ? "Adding…" : "Add as planned"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={adding} onClick={() => void addAll("completed")}>
                    Add as completed
                  </Button>
                  <Button variant="quiet" size="sm" disabled={adding} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                  Add all {toAdd.length} to my list
                </Button>
              )}
            </div>
            <ul className={library.grid}>
              {missingShown.map((item) => (
                <li key={item.id}>
                  <MediaCard item={item} />
                </li>
              ))}
            </ul>
            {missing.length > SHOWN && (
              <Button variant="quiet" size="sm" className={styles.more} onClick={() => setShowAllMissing((v) => !v)}>
                {showAllMissing ? "Show fewer" : `Show all ${missing.length}`}
              </Button>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
