/**
 * scripts/check-existing-codebase.ts
 * ---------------------------------------------------------------------------
 * The three things the from-scratch checks never touched.
 *
 * check-full-shop and check-not-a-website both build on empty ground, which is
 * the easy case: nothing to read, nothing to understand, nothing to break.
 * Real work is the other three:
 *
 *   1. finding your way around code somebody else wrote
 *   2. debugging — a test fails and nobody says why
 *   3. coming back to the same project for a second change
 *
 * So this seeds a small Python package with a genuine logic bug and a test that
 * catches it, says only "the tests fail, fix it", and then asks for a feature on
 * top. Both rounds are verified by *running the tests here*, not by reading the
 * diff and hoping — the agent's own account of its work is exactly what should
 * not be trusted.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-existing-codebase.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;
const PYTHON = Deno.env.get("PYTHON") ?? "python";

const RUN_TIMEOUT_MS = 600_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 700)}`}`);
  if (!ok) Deno.exitCode = 1;
}

/**
 * The seeded project.
 *
 * The bug is in `restock`: it assigns where it should add, so restocking an
 * item that is already stocked silently throws away the existing count. That is
 * a real shape of bug — it reads correctly, it passes a casual glance, and only
 * a test that restocks twice catches it.
 *
 * `pricing.py` is here to be navigated past. It is correct, it has passing
 * tests, and touching it would be collateral damage.
 */
const SEED: Record<string, string> = {
  "README.md": [
    "# Inventory",
    "",
    "A small stock-keeping library.",
    "",
    "Run the tests with:",
    "",
    "    python -m unittest discover -s tests",
  ].join("\n"),

  "inventory/__init__.py": 'from .store import Store\nfrom .pricing import line_total\n\n__all__ = ["Store", "line_total"]\n',

  "inventory/store.py": [
    '"""Stock levels per SKU."""',
    "",
    "",
    "class OutOfStock(Exception):",
    '    """Raised when a sale asks for more than is on the shelf."""',
    "",
    "",
    "class Store:",
    "    def __init__(self):",
    "        self._items = {}",
    "",
    "    def restock(self, sku, quantity):",
    '        """Add `quantity` of `sku` to the shelf."""',
    "        if quantity <= 0:",
    '            raise ValueError("quantity must be positive")',
    "        self._items[sku] = quantity",
    "",
    "    def stock_of(self, sku):",
    "        return self._items.get(sku, 0)",
    "",
    "    def sell(self, sku, quantity):",
    "        have = self._items.get(sku, 0)",
    "        if quantity > have:",
    '            raise OutOfStock(f"only {have} of {sku} in stock")',
    "        self._items[sku] = have - quantity",
    "        return quantity",
    "",
  ].join("\n"),

  "inventory/pricing.py": [
    '"""Money, in whole cents. Never floats."""',
    "",
    "",
    "def line_total(unit_cents, quantity, discount_percent=0):",
    '    """Total for one order line, rounded half-up to the nearest cent."""',
    "    if quantity < 0:",
    '        raise ValueError("quantity must not be negative")',
    "    if not 0 <= discount_percent <= 100:",
    '        raise ValueError("discount_percent must be between 0 and 100")',
    "    gross = unit_cents * quantity",
    "    discount = (gross * discount_percent + 50) // 100",
    "    return gross - discount",
    "",
  ].join("\n"),

  // `unittest discover` needs the start directory to be importable, so this is
  // load-bearing rather than decoration — and a normal thing for a Python
  // project to have.
  "tests/__init__.py": "",

  "tests/test_store.py": [
    "import unittest",
    "",
    "from inventory import Store",
    "from inventory.store import OutOfStock",
    "",
    "",
    "class StoreTests(unittest.TestCase):",
    "    def test_restocking_the_same_sku_adds_up(self):",
    "        store = Store()",
    '        store.restock("apple", 5)',
    '        store.restock("apple", 3)',
    '        self.assertEqual(store.stock_of("apple"), 8)',
    "",
    "    def test_selling_reduces_stock(self):",
    "        store = Store()",
    '        store.restock("pear", 4)',
    '        store.sell("pear", 1)',
    '        self.assertEqual(store.stock_of("pear"), 3)',
    "",
    "    def test_cannot_sell_more_than_stocked(self):",
    "        store = Store()",
    '        store.restock("plum", 1)',
    "        with self.assertRaises(OutOfStock):",
    '            store.sell("plum", 2)',
    "",
    "",
    'if __name__ == "__main__":',
    "    unittest.main()",
    "",
  ].join("\n"),

  "tests/test_pricing.py": [
    "import unittest",
    "",
    "from inventory import line_total",
    "",
    "",
    "class PricingTests(unittest.TestCase):",
    "    def test_no_discount(self):",
    "        self.assertEqual(line_total(250, 4), 1000)",
    "",
    "    def test_discount_rounds_half_up(self):",
    "        self.assertEqual(line_total(999, 1, 10), 899)",
    "",
    "    def test_rejects_impossible_discount(self):",
    "        with self.assertRaises(ValueError):",
    "            line_total(100, 1, 150)",
    "",
    "",
    'if __name__ == "__main__":',
    "    unittest.main()",
    "",
  ].join("\n"),
};

