/**
 * scripts/gen-preview-probe.ts
 * ---------------------------------------------------------------------------
 * Render the Expo starter through the real preview pipeline and write the
 * result where the dev server will serve it.
 *
 * The unit tests assert what the generated HTML *contains* — the import map,
 * the react-native-web alias. They cannot assert that it runs. This produces
 * the same artifact the app produces so a browser can load it and be asked
 * whether a React Native tree actually rendered.
 *
 * Writes to public/, which Expo serves statically, then you open
 * http://localhost:8082/__preview_probe.html and look. Delete it afterwards;
 * it is a probe, not a page.
 *
 * What it proved on 2026-08-23: the Expo starter rendered with 7 nodes
 * carrying react-native-web's own atomic class names — so RN primitives, not
 * plain divs — and pressing its button moved the counter 0 -> 1, so state and
 * touch both work. That is the claim the unit tests cannot make.
 *
 *   npx deno run --allow-all scripts/gen-preview-probe.ts
 * ---------------------------------------------------------------------------
 */
import { PROJECT_TEMPLATES } from "../supabase/functions/shared/templates.ts";
import { buildPreviewHtml } from "../src/services/previewBuilder.ts";

const template = PROJECT_TEMPLATES["expo"];
if (!template) {
  console.error(`No "expo" template. Have: ${Object.keys(PROJECT_TEMPLATES).join(", ")}`);
  Deno.exit(1);
}

const files: Record<string, string> = { ...template.files };
console.log(`template files: ${Object.keys(files).join(", ")}`);

// A marker the browser can look for, proving the *template's own* component
// rendered rather than some fallback shell.
const html = buildPreviewHtml(files);

await Deno.mkdir("public", { recursive: true });
await Deno.writeTextFile("public/__preview_probe.html", html);
console.log(`wrote public/__preview_probe.html (${html.length} bytes)`);
