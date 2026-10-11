"use client";

import { AlertDialog, Toast } from "radix-ui";
import { Cross2Icon } from "@radix-ui/react-icons";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { EditorDrawer } from "@/components/editor/EditorDrawer";
import { loadSample } from "@/lib/media/sample";
import { useMedia } from "@/lib/media/store";
import type { MediaItem } from "@/lib/media/types";
import styles from "./Workspace.module.css";

export type EditorTarget = { mode: "new" } | { mode: "edit"; id: string };

interface Notice {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface Workspace {
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  editor: EditorTarget | null;
  openEditor: (target: EditorTarget) => void;
  closeEditor: () => void;
  requestDelete: (item: MediaItem, onDeleted?: () => void) => void;
  notify: (message: string, action?: Notice["action"]) => void;
  /** Adds the bundled sample titles to the collection, reporting the result. */
  addSampleTitles: () => Promise<void>;
}

const WorkspaceContext = createContext<Workspace | null>(null);

const EDIT_KEY = "the-archive:edit-mode";
const editListeners = new Set<() => void>();

function subscribeEdit(listener: () => void) {
  editListeners.add(listener);
  return () => void editListeners.delete(listener);
}
function readEdit() {
  try {
    return window.localStorage.getItem(EDIT_KEY) === "1";
  } catch {
    return false;
  }
}
function writeEdit(on: boolean) {
  try {
    window.localStorage.setItem(EDIT_KEY, on ? "1" : "0");
  } catch {
    // Storage may be blocked; the toggle simply won't persist.
  }
  editListeners.forEach((l) => l());
}

let noticeSeq = 0;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const media = useMedia();
  const editMode = useSyncExternalStore(subscribeEdit, readEdit, () => false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ item: MediaItem; onDeleted?: () => void } | null>(null);

  const notify = useCallback((message: string, action?: Notice["action"]) => {
    setNotices((prev) => [...prev, { id: ++noticeSeq, message, action }]);
  }, []);

  const { onError, add } = media;
  useEffect(() => onError((message) => notify(message)), [onError, notify]);

  const addSampleTitles = useCallback(async () => {
    const result = await add(await loadSample());
    if (!result.ok) return notify(result.error);
    notify(result.items.length ? `Added ${result.items.length} sample ${result.items.length === 1 ? "title" : "titles"}` : "You already have all the sample titles");
  }, [add, notify]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { item, onDeleted } = pendingDelete;
    const removed = media.remove(item.id);
    setPendingDelete(null);
    onDeleted?.();
    if (removed) notify(`Deleted “${removed.title}”`, { label: "Undo", run: () => media.save(removed) });
  };

  const value = useMemo<Workspace>(
    () => ({
      editMode,
      setEditMode: writeEdit,
      editor,
      openEditor: setEditor,
      closeEditor: () => setEditor(null),
      requestDelete: (item, onDeleted) => setPendingDelete({ item, onDeleted }),
      notify,
      addSampleTitles,
    }),
    [editMode, editor, notify, addSampleTitles],
  );

  return (
    <WorkspaceContext value={value}>
      <Toast.Provider duration={6000} swipeDirection="right">
        {children}
        <EditorDrawer />

        <AlertDialog.Root open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className={styles.overlay} />
            <AlertDialog.Content className={styles.alert}>
              <AlertDialog.Title className={styles.alertTitle}>Delete “{pendingDelete?.item.title}”?</AlertDialog.Title>
              <AlertDialog.Description className={styles.alertBody}>
                It will be removed from your collection. You can undo right after.
              </AlertDialog.Description>
              <div className={styles.alertActions}>
                <AlertDialog.Cancel asChild>
                  <Button variant="outline">Keep it</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button variant="danger" onClick={confirmDelete}>
                    Delete
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>

        {notices.map((n) => (
          <Toast.Root
            key={n.id}
            className={styles.toast}
            onOpenChange={(open) => !open && setNotices((prev) => prev.filter((x) => x.id !== n.id))}
          >
            <Toast.Description className={styles.toastText}>{n.message}</Toast.Description>
            {n.action && (
              <Toast.Action altText={`${n.action.label} — ${n.message}`} asChild>
                <Button variant="quiet" size="sm" onClick={n.action.run}>
                  {n.action.label}
                </Button>
              </Toast.Action>
            )}
            <Toast.Close asChild>
              <Button variant="quiet" size="sm" icon aria-label="Dismiss">
                <Cross2Icon />
              </Button>
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className={styles.viewport} label="Notifications" />
      </Toast.Provider>
    </WorkspaceContext>
  );
}

export function useWorkspace(): Workspace {
  const ctx = use(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
