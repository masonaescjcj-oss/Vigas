/**
 * frontend/src/services/formatting.ts
 * ---------------------------------------------------------------------------
 * Pure formatting helpers, deliberately free of any Supabase/network import so
 * they can be unit-tested without booting a client (and so importing a
 * formatter never drags the whole data layer into a bundle).
 * ---------------------------------------------------------------------------
 */

export interface ProjectFileEntry {
  path: string;
  name: string;
  /** Directory depth, 0 for files at the project root. */
  depth: number;
  sizeLabel: string;
  ext: string;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Flat, sorted file list for the file-tree sheet, derived from a file bundle. */
export function toFileEntries(files: Record<string, string>): ProjectFileEntry[] {
  return Object.entries(files)
    .map(([path, contents]) => {
      const segments = path.split("/");
      const name = segments[segments.length - 1];
      return {
        path,
        name,
        depth: segments.length - 1,
        sizeLabel: formatSize(new TextEncoder().encode(contents).length),
        ext: (name.includes(".") ? name.split(".").pop()! : "").toUpperCase(),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** "3 min ago" / "2 hr ago" / "5 days ago" from an ISO timestamp. */
export function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
