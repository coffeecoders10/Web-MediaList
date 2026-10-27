"use client";

import { ChevronLeftIcon, ChevronRightIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon, PlusIcon, StackIcon } from "@radix-ui/react-icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { MediaCard } from "@/components/media/MediaCard";
import { displayName, useProfile } from "@/components/profile/ProfileProviders";
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

const MOBILE_QUERY = "(max-width: 719px)";
const PAGE_SIZE = { desktop: 24, mobile: 8 };

const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const readMobile = () => window.matchMedia(MOBILE_QUERY).matches;

/** Window of page numbers around the current page (`radius` each side), always including first and last. */
function pageWindow(page: number, count: number, radius: number): (number | "gap")[] {
  const pages = new Set([1, count]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= count) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function LibraryView() {
  const { items } = useMedia();
  const { editMode, openEditor, openBulkAdd } = useWorkspace();
  const profile = useProfile();
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

  const isMobile = useSyncExternalStore(subscribeMobile, readMobile, () => false);
  const pageSize = isMobile ? PAGE_SIZE.mobile : PAGE_SIZE.desktop;

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

  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? Math.min(requestedPage, pageCount) : 1;
  const pageItems = useMemo(() => results.slice((page - 1) * pageSize, page * pageSize), [results, page, pageSize]);

  const goToPage = (next: number) => {
    const params = filtersToParams(filters);
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    document.getElementById("library-heading")?.scrollIntoView({ block: "start" });
  };

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
            <Button variant="outline" size="sm" onClick={openBulkAdd}>
              <StackIcon aria-hidden="true" />
              Bulk add
            </Button>
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
                <h2>{profile ? `${displayName(profile.owner)} hasn’t added anything yet` : "Your collection is empty"}</h2>
                <p>
                  {profile
                    ? "Their collection is empty for now. Check back later."
                    : editMode
                      ? "Add the first book, movie, series or anime you want to keep track of."
                      : "Turn on Edit in the top bar to add your first title."}
                </p>
                <div className={styles.emptyActions}>
                  {editMode && (
                    <>
                      <Button variant="solid" onClick={() => openEditor({ mode: "new" })}>
                        Add a title
                      </Button>
                      <Button variant="outline" onClick={openBulkAdd}>
                        Bulk add from the catalog
                      </Button>
                    </>
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
          <MediaTable items={pageItems} />
        ) : (
          <ul className={styles.grid}>
            {pageItems.map((item) => (
              <li key={item.id}>
                <MediaCard item={item} />
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 && (
          <nav className={styles.pager} aria-label="Pagination">
            <button type="button" className={`${styles.pageBtn} ${styles.pageEdge}`} aria-label="First page" disabled={page <= 1} onClick={() => goToPage(1)}>
              <DoubleArrowLeftIcon />
            </button>
            <button type="button" className={styles.pageBtn} aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              <ChevronLeftIcon />
            </button>
            {pageWindow(page, pageCount, isMobile ? 1 : 2).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className={styles.pageGap} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={styles.pageBtn}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button type="button" className={styles.pageBtn} aria-label="Next page" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
              <ChevronRightIcon />
            </button>
            <button type="button" className={`${styles.pageBtn} ${styles.pageEdge}`} aria-label="Last page" disabled={page >= pageCount} onClick={() => goToPage(pageCount)}>
              <DoubleArrowRightIcon />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
