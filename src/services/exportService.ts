/**
 * frontend/src/services/exportService.ts
 * ---------------------------------------------------------------------------
 * Taking your project with you.
 *
 * The server returns a signed, short-lived link. Opening it is left to the
 * platform rather than fetched into memory: a zip can be tens of megabytes, and
 * the browser and the OS both already know how to save a download.
 * ---------------------------------------------------------------------------
 */

import { Linking, Platform } from "react-native";
import { invokeFunction } from "./functionsClient";

export interface ProjectExport {
  url: string;
  fileName: string;
  fileCount: number;
  sizeBytes: number;
  /** The link stops working after this. Worth telling the user. */
  expiresInSeconds: number;
}

export async function exportProject(projectId: string): Promise<ProjectExport> {
  return invokeFunction<ProjectExport>("project-export", { body: { projectId } });
}

/** Bytes as something a person reads. */
export function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Hand the link to whatever saves downloads here.
 *
 * @returns false when nothing could open it, so the caller can show the URL
 *          instead of silently doing nothing.
 */
export async function openDownload(url: string): Promise<boolean> {
  if (Platform.OS === "web") {
    // The response carries Content-Disposition: attachment, so a plain navigation
    // saves the file rather than replacing the app with a binary.
    const opener = (globalThis as { open?: (target: string, features?: string) => unknown }).open;
    if (typeof opener === "function") {
      opener(url, "_blank");
      return true;
    }
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
