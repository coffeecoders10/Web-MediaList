"use client";

import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { CategoryTag, ProgressLeader, Rating, StatusMark } from "@/components/media/Marks";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/Workspace";
import type { MediaItem } from "@/lib/media/types";
import styles from "./MediaTable.module.css";

export function MediaTable({ items }: { items: MediaItem[] }) {
  const { editMode, openEditor, requestDelete } = useWorkspace();

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">Your collection</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col" className={styles.hideSm}>
              Type
            </th>
            <th scope="col" className={styles.hideMd}>
              Genres
            </th>
            <th scope="col">Status</th>
            <th scope="col" className={styles.hideMd}>
              Progress
            </th>
            <th scope="col" className={styles.num}>
              Rating
            </th>
            {editMode && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={styles.row}>
              <td className={styles.titleCell}>
                <div className={styles.thumb}>
                  <Cover item={item} compact />
                </div>
                <div className={styles.titleText}>
                  <Link href={`/media/${item.id}`} className={styles.link}>
                    {item.title}
                  </Link>
                  <span className={styles.sub}>{[item.creator, item.year].filter(Boolean).join(" · ")}</span>
                </div>
              </td>
              <td className={styles.hideSm}>
                <CategoryTag category={item.category} />
              </td>
              <td className={`${styles.genres} ${styles.hideMd}`}>{item.genres.slice(0, 3).join(", ")}</td>
              <td>
                <StatusMark status={item.status} />
              </td>
              <td className={styles.hideMd}>
                <div className={styles.progress}>
                  <ProgressLeader item={item} />
                </div>
              </td>
              <td className={styles.num}>
                <Rating value={item.rating} />
              </td>
              {editMode && (
                <td className={styles.actions}>
                  <Button variant="quiet" size="sm" icon aria-label={`Edit ${item.title}`} onClick={() => openEditor({ mode: "edit", id: item.id })}>
                    <Pencil1Icon />
                  </Button>
                  <Button variant="quiet" size="sm" icon aria-label={`Delete ${item.title}`} onClick={() => requestDelete(item)}>
                    <TrashIcon />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
