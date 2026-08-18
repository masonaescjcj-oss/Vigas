/**
 * What ends up in the request body, tested directly rather than through the UI.
 *
 * The claims worth pinning down are about *absence*: an untouched request must not
 * grow new fields, and the user's Supabase project must not travel unless they asked
 * for a backend — otherwise their project URL lands in every stored transcript for
 * no reason.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeFunction = vi.fn().mockResolvedValue({});

vi.mock("../functionsClient", () => ({
  invokeFunction,
  API_ORIGIN: "http://localhost:54321",
  IS_LOCAL_API: true,
}));
vi.mock("../supabase", () => ({ supabase: {} }));

const { agentService } = await import("../agentService");

const bodyOf = () => invokeFunction.mock.calls.at(-1)?.[1]?.body as Record<string, unknown>;

describe("startAgentRun body", () => {
  beforeEach(() => invokeFunction.mockClear());

  it("sends nothing extra when nothing was chosen", async () => {
    await agentService.startAgentRun("p1", "build me a page");
    const body = bodyOf();
    expect(body.projectId).toBe("p1");
    expect(body.prompt).toBe("build me a page");
    // Both absent rather than empty: a request from a user who touched neither
    // feature stays exactly as it was before either existed.
    expect("skills" in body).toBe(false);
    expect("backend" in body).toBe(false);
  });

  it('omits the model when it is "auto", since that means "server decides"', async () => {
    await agentService.startAgentRun("p1", "x", { model: "auto" });
    expect("model" in bodyOf()).toBe(false);
  });

  it("sends chosen skills", async () => {
    await agentService.startAgentRun("p1", "x", { skills: ["landing-page"] });
    expect(bodyOf().skills).toEqual(["landing-page"]);
  });

  it("omits an empty skills array rather than sending []", async () => {
    await agentService.startAgentRun("p1", "x", { skills: [] });
    expect("skills" in bodyOf()).toBe(false);
  });

  it("sends the backend when one is supplied", async () => {
    const backend = { url: "https://abc.supabase.co", anonKey: "sb_publishable_x" };
    await agentService.startAgentRun("p1", "x", { skills: ["supabase-backend"], backend });
    expect(bodyOf().backend).toEqual(backend);
  });

  it("omits the backend when it is null", async () => {
    // The caller passes null when the Supabase skill is off, and a project URL in
    // every transcript is a cost with no benefit.
    await agentService.startAgentRun("p1", "x", { skills: ["landing-page"], backend: null });
    expect("backend" in bodyOf()).toBe(false);
  });
});

describe("ask body", () => {
  beforeEach(() => invokeFunction.mockClear());

  it("sends only the prompt for a bare question", async () => {
    await agentService.ask({ prompt: "what is CSS" });
    const body = bodyOf();
    expect(body.prompt).toBe("what is CSS");
    expect("skills" in body).toBe(false);
    expect("projectId" in body).toBe(false);
  });

  it("carries skills into a question too", async () => {
    await agentService.ask({ prompt: "x", skills: ["visual-polish"] });
    expect(bodyOf().skills).toEqual(["visual-polish"]);
  });

  it("does not send a history alongside a stored chat", async () => {
    // The server rejects that combination: a stored chat keeps its own history.
    await agentService.ask({ prompt: "x", projectId: "p1", history: [{ role: "user", content: "old" }] });
    const body = bodyOf();
    expect(body.projectId).toBe("p1");
    expect("history" in body).toBe(false);
  });

  it("sends a capped history for an incognito question", async () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    await agentService.ask({ prompt: "x", history });
    expect((bodyOf().history as unknown[]).length).toBe(20);
    // The most recent turns, not the oldest.
    expect((bodyOf().history as Array<{ content: string }>).at(-1)?.content).toBe("m39");
  });
});
