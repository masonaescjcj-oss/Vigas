/**
 * The dialog queue, and the things that must never regress:
 *
 *   - a question that cannot be asked is answered **no**. The old code resolved
 *     `true` when window.confirm was unavailable, so in an embedded browser — or
 *     for any user who had told the browser to stop showing dialogs — "Delete
 *     this file?" deleted the file without asking.
 *   - a multi-choice prompt keeps its choices. window.alert dropped them, and
 *     since long-press was the only route to rename/delete, files could not be
 *     renamed or deleted on web at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// react-native ships Flow sources that vitest cannot parse, and notify.ts
// imports Alert/Platform from it. Only the two members it touches are needed.
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Alert: { alert: vi.fn() },
}));

import {
  type AlertRequest,
  answerAlert,
  DISMISSED,
  hasAlertHost,
  rejectAllAlerts,
  requestAlert,
  resetAlertQueueForTests,
  subscribeToAlerts,
} from "../alertQueue";

/** Stands in for AlertHost: records what it would draw. */
function mountHost() {
  const seen: AlertRequest[][] = [];
  const unsubscribe = subscribeToAlerts((queue) => seen.push(queue));
  return {
    unsubscribe,
    get current() {
      return seen[seen.length - 1] ?? [];
    },
    /** Press a button by its label on the dialog currently showing. */
    press(label: string) {
      const dialog = this.current[0];
      const index = dialog.buttons.findIndex((button) => button.label === label);
      if (index === -1) throw new Error(`no button "${label}" on "${dialog.title}"`);
      answerAlert(dialog.id, index);
    },
  };
}

beforeEach(() => {
  resetAlertQueueForTests();
});

describe("the queue", () => {
  it("reports no host until one subscribes", () => {
    expect(hasAlertHost()).toBe(false);
    const host = mountHost();
    expect(hasAlertHost()).toBe(true);
    host.unsubscribe();
    expect(hasAlertHost()).toBe(false);
  });

  it("hands a request to the host and settles on the index pressed", async () => {
    const host = mountHost();
    const pending = requestAlert({
      title: "Delete?",
      message: "Gone for good.",
      buttons: [{ label: "Cancel" }, { label: "Delete", destructive: true }],
      cancelIndex: 0,
    });

    expect(host.current).toHaveLength(1);
    expect(host.current[0].title).toBe("Delete?");

    host.press("Delete");
    await expect(pending).resolves.toBe(1);
    expect(host.current).toHaveLength(0);
  });

  it("keeps overlapping requests in order instead of losing one", async () => {
    const host = mountHost();
    const first = requestAlert({ title: "Saved", buttons: [{ label: "OK" }] });
    const second = requestAlert({
      title: "Delete?",
      buttons: [{ label: "Cancel" }, { label: "Delete" }],
      cancelIndex: 0,
    });

    // Both are held; the host shows queue[0] and the other waits its turn.
    expect(host.current.map((entry) => entry.title)).toEqual(["Saved", "Delete?"]);

    host.press("OK");
    await expect(first).resolves.toBe(0);
    expect(host.current.map((entry) => entry.title)).toEqual(["Delete?"]);

    host.press("Cancel");
    await expect(second).resolves.toBe(0);
  });

  it("answering a stale id does not settle the question now on screen", async () => {
    const host = mountHost();
    const first = requestAlert({ title: "One", buttons: [{ label: "OK" }] });
    const staleId = host.current[0].id;

    answerAlert(staleId, 0);
    await expect(first).resolves.toBe(0);

    const second = requestAlert({ title: "Two", buttons: [{ label: "OK" }] });
    answerAlert(staleId, 0); // no-op: already gone from the queue
    expect(host.current.map((entry) => entry.title)).toEqual(["Two"]);

    host.press("OK");
    await expect(second).resolves.toBe(0);
  });

  it("refuses everything outstanding when the host goes away", async () => {
    const host = mountHost();
    const pending = requestAlert({
      title: "Delete?",
      buttons: [{ label: "Cancel" }, { label: "Delete" }],
      cancelIndex: 0,
    });
    host.unsubscribe();
    rejectAllAlerts();
    // Not left hanging, and not accepted — it left the screen unanswered.
    await expect(pending).resolves.toBe(DISMISSED);
  });
});

