"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { CategoryTag, ProgressLeader, SeriesLine } from "@/components/media/Marks";
import { useLinks, useProfile } from "@/components/profile/ProfileProviders";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/Workspace";
import { quickStep } from "@/lib/media/progress";
import { useMedia } from "@/lib/media/store";
import type { MediaItem } from "@/lib/media/types";
import styles from "./NowShowing.module.css";

/** The one lit surface in the app: what you are in the middle of, backlit like transparencies on a light table. */
export function NowShowing({ items, onShowPlanned }: { items: MediaItem[]; onShowPlanned: () => void }) {
  const { save } = useMedia();
  const { editMode } = useWorkspace();
  const links = useLinks();
  const profile = useProfile();
  const shown = items.slice(0, 4);

  return (
    <section className={styles.panel} aria-labelledby="now-showing">
      <div className={styles.head}>
        <h2 id="now-showing" className={styles.heading}>
          Now consuming
        </h2>
        <p className={styles.count}>
          {items.length === 0 ? "Nothing in progress" : `${items.length} in progress${items.length > shown.length ? ", latest four shown" : ""}`}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className={styles.empty}>
          <p>{profile ? "The table is clear right now." : "The table is clear. Pick something up from your planned list."}</p>
          <Button variant={profile ? "outline" : "solid"} size="sm" onClick={onShowPlanned}>
            Show planned titles
          </Button>
        </div>
      ) : (
        <ul className={styles.list}>
          {shown.map((item) => {
            const step = editMode ? quickStep(item) : null;
            return (
              <li key={item.id} className={styles.entry}>
                <div className={styles.cover}>
                  <Cover item={item} />
                </div>
                <div className={styles.text}>
                  <CategoryTag category={item.category} />
                  <h3 className={styles.title}>
                    <Link href={links.media(item.id)} className={styles.link}>
                      {item.title}
                    </Link>
                  </h3>
                  <SeriesLine item={item} className={styles.position} />
                  <ProgressLeader item={item} />
                  {step && (
                    <Button variant="solid" size="sm" className={styles.step} onClick={() => save(step.apply())}>
                      <PlusIcon aria-hidden="true" />
                      {step.label.replace("+", "")}
                      <span className="sr-only"> for {item.title}</span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
