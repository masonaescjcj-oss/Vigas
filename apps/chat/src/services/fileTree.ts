/**
 * frontend/src/services/fileTree.ts
 * ---------------------------------------------------------------------------
 * Turning a flat list of file paths into an explorer tree. Pure, and kept out
 * of the hook so it can be tested without pulling in a Supabase client.
 * ---------------------------------------------------------------------------
 */

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

/** Folders first, then files; each group sorted by name, at every level. */
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    let level = root;

    segments.forEach((name, index) => {
      const isLast = index === segments.length - 1;
      const nodePath = segments.slice(0, index + 1).join("/");
      // A file and a folder can legitimately share a name, so both parts of
      // the identity matter when looking for an existing node.
      let node = level.find((entry) => entry.name === name && entry.isDir === !isLast);

      if (!node) {
        node = { name, path: nodePath, isDir: !isLast, children: isLast ? undefined : [] };
        level.push(node);
      }
      if (!isLast) level = node.children!;
    });
  }

  const sort = (nodes: FileNode[]): FileNode[] =>
    nodes
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
      .map((node) => (node.children ? { ...node, children: sort(node.children) } : node));

  return sort(root);
}
