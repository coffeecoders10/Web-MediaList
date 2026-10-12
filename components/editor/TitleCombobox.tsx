"use client";

import { CheckIcon } from "@radix-ui/react-icons";
import { Popover } from "radix-ui";
import { useEffect, useId, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Cover } from "@/components/Cover";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import type { CatalogSearchResult } from "@/lib/media/api";
import { bylineOf } from "@/lib/media/format";
import { MIN_QUERY } from "@/lib/media/search";
import { seriesOf, type Category, type MediaItem } from "@/lib/media/types";
import styles from "./TitleCombobox.module.css";

const DEBOUNCE_MS = 150;

interface TitleComboboxProps {
  id: string;
  value: string;
  category: Category;
  /** True once the form has been filled from a catalog title. */
  linked: boolean;
  /** Titles the user already has, which can't be added twice. */
  owned: (item: MediaItem) => boolean;
  onChange: (title: string) => void;
  onPick: (item: MediaItem) => void;
  onUnlink: () => void;
  invalid?: boolean;
  describedBy?: string;
}

interface Results {
  category: Category;
  query: string;
  items: MediaItem[];
}

/**
 * Title input with suggestions from the shared catalog (WAI-ARIA combobox with a list box). Focus stays in
 * the input; arrow keys move through the suggestions, Enter picks one, Escape closes the list. Typing a
 * title that isn't in the catalog works as before and simply adds a new one.
 */
export function TitleCombobox({ id, value, category, linked, owned, onChange, onPick, onUnlink, invalid, describedBy }: TitleComboboxProps) {
  const listId = useId();
  const [results, setResults] = useState<Results | null>(null);
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [input, setInput] = useState<HTMLInputElement | null>(null);

  const query = value.trim();
  const searching = !linked && query.length >= MIN_QUERY;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/catalog/search?${new URLSearchParams({ category, q: query })}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as CatalogSearchResult;
        setResults({ category, query, items: data.results });
        setActive(-1);
      } catch {
        // A cancelled request is just the user typing on; any other failure leaves the field as a plain input.
        if (!controller.signal.aborted) setResults(null);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searching, category, query]);

  // Results from another type, or for a query that has since been cleared, are never shown.
  const items = searching && results?.category === category ? results.items : [];
  const settledEmpty = searching && results?.category === category && results.query === query && items.length === 0;
  const open = !dismissed && items.length > 0;
  const optionId = (i: number) => `${listId}-${i}`;

  const pick = (item: MediaItem) => {
    if (owned(item)) return;
    setDismissed(true);
    setActive(-1);
    onPick(item);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (items.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setDismissed(false);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 ? (step === 1 ? 0 : items.length - 1) : (a + step + items.length) % items.length));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault(); // pick the suggestion instead of submitting the form
      pick(items[active]);
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    setDismissed(false);
    setActive(-1);
    onChange(e.target.value);
  };

  return (
    <div className={styles.wrap}>
      <Popover.Root open={open} onOpenChange={(next) => !next && setDismissed(true)}>
        <Popover.Anchor asChild>
          <input
            ref={setInput}
            id={id}
            className={inputClass}
            value={value}
            onChange={onInput}
            onKeyDown={onKeyDown}
            onFocus={() => setDismissed(false)}
            onBlur={() => setDismissed(true)}
            autoComplete="off"
            autoFocus
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
          />
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            className={styles.popup}
            align="start"
            sideOffset={6}
            collisionPadding={12}
            // Focus never leaves the input, so the list neither takes it on open nor gives it back on close.
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.target === input && e.preventDefault()}
          >
            {/* Clicking an option must not blur the input first, or the list would close before the click lands. */}
            <ul id={listId} role="listbox" aria-label={`Matching ${category} titles`} className={styles.list} onMouseDown={(e) => e.preventDefault()}>
              {items.map((item, i) => {
                const taken = owned(item);
                return (
                  <li
                    key={item.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={taken || undefined}
                    data-active={i === active || undefined}
                    className={styles.option}
                    onClick={() => pick(item)}
                    onMouseMove={() => active !== i && setActive(i)}
                  >
                    <div className={styles.thumb} aria-hidden="true">
                      <Cover item={item} compact />
                    </div>
                    <div className={styles.text}>
                      <span className={styles.name}>{item.title}</span>
                      <span className={styles.sub}>
                        {[bylineOf(item), seriesOf(item)?.name].filter(Boolean).join(" · ") || "No details yet"}
                      </span>
                    </div>
                    {taken && <span className={styles.badge}>In your collection</span>}
                  </li>
                );
              })}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <p className="sr-only" role="status">
        {open ? `${items.length} matching ${items.length === 1 ? "title" : "titles"} in the shared catalog. Use the arrow keys to choose.` : ""}
      </p>

      {linked && (
        <p className={styles.note}>
          <CheckIcon aria-hidden="true" /> Using the shared catalog entry. Its details are filled in below; changes you save to them update it for everyone.
          <Button variant="quiet" size="sm" onClick={onUnlink}>
            Don’t link
          </Button>
        </p>
      )}
      {settledEmpty && <p className={styles.note}>Not in the shared catalog yet. It will be added when you save.</p>}
    </div>
  );
}
