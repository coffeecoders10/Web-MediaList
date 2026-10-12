"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { Dialog, Slider, ToggleGroup } from "radix-ui";
import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { describedBy, Field, inputClass, textareaClass } from "@/components/ui/Field";
import { CategoryIcon, StatusGlyph } from "@/components/ui/Icons";
import { Select } from "@/components/ui/Select";
import { useWorkspace, type EditorTarget } from "@/components/workspace/Workspace";
import { allGenres } from "@/lib/media/filters";
import { useMedia } from "@/lib/media/store";
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, STATUSES, isCategory, type Category, type Status } from "@/lib/media/types";
import { applyCatalogItem, emptyDraft, fromDraft, toDraft, validate, type Draft, type DraftErrors, type TextKey } from "./draft";
import { GenreInput } from "./GenreInput";
import { ProgressFields, type Bind } from "./ProgressFields";
import { TitleCombobox } from "./TitleCombobox";
import styles from "./EditorDrawer.module.css";

/** Suggestions only: the type is free text. */
const MOVIE_TYPES = ["Hollywood", "Bollywood", "Tollywood", "Korean", "Japanese", "French", "British"];

const CREATOR_LABEL: Record<Category, string> = {
  book: "Author",
  movie: "Director",
  series: "Creator",
  anime: "Studio",
};

