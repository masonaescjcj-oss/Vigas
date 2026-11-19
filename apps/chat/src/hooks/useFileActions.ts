/**
 * frontend/src/hooks/useFileActions.ts
 * ---------------------------------------------------------------------------
 * Rename and delete for a project file, shared by the two screens that show a
 * file tree so the confirmation wording and the refresh behaviour stay the
 * same in both.
 *
 * The rename prompt is modal state rather than a call, because React Native has
 * no cross-platform text prompt — see TextPromptModal.
 * ---------------------------------------------------------------------------
 */

import { useState } from "react";
import { confirmAction, notify } from "../services/notify";
import { deleteProjectFile, renameProjectFile } from "../services/fileService";
import type { FileNode } from "./useFileTree";

export const useFileActions = (projectId: string, onChanged: () => void) => {
  const [renaming, setRenaming] = useState<FileNode | null>(null);
  const [busy, setBusy] = useState(false);

  const requestRename = (node: FileNode) => setRenaming(node);

  /** `name` is the new basename; the file stays in its folder. */
  const confirmRename = async (name: string) => {
    const node = renaming;
    setRenaming(null);
    if (!node || busy) return;
    const parent = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "";
    const toPath = parent ? `${parent}/${name}` : name;
    if (toPath === node.path) return;

    setBusy(true);
    try {
      await renameProjectFile(projectId, node.path, toPath);
      onChanged();
    } catch (e: any) {
      notify("Rename failed", e?.message ?? "The file was not renamed.");
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = async (node: FileNode) => {
    if (busy) return;
    const confirmed = await confirmAction(
      `Delete ${node.name}?`,
      "This removes the file from the project. A restore point from before the last run may still contain it.",
      { destructive: true, confirmLabel: "Delete" },
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteProjectFile(projectId, node.path);
      onChanged();
    } catch (e: any) {
      notify("Delete failed", e?.message ?? "The file was not deleted.");
    } finally {
      setBusy(false);
    }
  };

  return { renaming, busy, requestRename, confirmRename, cancelRename: () => setRenaming(null), requestDelete };
};