describe("with no host mounted", () => {
  it("refuses a confirm rather than granting it", async () => {
    const { confirmAction } = await import("../notify");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // The regression this guards: a destructive action proceeding unasked.
    await expect(confirmAction("Delete file?", "This cannot be undone.")).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("refuses a choice rather than picking one", async () => {
    const { chooseAction } = await import("../notify");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      chooseAction("file.html", "What next?", [{ label: "Rename" }, { label: "Delete" }]),
    ).resolves.toBeNull();
    warn.mockRestore();
  });

  it("still says something for a plain notification", async () => {
    const { notify } = await import("../notify");
    const alertSpy = vi.fn();
    const previous = (globalThis as { alert?: unknown }).alert;
    (globalThis as { alert?: unknown }).alert = alertSpy;

    notify("Saved", "Two files written.");
    expect(alertSpy).toHaveBeenCalledWith("Saved\n\nTwo files written.");

    (globalThis as { alert?: unknown }).alert = previous;
  });
});

describe("with a host mounted", () => {
  it("draws in-app instead of touching the browser dialog", async () => {
    const { notify, confirmAction } = await import("../notify");
    const host = mountHost();
    const alertSpy = vi.fn();
    const confirmSpy = vi.fn();
    const previousAlert = (globalThis as { alert?: unknown }).alert;
    const previousConfirm = (globalThis as { confirm?: unknown }).confirm;
    (globalThis as { alert?: unknown }).alert = alertSpy;
    (globalThis as { confirm?: unknown }).confirm = confirmSpy;

    notify("Published", "Link copied.");
    const pending = confirmAction("Delete?", "Gone for good.", {
      destructive: true,
      confirmLabel: "Delete",
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(host.current.map((entry) => entry.title)).toEqual(["Published", "Delete?"]);

    host.press("OK");
    // The flag reaches the host, which is what colours the button as dangerous.
    const confirmDialog = host.current[0];
    expect(confirmDialog.buttons[1]).toEqual({ label: "Delete", destructive: true });

    host.press("Delete");
    await expect(pending).resolves.toBe(true);

    (globalThis as { alert?: unknown }).alert = previousAlert;
    (globalThis as { confirm?: unknown }).confirm = previousConfirm;
  });

  it("a confirm is only true for the accept button", async () => {
    const { confirmAction } = await import("../notify");
    const host = mountHost();

    const cancelled = confirmAction("Roll back?", "Files go back.");
    host.press("Cancel");
    await expect(cancelled).resolves.toBe(false);

    // Escape and Android back resolve through cancelIndex, not a button press.
    const dismissed = confirmAction("Roll back?", "Files go back.");
    answerAlert(host.current[0].id, host.current[0].cancelIndex!);
    await expect(dismissed).resolves.toBe(false);
  });

  it("a choice returns the caller's own index, with cancel meaning none", async () => {
    const { chooseAction } = await import("../notify");
    const host = mountHost();

    // Cancel is prepended for display, so the caller's indices must survive it.
    const renamed = chooseAction("index.html", "What next?", [
      { label: "Rename" },
      { label: "Delete", destructive: true },
    ]);
    expect(host.current[0].buttons.map((b) => b.label)).toEqual(["Cancel", "Rename", "Delete"]);
    host.press("Rename");
    await expect(renamed).resolves.toBe(0);

    const deleted = chooseAction("index.html", "What next?", [
      { label: "Rename" },
      { label: "Delete", destructive: true },
    ]);
    host.press("Delete");
    await expect(deleted).resolves.toBe(1);

    const nothing = chooseAction("index.html", "What next?", [{ label: "Rename" }]);
    host.press("Cancel");
    await expect(nothing).resolves.toBeNull();
  });

  it("a file with only one action still offers that action", async () => {
    const { chooseAction } = await import("../notify");
    const host = mountHost();

    // FileTreeItem builds the list from whichever handlers it was given, so a
    // read-only tree must not produce an index that points at nothing.
    const pending = chooseAction("index.html", "What next?", [{ label: "Delete", destructive: true }]);
    expect(host.current[0].buttons.map((b) => b.label)).toEqual(["Cancel", "Delete"]);
    host.press("Delete");
    await expect(pending).resolves.toBe(0);
  });
});
