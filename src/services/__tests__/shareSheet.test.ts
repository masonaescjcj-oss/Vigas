/**
 * Getting a link out of the app has three possible mechanisms and none of them
 * are guaranteed to exist. What matters is that a failed mechanism falls through
 * to the next one and that the caller is told which one actually happened — the
 * difference between "sent" and "copied" is the difference between the right
 * message and a confusing one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Share: { share: vi.fn() },
}));

const URL = "https://example.supabase.co/storage/v1/object/public/shared-apps/abcdefghj.html";

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

const original = globalThis.navigator;
afterEach(() => {
  setNavigator(original);
  vi.resetModules();
});

async function load() {
  return (await import("../shareSheet")).shareLink;
}

describe("shareLink on web", () => {
  it("uses the Web Share API when it exists", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    expect(await (await load())(URL, "My app")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ url: URL, title: "My app" });
  });

  it("falls through to the clipboard when the share dialog is dismissed", async () => {
    // A dismissed dialog throws AbortError, which is indistinguishable from a
    // real failure — so it must not be reported as success.
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share: vi.fn().mockRejectedValue(new Error("AbortError")), clipboard: { writeText } });
    expect(await (await load())(URL)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(URL);
  });

  it("uses the clipboard when there is no share API", async () => {
    setNavigator({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await (await load())(URL)).toBe("copied");
  });

  it("reports manual when the clipboard is refused too", async () => {
    // No secure context, or no user gesture left to spend.
    setNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) } });
    expect(await (await load())(URL)).toBe("manual");
  });

  it("reports manual when nothing is available at all", async () => {
    setNavigator({});
    expect(await (await load())(URL)).toBe("manual");
  });

  it("survives navigator being missing entirely", async () => {
    setNavigator(undefined);
    expect(await (await load())(URL)).toBe("manual");
  });

  it("omits the title rather than passing undefined", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    await (await load())(URL);
    expect(share).toHaveBeenCalledWith({ url: URL });
  });
});
