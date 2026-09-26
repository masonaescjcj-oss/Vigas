/**
 * The shapes below are copied from real Agents API replies (2026-09-26), so
 * these tests fail if the adapter stops understanding what You.com actually
 * sends — not a guess at it.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readOutput, tidyAnswer, toYoucomInput } from "../shared/youcomFormat.ts";

Deno.test("one question goes as a plain string", () => {
  assertEquals(toYoucomInput([{ role: "user", content: "hi" }]), "hi");
});

Deno.test("a conversation maps assistant to agent — the API rejects 'assistant'", () => {
  assertEquals(
    toYoucomInput([
      { role: "user", content: "My name is Sara." },
      { role: "assistant", content: "Nice to meet you, Sara." },
      { role: "user", content: "What is my name?" },
    ]),
    [
      { role: "user", content: "My name is Sara." },
      { role: "agent", content: "Nice to meet you, Sara." },
      { role: "user", content: "What is my name?" },
    ],
  );
});

Deno.test("reads the answer and the search results out of a real reply", () => {
  const output = [
    {
      type: "web_search.results",
      content: [
        { source_type: "web_search", citation_uri: "https://www.espn.com/f1/", title: "Formula 1 on ESPN", url: "https://www.espn.com/f1/" },
        { source_type: "web_search", title: "No link" },
      ],
    },
    { type: "message.answer", text: "Russell took pole [[1]](https://www.espn.com/f1/)." },
  ];
  assertEquals(readOutput(output), {
    text: "Russell took pole [[1]](https://www.espn.com/f1/).",
    results: [{ url: "https://www.espn.com/f1/", title: "Formula 1 on ESPN" }],
  });
});

Deno.test("an unknown output kind is ignored, not fatal", () => {
  assertEquals(readOutput([{ type: "something.new", foo: 1 }, { type: "message.answer", text: "pong" }]).text, "pong");
  assertEquals(readOutput(undefined), { text: "", results: [] });
  assertEquals(readOutput([{}]).text, "");
});

Deno.test("citations become [n] with a titled source list", () => {
  const { text, sources } = tidyAnswer(
    "#### Winner\n\nRussell took pole [[1]](https://www.autosport.com/f1/) [[2]](https://www.bbc.com/sport/formula1).",
    [{ url: "https://www.autosport.com/f1/", title: "Autosport F1" }],
  );
  assertEquals(
    text,
    "**Winner**\n\nRussell took pole [1] [2].\n\n**Sources**\n[1] Autosport F1 — autosport.com\n[2] bbc.com",
  );
  assertEquals(sources.map((s) => s.n), [1, 2]);
});

Deno.test("the same source cited twice is listed once", () => {
  const { text } = tidyAnswer("A [[1]](https://a.com/x) and again [[1]](https://a.com/x).");
  assertEquals(text, "A [1] and again [1].\n\n**Sources**\n[1] a.com");
});

Deno.test("an ordinary link keeps its words", () => {
  assertEquals(tidyAnswer("See [the docs](https://you.com/docs) for more.").text, "See the docs for more.");
});

Deno.test("an answer with no citations gets no source list", () => {
  assertEquals(tidyAnswer("تهران").text, "تهران");
});
