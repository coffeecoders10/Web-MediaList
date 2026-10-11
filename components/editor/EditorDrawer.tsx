"use client";

import { Cross2Icon, MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { Dialog, Slider, ToggleGroup } from "radix-ui";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { describedBy, Field, inputClass, textareaClass } from "@/components/ui/Field";
import { CategoryIcon, StatusGlyph } from "@/components/ui/Icons";
import { Select } from "@/components/ui/Select";
import { useWorkspace, type EditorTarget } from "@/components/workspace/Workspace";
import { allGenres, allTags } from "@/lib/media/filters";
import { useMedia } from "@/lib/media/store";
import { CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, STATUSES, isCategory, type Category, type Status } from "@/lib/media/types";
import { emptyDraft, fromDraft, toDraft, validate, type Draft, type DraftErrors } from "./draft";
import { GenreInput } from "./GenreInput";
import styles from "./EditorDrawer.module.css";

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
        <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
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
  const tagSuggestions = useMemo(() => allTags(items), [items]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const id = (name: string) => `${uid}-${name}`;
  const text = (key: keyof Draft, props: { inputMode?: "numeric"; placeholder?: string; type?: string } = {}) => ({
    id: id(key),
    className: inputClass,
    value: draft[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": describedBy(id(key), { error: errors[key] }),
    ...props,
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
  const seasonTotal = draft.seasons.reduce((a, s) => a + (Number(s) || 0), 0);

  return (
    <>
      <header className={styles.head}>
        <Dialog.Title className={styles.title}>{heading}</Dialog.Title>
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
                onValueChange={(v) => isCategory(v) && set("category", v)}
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
            <input {...text("title")} autoFocus autoComplete="off" />
          </Field>

          <div className={styles.row}>
            <Field label={CREATOR_LABEL[category]} htmlFor={id("creator")}>
              <input {...text("creator")} autoComplete="off" />
            </Field>
            <Field label="Year" htmlFor={id("year")} error={errors.year}>
              <input {...text("year", { inputMode: "numeric", placeholder: "2021" })} />
            </Field>
          </div>

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

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Progress</legend>
            {category === "book" && (
              <>
                <div className={styles.row}>
                  <Field label="Pages read" htmlFor={id("pagesRead")} error={errors.pagesRead}>
                    <input {...text("pagesRead", { inputMode: "numeric" })} />
                  </Field>
                  <Field label="Total pages" htmlFor={id("pagesTotal")} error={errors.pagesTotal}>
                    <input {...text("pagesTotal", { inputMode: "numeric" })} />
                  </Field>
                </div>
                <div className={styles.row}>
                  <Field label="Chapters read" htmlFor={id("chaptersRead")} error={errors.chaptersRead}>
                    <input {...text("chaptersRead", { inputMode: "numeric" })} />
                  </Field>
                  <Field label="Total chapters" htmlFor={id("chaptersTotal")} error={errors.chaptersTotal}>
                    <input {...text("chaptersTotal", { inputMode: "numeric" })} />
                  </Field>
                </div>
                <Field label="Series name" htmlFor={id("seriesName")} hint="Leave empty for a standalone book.">
                  <input {...text("seriesName")} autoComplete="off" />
                </Field>
                <div className={styles.row}>
                  <Field label="Volume" htmlFor={id("seriesVolume")} error={errors.seriesVolume}>
                    <input {...text("seriesVolume", { inputMode: "numeric", placeholder: "1" })} />
                  </Field>
                  <Field label="Volumes in series" htmlFor={id("seriesOf")} error={errors.seriesOf}>
                    <input {...text("seriesOf", { inputMode: "numeric" })} />
                  </Field>
                </div>
              </>
            )}

            {category === "movie" && (
              <Field label="Runtime (minutes)" htmlFor={id("runtimeMinutes")} error={errors.runtimeMinutes}>
                <input {...text("runtimeMinutes", { inputMode: "numeric", placeholder: "120" })} />
              </Field>
            )}

            {(category === "series" || category === "anime") && (
              <>
                <div className={styles.seasons} role="group" aria-labelledby={id("seasons-label")}>
                  <span className={styles.groupLabel} id={id("seasons-label")}>
                    Episodes per season
                  </span>
                  {draft.seasons.map((value, i) => (
                    <div key={i} className={styles.seasonRow}>
                      <label htmlFor={id(`season-${i}`)} className={styles.seasonLabel}>
                        Season {i + 1}
                      </label>
                      <input
                        id={id(`season-${i}`)}
                        className={inputClass}
                        inputMode="numeric"
                        value={value}
                        aria-invalid={errors.seasons && !/^[1-9]\d*$/.test(value.trim()) ? true : undefined}
                        aria-describedby={errors.seasons ? id("seasons-error") : undefined}
                        onChange={(e) => set("seasons", draft.seasons.map((s, j) => (j === i ? e.target.value : s)))}
                      />
                      <Button
                        variant="quiet"
                        size="sm"
                        icon
                        aria-label={`Remove season ${i + 1}`}
                        disabled={draft.seasons.length === 1}
                        onClick={() => set("seasons", draft.seasons.filter((_, j) => j !== i))}
                      >
                        <MinusIcon />
                      </Button>
                    </div>
                  ))}
                  {errors.seasons && (
                    <p id={id("seasons-error")} className={styles.error} role="alert">
                      {errors.seasons}
                    </p>
                  )}
                  <Button variant="outline" size="sm" onClick={() => set("seasons", [...draft.seasons, ""])} className={styles.addSeason}>
                    <PlusIcon aria-hidden="true" /> Add season
                  </Button>
                </div>
                <Field
                  label="Episodes watched"
                  htmlFor={id("watchedEpisodes")}
                  error={errors.watchedEpisodes}
                  hint={seasonTotal ? `Counted from the first episode, out of ${seasonTotal}.` : undefined}
                >
                  <input {...text("watchedEpisodes", { inputMode: "numeric" })} />
                </Field>
              </>
            )}
          </fieldset>

          <Field label="Genres" htmlFor={id("genres")}>
            <GenreInput id={id("genres")} value={draft.genres} onChange={(g) => set("genres", g)} suggestions={genreSuggestions} />
          </Field>

          <Field label="Tags" htmlFor={id("tags")}>
            <GenreInput id={id("tags")} value={draft.tags} onChange={(t) => set("tags", t)} suggestions={tagSuggestions} noun="tag" />
          </Field>

          <Field label="Synopsis" htmlFor={id("synopsis")}>
            <textarea {...text("synopsis")} className={textareaClass} rows={3} />
          </Field>

          <Field label="Your notes" htmlFor={id("notes")}>
            <textarea {...text("notes")} className={textareaClass} rows={3} />
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
            <Field label="Started" htmlFor={id("startedAt")}>
              <input {...text("startedAt", { type: "date" })} />
            </Field>
            <Field label="Finished" htmlFor={id("finishedAt")} error={errors.finishedAt}>
              <input {...text("finishedAt", { type: "date" })} />
            </Field>
          </div>
          {base && (
            <p className={styles.note}>
              Changes to the title, genres or totals apply to your copy only. The shared catalog entry stays as it is for everyone else.
            </p>
          )}
          {draft.status === "completed" && (
            <p className={styles.note}>Completed titles are saved as fully {category === "book" ? "read" : "watched"}.</p>
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