/** Write the project to a temp dir and run its own test suite. */
async function runTests(files: Record<string, string>): Promise<{ ok: boolean; output: string }> {
  const dir = await Deno.makeTempDir({ prefix: "inv-" });
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const path = `${dir}/${rel}`;
      await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
      await Deno.writeTextFile(path, contents);
    }
    const proc = new Deno.Command(PYTHON, {
      args: ["-m", "unittest", "discover", "-s", "tests", "-t", "."],
      cwd: dir,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await proc.output();
    const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    return { ok: code === 0, output };
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}

try {
  // ── Sanity: the seeded project must genuinely fail, or the whole run proves
  //    nothing. A check that would pass before the work is worthless.
  const before = await runTests(SEED);
  check("the seeded project starts with a failing test", !before.ok,
    "it passes already — the bug is not doing its job");
  // Not merely failing — failing for the reason intended. The first version of
  // this went green on an ImportError from a missing tests/__init__.py, which
  // would have made every result below meaningless. That is the same shape of
  // false pass the whole script exists to catch in the agent.
  check(
    "it fails on the restock bug, not on a broken harness",
    /test_restocking_the_same_sku_adds_up/.test(before.output) && !/ImportError/.test(before.output),
    before.output.slice(-500),
  );
  check("exactly one test fails", /failures=1/.test(before.output), before.output.slice(-400));
  console.log(`      ${before.output.trim().split("\n").slice(-3).join(" | ")}\n`);

  const email = `edit-${stamp}@example.com`;
  const password = `Ed-${crypto.randomUUID()}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw createErr;
  cleanup.push(() => admin.auth.admin.deleteUser(created.user!.id));

  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const token = signIn.session!.access_token;

  const call = (name: string, body: unknown) =>
    fetch(`${API_URL}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const createProject = await call("projects-create", { name: `Inventory ${stamp}`, template: "blank" });
  const projectId = (await createProject.json().catch(() => ({})))?.project?.id;
  if (!projectId) throw new Error("no project id came back.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  const { data: projectRow } = await admin
    .from("projects").select("sandbox_path").eq("id", projectId).single();
  const sandboxPath = projectRow!.sandbox_path as string;

  for (const [rel, contents] of Object.entries(SEED)) {
    const { error } = await admin.storage.from("project-files")
      .upload(`${sandboxPath}/${rel}`, new Blob([contents], { type: "text/plain" }), { upsert: true });
    if (error) throw error;
  }
  console.log(`      seeded ${Object.keys(SEED).length} files into an existing project\n`);

  async function walk(prefix: string, depth = 0): Promise<string[]> {
    const { data } = await admin.storage.from("project-files").list(prefix, { limit: 200 });
    const out: string[] = [];
    for (const entry of data ?? []) {
      const full = `${prefix}/${entry.name}`;
      if (entry.id === null) { if (depth < 4) out.push(...await walk(full, depth + 1)); }
      else out.push(full);
    }
    return out;
  }

  async function readProject(): Promise<Record<string, string>> {
    const base = sandboxPath.length + 1;
    const files: Record<string, string> = {};
    for (const path of await walk(sandboxPath)) {
      const rel = path.slice(base);
      if (rel === ".keep") continue;
      const { data: blob } = await admin.storage.from("project-files").download(path);
      files[rel] = blob ? await blob.text() : "";
    }
    return files;
  }

  let sessionId: string | undefined;

  /** One turn, answering any question with the first option, until it settles. */
  async function turn(label: string, prompt: string): Promise<{ finalText: string; steps: number }> {
    let text = "";
    let steps = 0;
    let next = prompt;
    for (let round = 1; round <= 3; round++) {
      const run = await call("agent-run", { projectId, prompt: next, ...(sessionId ? { sessionId } : {}) });
      const body = await run.json().catch(() => ({}));
      sessionId = body?.session_id ?? sessionId;
      if (!sessionId) throw new Error(`no session id: ${JSON.stringify(body).slice(0, 200)}`);

      const seen = new Set<string>();
      const { data: prior } = await admin
        .from("agent_tasks").select("id").eq("session_id", sessionId).eq("tool_name", "agent-run")
        .in("status", ["success", "failed"]);
      for (const r of prior ?? []) seen.add(r.id as string);

      const started = Date.now();
      let leg: Record<string, unknown> | null = null;
      let status = "";
      while (Date.now() - started < RUN_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 6000));
        const { data: rows } = await admin
          .from("agent_tasks").select("id,tool_name,status,tool_output")
          .eq("session_id", sessionId).order("created_at", { ascending: true });
        steps = (rows ?? []).filter((r) => r.tool_name !== "agent-run").length;
        const done = (rows ?? []).find((r) =>
          r.tool_name === "agent-run" && ["success", "failed"].includes(r.status) &&
          !seen.has(r.id as string) && (r.tool_output as Record<string, unknown>)?.continued !== true);
        if (done) { leg = (done.tool_output ?? {}) as Record<string, unknown>; status = done.status as string; break; }
        console.log(`      ${label} r${round}: ${Math.round((Date.now() - started) / 1000)}s — ${steps} steps`);
      }
      if (!leg) throw new Error(`${label}: timed out`);
      if (status === "failed") throw new Error(`${label} failed: ${String(leg.error ?? "").slice(0, 200)}`);

      text = String(leg.final_text ?? "");
      const pending = leg.pending_question as
        | { questions: Array<{ header: string; question: string; options?: Array<{ label: string }> }> } | null;
      if (!pending?.questions?.length) return { finalText: text, steps };

      console.log(`      ${label} asked ${pending.questions.length}: ${pending.questions.map((q) => q.header).join(", ")}`);
      next = "Answers to your questions:\n" +
        pending.questions.map((q) => `- ${q.header}: ${q.options?.[0]?.label ?? "(skipped — decide for me)"}`).join("\n") +
        "\n\nGo ahead.";
    }
    return { finalText: text, steps };
  }

  // ══ 1. Debugging: a failing test and no explanation of why.
  console.log("      ── round 1: fix the failing test ──\n");
  const fix = await turn("fix",
    "The test suite in this project is failing. Find out why and fix it. " +
    "Do not change the tests — they describe the behaviour I want.");

  const afterFix = await readProject();
  const fixResult = await runTests(afterFix);
  console.log(`\n      ${fixResult.output.trim().split("\n").slice(-3).join(" | ")}\n`);

  check("the tests pass after the fix", fixResult.ok, fixResult.output.slice(-700));
  check("it changed the code, not the tests",
    afterFix["tests/test_store.py"] === SEED["tests/test_store.py"],
    "the failing test was edited away rather than the bug fixed");
  check("it fixed the right file",
    afterFix["inventory/store.py"] !== SEED["inventory/store.py"], "store.py is untouched");
  check("it left the unrelated module alone",
    afterFix["inventory/pricing.py"] === SEED["inventory/pricing.py"],
    "pricing.py was correct and had passing tests — editing it is collateral damage");
  // Was `steps > 3`, which is true of almost any run and therefore proved
  // nothing. What it should ask is whether a command was actually run that
  // executed the suite — the difference between checking the work and
  // describing it.
  const { data: ranCommands } = await admin
    .from("agent_tasks").select("tool_input")
    .eq("session_id", sessionId!).eq("tool_name", "bash");
  const commands = (ranCommands ?? []).map((r) => JSON.stringify(r.tool_input ?? {}));
  check(
    `it ran the suite itself rather than guessing (${commands.length} commands)`,
    commands.some((c) => /unittest|pytest|python -m|\btest\b/i.test(c)),
    commands.slice(0, 6),
  );

  // ══ 2. Coming back for a second change, on the same session.
  console.log("      ── round 2: add a feature to what it just fixed ──\n");
  const feature = await turn("feature",
    "Now add a `low_stock(threshold)` method to Store. It returns the list of SKUs " +
    "whose stock is at or below the threshold, sorted alphabetically. Add tests for it.");

  const afterFeature = await readProject();
  const featureResult = await runTests(afterFeature);
  console.log(`\n      ${featureResult.output.trim().split("\n").slice(-3).join(" | ")}\n`);

  check("the whole suite still passes", featureResult.ok, featureResult.output.slice(-700));
  check("the method exists", /def\s+low_stock\s*\(/.test(afterFeature["inventory/store.py"] ?? ""),
    Object.keys(afterFeature));
  check("the earlier fix survived the second change",
    !/self\._items\[sku\]\s*=\s*quantity\s*$/m.test(afterFeature["inventory/store.py"] ?? ""),
    "restock went back to overwriting");
  check("it wrote tests for the new method",
    Object.entries(afterFeature).some(([n, c]) => n.startsWith("tests/") && /low_stock/.test(c)),
    Object.keys(afterFeature).filter((n) => n.startsWith("tests/")));

  // Behaviour, not just presence: the method has to actually be right.
  const behaviour = await runTests({
    ...afterFeature,
    "tests/test_low_stock_contract.py": [
      "import unittest",
      "",
      "from inventory import Store",
      "",
      "",
      "class LowStockContract(unittest.TestCase):",
      "    def test_at_or_below_threshold_sorted(self):",
      "        store = Store()",
      '        store.restock("pear", 2)',
      '        store.restock("apple", 1)',
      '        store.restock("plum", 9)',
      '        self.assertEqual(store.low_stock(2), ["apple", "pear"])',
      "",
      "    def test_empty_when_all_well_stocked(self):",
      "        store = Store()",
      '        store.restock("apple", 50)',
      "        self.assertEqual(store.low_stock(2), [])",
      "",
    ].join("\n"),
  });
  check("low_stock actually behaves as described", behaviour.ok, behaviour.output.slice(-700));

  console.log(`\n      files now: ${Object.keys(afterFeature).sort().join(", ")}\n`);
  console.log(`      round 2 message: ${feature.finalText.slice(0, 300).replace(/\n/g, " ")}\n`);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