export function EditorDrawer() {
  const { editor, closeEditor } = useWorkspace();
  // Keep the last target around so the form stays populated while the drawer animates out.
  const [shown, setShown] = useState<EditorTarget | null>(null);
  if (editor && editor !== shown) setShown(editor);

  return (
    <Dialog.Root open={editor !== null} onOpenChange={(open) => !open && closeEditor()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.drawer}>
          {shown && <EditorForm key={shown.mode === "edit" ? shown.id : "new"} target={shown} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorForm({ target }: { target: EditorTarget }) {
  const uid = useId();
  const { get, save, add, items } = useMedia();
  const { closeEditor, notify } = useWorkspace();
  const base = target.mode === "edit" ? (get(target.id) ?? null) : null;
  const [draft, setDraft] = useState<Draft>(() => (base ? toDraft(base) : emptyDraft()));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const genreSuggestions = useMemo(() => allGenres(items).map((g) => g.name), [items]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const id = (name: string) => `${uid}-${name}`;
  const common = (key: TextKey) => ({
    id: id(key),
    value: draft[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": describedBy(id(key), { error: errors[key] }),
  });
  const text: Bind = (key, props = {}) => ({
    ...common(key),
    className: inputClass,
    onChange: (e) => set(key, e.target.value),
    ...props,
  });
  const area = (key: TextKey) => ({
    ...common(key),
    className: textareaClass,
    rows: 3,
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => set(key, e.target.value),
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const item = fromDraft(draft, base);

    if (base) {
      save(item);
      notify(`Saved changes to “${item.title}”`);
      closeEditor();
      return;
    }

    // A new title waits for the server, which decides whether it is already in the shared catalog.
    setSaving(true);
    setFormError(null);
    const result = await add([item]);
    setSaving(false);
    if (!result.ok) return setFormError(result.error);
    if (result.items.length === 0) return setFormError("That title is already in your collection.");
    notify(result.matched ? `Added “${item.title}”, already in the shared catalog` : `Added “${item.title}”`);
    closeEditor();
  };

  const category = draft.category;
  const heading = base ? `Edit ${base.title}` : "Add a title";

  return (
    <>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Dialog.Title className={styles.title}>{heading}</Dialog.Title>
          <Dialog.Description className={styles.lede}>Only the title is required. Add as much or as little as you like.</Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button variant="quiet" icon aria-label="Close without saving">
            <Cross2Icon />
          </Button>
        </Dialog.Close>
      </header>

      <form ref={formRef} onSubmit={onSubmit} noValidate className={styles.form} id={id("form")}>
        <div className={styles.body}>
          {!base && (
            <div className={styles.field}>
              <span className={styles.groupLabel} id={id("category")}>
                What is it?
              </span>
              <ToggleGroup.Root
                type="single"
                value={category}
                onValueChange={(v) => isCategory(v) && setDraft((d) => ({ ...d, category: v, catalogId: null }))}
                aria-labelledby={id("category")}
                className={styles.categories}
              >
                {CATEGORIES.map((c) => (
                  <ToggleGroup.Item key={c} value={c} className={styles.categoryItem}>
                    <CategoryIcon category={c} size={18} />
                    {CATEGORY_LABEL[c].singular}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            </div>
          )}

          <Field label="Title" htmlFor={id("title")} error={errors.title}>
            {base ? (
              <input {...text("title")} autoFocus autoComplete="off" />
            ) : (
              <TitleCombobox
                id={id("title")}
                value={draft.title}
                category={category}
                linked={draft.catalogId !== null}
                owned={(item) => items.some((i) => i.id === item.id)}
                // Typing again means it is no longer the catalog's title, so the link goes.
                onChange={(title) => setDraft((d) => ({ ...d, title, catalogId: null }))}
                onPick={(item) => setDraft((d) => applyCatalogItem(d, item))}
                onUnlink={() => set("catalogId", null)}
                invalid={!!errors.title}
                describedBy={describedBy(id("title"), { error: errors.title })}
              />
            )}
          </Field>

          <div className={styles.row}>
            <Field label={CREATOR_LABEL[category]} htmlFor={id("creator")}>
              <input {...text("creator")} autoComplete="off" />
            </Field>
            <Field label="Year (optional)" htmlFor={id("year")} error={errors.year}>
              <input {...text("year", { inputMode: "numeric", placeholder: "2021" })} />
            </Field>
          </div>

          {category === "book" && (
            <div className={styles.seriesRow}>
              <Field label="Series" htmlFor={id("seriesName")} hint="Leave empty for a standalone book.">
                <input {...text("seriesName")} autoComplete="off" />
              </Field>
              <Field label="Vol." htmlFor={id("seriesVolume")} error={errors.seriesVolume}>
                <input {...text("seriesVolume", { inputMode: "numeric", placeholder: "1" })} />
              </Field>
            </div>
          )}

          {category === "movie" && (
            <div className={styles.row}>
              <Field label="Type" htmlFor={id("type")}>
                <input {...text("type", { placeholder: "Hollywood, Bollywood…", list: id("type-options") })} autoComplete="off" />
                <datalist id={id("type-options")}>
                  {MOVIE_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <Field label="Runtime (minutes)" htmlFor={id("runtimeMinutes")} error={errors.runtimeMinutes}>
                <input {...text("runtimeMinutes", { inputMode: "numeric", placeholder: "120" })} />
              </Field>
            </div>
          )}

          <div className={styles.row}>
            <Field label="Status" htmlFor={id("status")}>
              <Select<Status>
                id={id("status")}
                label="Status"
                value={draft.status}
                onValueChange={(v) => set("status", v)}
                options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], leading: <StatusGlyph status={s} size={15} /> }))}
              />
            </Field>
            <div className={styles.field}>
              <span className={styles.groupLabel} id={id("rating-label")}>
                Rating
              </span>
              <div className={styles.rating}>
                <Slider.Root
                  className={styles.slider}
                  min={0}
                  max={10}
                  step={0.5}
                  value={[draft.rating ?? 0]}
                  onValueChange={([v]) => set("rating", v > 0 ? v : null)}
                >
                  <Slider.Track className={styles.track}>
                    <Slider.Range className={styles.range} />
                  </Slider.Track>
                  <Slider.Thumb className={styles.thumb} aria-labelledby={id("rating-label")} />
                </Slider.Root>
                <output className={styles.ratingValue} aria-live="polite">
                  {draft.rating === null ? "Not rated" : `${draft.rating.toFixed(draft.rating % 1 ? 1 : 0)} / 10`}
                </output>
              </div>
            </div>
          </div>

          <ProgressFields draft={draft} errors={errors} bind={text} onTracking={(tracking) => set("tracking", tracking)} />

          <Field label="Genres" htmlFor={id("genres")}>
            <GenreInput id={id("genres")} value={draft.genres} onChange={(g) => set("genres", g)} suggestions={genreSuggestions} />
          </Field>

          <Field label="Synopsis" htmlFor={id("synopsis")}>
            <textarea {...area("synopsis")} />
          </Field>

          <Field label="Your notes" htmlFor={id("notes")}>
            <textarea {...area("notes")} />
          </Field>

          <Field
            label="Poster image link"
            htmlFor={id("posterUrl")}
            error={errors.posterUrl}
            hint="Optional. Without one, The Archive draws a cover for you."
          >
            <input {...text("posterUrl", { type: "url", placeholder: "https://" })} />
          </Field>

          <div className={styles.row}>
            <Field label="Started (optional)" htmlFor={id("startedAt")}>
              <input {...text("startedAt", { type: "date" })} />
            </Field>
            {draft.status === "completed" && (
              <Field label="Finished (optional)" htmlFor={id("finishedAt")} error={errors.finishedAt}>
                <input {...text("finishedAt", { type: "date" })} />
              </Field>
            )}
          </div>
          {base && (
            <p className={styles.note}>
              Changes to the title, genres or totals apply to your copy only. The shared catalog entry stays as it is for everyone else.
            </p>
          )}
          {draft.status === "completed" && category !== "movie" && (
            <p className={styles.note}>Completed titles are saved as fully {category === "book" ? "read" : "watched"}, where the total is known.</p>
          )}
        </div>

        <footer className={styles.foot}>
          {formError && (
            <p className={styles.footError} role="alert">
              {formError}
            </p>
          )}
          <Dialog.Close asChild>
            <Button variant="outline">Cancel</Button>
          </Dialog.Close>
          <Button type="submit" variant="solid" disabled={saving} aria-busy={saving}>
            {base ? "Save changes" : saving ? "Adding…" : "Add to collection"}
          </Button>
        </footer>
      </form>
    </>
  );
}
