import { describe, it, expect } from "vitest";
import { planToolBatches } from "../toolBatching.ts";

function call(name: string, input: Record<string, unknown> = {}) {
  return { id: `${name}-${JSON.stringify(input)}`, name, input };
}

/** Flatten batches back to a call order, to check nothing was lost or moved. */
function order(batches: ReturnType<typeof planToolBatches>) {
  return batches.flat().map((c) => c.id);
}

describe("planToolBatches", () => {
  it("runs writes to different files together", () => {
    // The case that made large builds slow: nine independent files, written
    // one round trip at a time. There is no order between them.
    const calls = ["a", "b", "c", "d"].map((n) => call("write", { file_path: `${n}.html`, contents: "x" }));
    const batches = planToolBatches(calls);

    expect(batches.length).toBe(1);
    expect(batches[0].length).toBe(4);
  });

  it("keeps two writes to the same file apart", () => {
    const calls = [
      call("write", { file_path: "index.html", contents: "first" }),
      call("write", { file_path: "index.html", contents: "second" }),
    ];
    const batches = planToolBatches(calls);

    // Racing these would leave whichever landed last, which is luck.
    expect(batches.length).toBe(2);
  });

  it("keeps a read of a file the same round writes", () => {
    // The model wrote it and then read it back; that ordering was intended.
    const batches = planToolBatches([
      call("write", { file_path: "app.js", contents: "x" }),
      call("read", { file_path: "app.js" }),
    ]);
    expect(batches.length).toBe(2);
  });

  it("lets a read and an unrelated write share a batch", () => {
    const batches = planToolBatches([
      call("read", { file_path: "styles.css" }),
      call("write", { file_path: "app.js", contents: "x" }),
    ]);
    expect(batches.length).toBe(1);
  });

  it("does not run a tree-wide search alongside a write", () => {
    // Whether grep sees the new file would be down to timing.
    expect(planToolBatches([
      call("grep_files", { pattern: "foo" }),
      call("write", { file_path: "new.ts", contents: "x" }),
    ]).length).toBe(2);

    expect(planToolBatches([
      call("write", { file_path: "new.ts", contents: "x" }),
      call("glob", { pattern: "**/*.ts" }),
    ]).length).toBe(2);
  });

  it("runs several searches together", () => {
    const batches = planToolBatches([
      call("glob", { pattern: "**/*.ts" }),
      call("grep_files", { pattern: "TODO" }),
      call("list_dir", { file_path: "src" }),
      call("read", { file_path: "README.md" }),
    ]);
    expect(batches.length).toBe(1);
  });

  it("gives bash a batch to itself", () => {
    // It can do anything, including to files another call in the round touches.
    const batches = planToolBatches([
      call("read", { file_path: "a.txt" }),
      call("bash", { command: "npm install" }),
      call("read", { file_path: "b.txt" }),
    ]);
    expect(batches.length).toBe(3);
    expect(batches[1][0].name).toBe("bash");
  });

  it("gives apply_patch a batch to itself", () => {
    // One envelope can add, edit, delete and move several files. Working out
    // which would mean parsing the patch in a second place.
    const batches = planToolBatches([
      call("apply_patch", { patch: "*** Begin Patch\n*** End Patch" }),
      call("write", { file_path: "other.txt", contents: "x" }),
    ]);
    expect(batches.length).toBe(2);
  });

  it("runs control-flow tools alone", () => {
    // These mutate state the whole round shares — plan mode, the todo list,
    // a pending question.
    for (const name of ["enter_plan_mode", "exit_plan_mode", "todo_write", "ask_user", "task"]) {
      const batches = planToolBatches([
        call("read", { file_path: "a.txt" }),
        call(name, {}),
      ]);
      expect(batches.length, name).toBe(2);
    }
  });

  it("runs an unrecognised tool alone", () => {
    // Anything added later is unknown until someone classifies it here, and
    // guessing wrong corrupts a file silently.
    const batches = planToolBatches([
      call("read", { file_path: "a.txt" }),
      call("some_future_tool", { whatever: 1 }),
      call("read", { file_path: "b.txt" }),
    ]);
    expect(batches.length).toBe(3);
  });

  it("treats a write with no usable path as unbounded", () => {
    const batches = planToolBatches([
      call("write", { contents: "x" }),
      call("write", { file_path: "b.txt", contents: "x" }),
    ]);
    expect(batches.length).toBe(2);
  });

  it("never loses or reorders a call", () => {
    const calls = [
      call("read", { file_path: "a.txt" }),
      call("write", { file_path: "b.txt", contents: "x" }),
      call("bash", { command: "ls" }),
      call("write", { file_path: "c.txt", contents: "x" }),
      call("write", { file_path: "c.txt", contents: "y" }),
      call("glob", { pattern: "**" }),
    ];
    const batches = planToolBatches(calls);
    expect(order(batches)).toEqual(calls.map((c) => c.id));
  });

  it("caps how many run at once", () => {
    // Each is a round trip to storage; a burst gets rate-limited by the very
    // backend the files live in.
    const calls = Array.from({ length: 20 }, (_, i) =>
      call("write", { file_path: `f${i}.txt`, contents: "x" }));
    const batches = planToolBatches(calls);

    expect(batches.every((b) => b.length <= 6)).toBe(true);
    expect(batches.flat().length).toBe(20);
  });

  it("handles an empty round", () => {
    expect(planToolBatches([])).toEqual([]);
  });
});
