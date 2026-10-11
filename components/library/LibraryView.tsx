"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { MediaCard } from "@/components/media/MediaCard";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/Workspace";
import {
  activeFilterCount,
  allGenres,
  applyFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  type LibraryFilters,
} from "@/lib/media/filters";
import { useMedia } from "@/lib/media/store";
import { CATEGORIES, type Category } from "@/lib/media/types";
import { FilterBar } from "./FilterBar";
import { MediaTable } from "./MediaTable";
import { NowShowing } from "./NowShowing";
import styles from "./LibraryView.module.css";

export function LibraryView() {
  const { items } = useMedia();
  const { editMode, openEditor } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  // The URL is the source of truth, so filtered views can be linked to and survive a reload.
  const update = useCallback(
    (patch: Partial<LibraryFilters>) => {
      const next = filtersToParams({ ...filtersFromParams(new URLSearchParams(window.location.search)), ...patch });
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const results = useMemo(() => applyFilters(items, filters), [items, filters]);
  const genres = useMemo(() => allGenres(items), [items]);
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    for (const item of items) counts[item.category]++;
    return counts;
  }, [items]);
  const inProgress = useMemo(
    () => items.filter((i) => i.status === "in-progress").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );

  const activeCount = activeFilterCount(filters);
  const showNowShowing = activeCount === 0;

  return (
    <div className={`shell ${styles.page}`}>
      {showNowShowing && <NowShowing items={inProgress} onShowPlanned={() => update({ statuses: ["planned"] })} />}

      <section className={styles.browse} aria-labelledby="library-heading">
        <h1 id="library-heading" className="sr-only">
          Library
        </h1>
        {editMode && (
          <div className={styles.addRow}>
            <Button variant="solid" size="sm" onClick={() => openEditor({ mode: "new" })}>
              <PlusIcon aria-hidden="true" />
              Add title
            </Button>
          </div>
        )}
        <FilterBar filters={filters} onChange={update} categoryCounts={categoryCounts} total={items.length} genres={genres} />

        <div className={styles.summary} aria-live="polite">
          <p>
            {`${results.length} ${results.length === 1 ? "title" : "titles"}`}
            {activeCount > 0 && items.length !== results.length && <span className={styles.of}> of {items.length}</span>}
          </p>
          {activeCount > 0 && (
            <Button variant="quiet" size="sm" onClick={() => update({ ...DEFAULT_FILTERS, view: filters.view, sort: filters.sort })}>
              Clear filters
            </Button>
          )}
        </div>

        {results.length === 0 ? (
          <div className={styles.empty}>
            {items.length === 0 ? (
              <>
                <h2>Your collection is empty</h2>
                <p>{editMode ? "Add the first book, movie, series or anime you want to keep track of." : "Turn on Edit in the top bar to add your first title."}</p>
                <div className={styles.emptyActions}>
                  {editMode && (
                    <Button variant="solid" onClick={() => openEditor({ mode: "new" })}>
                      Add a title
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2>Nothing matches those filters</h2>
                <p>Try removing a genre or status, or search for something broader.</p>
                <Button variant="outline" onClick={() => update({ ...DEFAULT_FILTERS, view: filters.view })}>
                  Clear filters
                </Button>
              </>
            )}
          </div>
        ) : filters.view === "list" ? (
          <MediaTable items={results} />
        ) : (
          <ul className={styles.grid}>
            {results.map((item) => (
              <li key={item.id}>
                <MediaCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
