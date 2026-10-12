"use client";

import { CheckIcon, Cross2Icon, InfoCircledIcon, MagnifyingGlassIcon, MinusIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Checkbox, Dialog, Popover, ToggleGroup } from "radix-ui";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/Icons";
import { useWorkspace } from "@/components/workspace/Workspace";
import type { BrowseEntry, CatalogBrowseResult } from "@/lib/media/api";
import { useMedia } from "@/lib/media/store";
import { CATEGORIES, CATEGORY_LABEL, isCategory, type Category } from "@/lib/media/types";
import styles from "./BulkAddDialog.module.css";

/** Rows drawn at once; the filters narrow a large catalog down, and "Show more" reveals the rest. */
const PAGE = 100;

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export function BulkAddDialog() {
  const { bulkAddOpen, closeBulkAdd } = useWorkspace();
  return (
    <Dialog.Root open={bulkAddOpen} onOpenChange={(open) => !open && closeBulkAdd()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <BulkAddPicker />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; entries: BrowseEntry[] };

/** Mounted only while the dialog is open, so every opening starts fresh and re-reads the catalog. */
function BulkAddPicker() {
  const { items, addCompleted } = useMedia();
  const { closeBulkAdd, notify } = useWorkspace();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(PAGE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useDeferredValue(q);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/catalog/browse", { signal: controller.signal });
        if (!res.ok) throw new Error(`Browse failed (${res.status})`);
        const data = (await res.json()) as CatalogBrowseResult;
        setLoad({ state: "ready", entries: data.entries });
      } catch {
        if (!controller.signal.aborted) setLoad({ state: "error" });
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  const ownedKeys = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  // What can be added at all: catalog titles the user doesn't have yet.
  const available = useMemo(
    () => (load.state === "ready" ? load.entries.filter((e) => !ownedKeys.has(e.key)) : []),
    [load, ownedKeys],
  );
  const hidden = load.state === "ready" ? load.entries.length - available.length : 0;

  const counts = useMemo(() => {
    const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    for (const e of available) out[e.category]++;
    return out;
  }, [available]);

  const genreOptions = useMemo(() => {
    const tally = new Map<string, number>();
    for (const e of available) if (!category || e.category === category) for (const g of e.genres) tally.set(g, (tally.get(g) ?? 0) + 1);
    return [...tally].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [available, category]);

  const results = useMemo(() => {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    return available
      .filter((e) => {
        if (category && e.category !== category) return false;
        if (genres.length && !genres.every((g) => e.genres.includes(g))) return false;
        if (!terms.length) return true;
        const haystack = fold(`${e.title} ${e.creator} ${e.genres.join(" ")}`);
        return terms.every((t) => haystack.includes(t));
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [available, query, category, genres]);

  const filtered = query.trim() !== "" || category !== null || genres.length > 0;
  const shown = results.slice(0, limit);
  const pickedInView = results.reduce((n, e) => n + (picked.has(e.key) ? 1 : 0), 0);
  const allInView: boolean | "indeterminate" = results.length > 0 && pickedInView === results.length ? true : pickedInView > 0 ? "indeterminate" : false;

  const toggle = (key: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleAll = (on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const e of results) {
        if (on) next.add(e.key);
        else next.delete(e.key);
      }
      return next;
    });

  const reset = () => {
    setQ("");
    setCategory(null);
    setGenres([]);
    setLimit(PAGE);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await addCompleted([...picked]);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    closeBulkAdd();
    const n = result.items.length;
    notify(
      n === 0
        ? "Those titles are already in your collection"
        : `Added ${n} ${n === 1 ? "title" : "titles"} as completed. Update their status, progress and ratings when you can.`,
    );
  };

  const count = picked.size;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Dialog.Title className={styles.title}>Bulk add from the catalog</Dialog.Title>
          <Dialog.Description className={styles.lede}>Tick the titles you’ve already finished.</Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button variant="quiet" size="sm" icon aria-label="Close">
            <Cross2Icon />
          </Button>
        </Dialog.Close>
      </header>

      <div className={styles.notice} role="note">
        <InfoCircledIcon className={styles.noticeIcon} aria-hidden="true" />
        <p>
          <strong>These go in as Completed, with progress filled to 100%</strong>.{" "}
          <span>You’ll need to update your status, progress and ratings afterwards.</span>
        </p>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchRow}>
          <div className={styles.search}>
            <MagnifyingGlassIcon className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search title, creator or genre"
              aria-label="Search the catalog"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
            />
          </div>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="outline" className={styles.genreTrigger}>
                <MixerHorizontalIcon aria-hidden="true" />
                Genre
                {genres.length > 0 && <span className={styles.badge}>{genres.length}</span>}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.popover} align="end" sideOffset={8} collisionPadding={12}>
                <p className={styles.popoverHint}>Titles must match every genre you pick.</p>
                {genreOptions.length === 0 ? (
                  <p className={styles.popoverHint}>No genres to filter by.</p>
                ) : (
                  <ul className={styles.genreList}>
                    {genreOptions.map((g) => (
                      <li key={g.name}>
                        <label className={styles.genreOption}>
                          <Checkbox.Root
                            className={styles.checkbox}
                            checked={genres.includes(g.name)}
                            onCheckedChange={(on) => {
                              setGenres(on === true ? [...genres, g.name] : genres.filter((x) => x !== g.name));
                              setLimit(PAGE);
                            }}
                          >
                            <Checkbox.Indicator>
                              <CheckIcon />
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          <span>{g.name}</span>
                          <span className={styles.count}>{g.count}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {genres.length > 0 && (
                  <Button variant="quiet" size="sm" onClick={() => setGenres([])}>
                    Clear genres
                  </Button>
                )}
                <Popover.Arrow className={styles.arrow} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        <ToggleGroup.Root
          type="single"
          className={styles.categories}
          value={category ?? "all"}
          onValueChange={(v) => {
            if (!v) return;
            setCategory(isCategory(v) ? v : null);
            setGenres([]);
            setLimit(PAGE);
          }}
          aria-label="Category"
        >
          <ToggleGroup.Item value="all" className={styles.category}>
            All <span className={styles.count}>{available.length}</span>
          </ToggleGroup.Item>
          {CATEGORIES.map((c) => (
            <ToggleGroup.Item key={c} value={c} className={styles.category}>
              <CategoryIcon category={c} size={15} />
              {CATEGORY_LABEL[c].plural}
              <span className={styles.count}>{counts[c]}</span>
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>

      <div className={styles.listHead}>
        <label className={styles.selectAll}>
          <Checkbox.Root
            className={styles.checkbox}
            checked={allInView}
            disabled={results.length === 0}
            onCheckedChange={(on) => toggleAll(on === true)}
          >
            <Checkbox.Indicator>{allInView === "indeterminate" ? <MinusIcon /> : <CheckIcon />}</Checkbox.Indicator>
          </Checkbox.Root>
          <span>{filtered ? `Select all ${results.length} matching` : `Select all ${results.length}`}</span>
        </label>
        <p className={styles.tally} aria-live="polite">
          {load.state === "ready" && (
            <>
              {results.length} {results.length === 1 ? "title" : "titles"}
              {hidden > 0 && <span className={styles.muted}> · {hidden} already yours hidden</span>}
            </>
          )}
        </p>
      </div>

      <div className={styles.scroll}>
        {load.state === "loading" && (
          <ul className={styles.skeleton} aria-label="Loading the catalog" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} />
            ))}
          </ul>
        )}

        {load.state === "error" && (
          <div className={styles.empty}>
            <h2>Couldn’t load the catalog</h2>
            <p>Check your connection and try again.</p>
            <Button
              variant="outline"
              onClick={() => {
                setLoad({ state: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {load.state === "ready" && results.length === 0 && (
          <div className={styles.empty}>
            {available.length === 0 ? (
              <>
                <h2>Nothing left to add</h2>
                <p>Everything in the shared catalog is already in your collection.</p>
              </>
            ) : (
              <>
                <h2>No titles match</h2>
                <p>Try a broader search or remove a genre.</p>
                <Button variant="outline" onClick={reset}>
                  Clear filters
                </Button>
              </>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <ul className={styles.list}>
            {shown.map((e) => (
              <li key={e.key}>
                <label className={styles.row} data-checked={picked.has(e.key) || undefined}>
                  <Checkbox.Root className={styles.checkbox} checked={picked.has(e.key)} onCheckedChange={(on) => toggle(e.key, on === true)}>
                    <Checkbox.Indicator>
                      <CheckIcon />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{e.title}</span>
                    <span className={styles.rowMeta}>{[e.creator, e.year].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={styles.tag} title={CATEGORY_LABEL[e.category].singular}>
                    <CategoryIcon category={e.category} size={14} />
                    <span className={styles.tagLabel}>{CATEGORY_LABEL[e.category].singular}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {results.length > shown.length && (
          <div className={styles.more}>
            <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
              Show {Math.min(PAGE, results.length - shown.length)} more
            </Button>
          </div>
        )}
      </div>

      <footer className={styles.foot}>
        {error ? (
          <p className={styles.footError} role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.selected} aria-live="polite">
            <strong>{count}</strong> selected
            {count > 0 && (
              <button type="button" className={styles.clearPicks} onClick={() => setPicked(new Set())}>
                Clear
              </button>
            )}
          </p>
        )}
        <Dialog.Close asChild>
          <Button variant="outline" disabled={saving}>
            Cancel
          </Button>
        </Dialog.Close>
        <Button variant="solid" disabled={count === 0 || saving} onClick={() => void submit()}>
          {saving ? "Adding…" : count > 0 ? `Add ${count} as completed` : "Add as completed"}
        </Button>
      </footer>
    </>
  );
}
