"use client";

import { CheckIcon, Cross2Icon, GridIcon, ListBulletIcon, MagnifyingGlassIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Checkbox, Popover, ToggleGroup } from "radix-ui";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryIcon, StatusGlyph } from "@/components/ui/Icons";
import { Select } from "@/components/ui/Select";
import { SORT_LABEL, SORTS, type LibraryFilters, type SortKey } from "@/lib/media/filters";
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, STATUSES, isCategory, isStatus, type Category } from "@/lib/media/types";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  filters: LibraryFilters;
  onChange: (patch: Partial<LibraryFilters>) => void;
  categoryCounts: Record<Category, number>;
  total: number;
  genres: { name: string; count: number }[];
}

const RATING_OPTIONS = [
  { value: "0", label: "Any rating" },
  { value: "6", label: "6 and up" },
  { value: "7", label: "7 and up" },
  { value: "8", label: "8 and up" },
  { value: "9", label: "9 and up" },
];

export function FilterBar({ filters, onChange, categoryCounts, total, genres }: FilterBarProps) {
  // The box keeps what you typed; the URL (and the results) follow a beat later.
  const [typed, setTyped] = useState(filters.q);
  const [urlQ, setUrlQ] = useState(filters.q);
  const commitTimer = useRef(0);
  if (filters.q !== urlQ) {
    setUrlQ(filters.q);
    setTyped(filters.q);
  }

  const commitSearch = (value: string) => {
    setTyped(value);
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => onChange({ q: value.trim() }), 180);
  };

  return (
    <div className={styles.bar}>
      <div className={styles.top}>
        <div className={styles.search}>
          <MagnifyingGlassIcon className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search title, creator, genre or series"
            aria-label="Search your collection"
            value={typed}
            onChange={(e) => commitSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && commitSearch("")}
          />
          {typed && (
            <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => commitSearch("")}>
              <Cross2Icon />
            </button>
          )}
        </div>

        <ToggleGroup.Root
          type="single"
          className={styles.view}
          value={filters.view}
          onValueChange={(v) => (v === "grid" || v === "list") && onChange({ view: v })}
          aria-label="Layout"
        >
          <ToggleGroup.Item value="grid" className={styles.viewItem} aria-label="Cover grid">
            <GridIcon />
          </ToggleGroup.Item>
          <ToggleGroup.Item value="list" className={styles.viewItem} aria-label="Detailed list">
            <ListBulletIcon />
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      <ToggleGroup.Root
        type="single"
        className={styles.categories}
        value={filters.category ?? "all"}
        onValueChange={(v) => v && onChange({ category: isCategory(v) ? v : null })}
        aria-label="Category"
      >
        <ToggleGroup.Item value="all" className={styles.category}>
          All <span className={styles.count}>{total}</span>
        </ToggleGroup.Item>
        {CATEGORIES.map((c) => (
          <ToggleGroup.Item key={c} value={c} className={styles.category}>
            <CategoryIcon category={c} size={15} />
            {CATEGORY_LABEL[c].plural}
            <span className={styles.count}>{categoryCounts[c]}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div className={styles.row}>
        <ToggleGroup.Root
          type="multiple"
          className={styles.statuses}
          value={filters.statuses}
          onValueChange={(v) => onChange({ statuses: v.filter(isStatus) })}
          aria-label="Status"
        >
          {STATUSES.map((s) => (
            <ToggleGroup.Item key={s} value={s} className={styles.status} data-status={s}>
              <StatusGlyph status={s} size={14} />
              {STATUS_LABEL[s]}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        <div className={styles.selects}>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="outline" size="sm" className={styles.genreTrigger}>
                <MixerHorizontalIcon aria-hidden="true" />
                Genre
                {filters.genres.length > 0 && <span className={styles.badge}>{filters.genres.length}</span>}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.popover} align="end" sideOffset={8} collisionPadding={12}>
                <p className={styles.popoverHint}>Titles must match every genre you pick.</p>
                <ul className={styles.genreList}>
                  {genres.map((g) => {
                    const checked = filters.genres.includes(g.name);
                    const id = `genre-${g.name}`;
                    return (
                      <li key={g.name}>
                        <label htmlFor={id} className={styles.genreOption}>
                          <Checkbox.Root
                            id={id}
                            className={styles.checkbox}
                            checked={checked}
                            onCheckedChange={(on) =>
                              onChange({ genres: on === true ? [...filters.genres, g.name] : filters.genres.filter((x) => x !== g.name) })
                            }
                          >
                            <Checkbox.Indicator>
                              <CheckIcon />
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          <span>{g.name}</span>
                          <span className={styles.count}>{g.count}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {filters.genres.length > 0 && (
                  <Button variant="quiet" size="sm" onClick={() => onChange({ genres: [] })}>
                    Clear genres
                  </Button>
                )}
                <Popover.Arrow className={styles.arrow} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Select
            size="sm"
            label="Rating"
            value={String(filters.minRating)}
            onValueChange={(v) => onChange({ minRating: Number(v) })}
            options={RATING_OPTIONS}
          />
          <Select<SortKey>
            size="sm"
            label="Sort"
            prefix
            value={filters.sort}
            onValueChange={(sort) => onChange({ sort })}
            options={SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))}
          />
        </div>
      </div>
    </div>
  );
}
