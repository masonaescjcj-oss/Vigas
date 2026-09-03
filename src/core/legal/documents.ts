/**
 * core/legal/documents.ts
 * ---------------------------------------------------------------------------
 * The privacy policy and terms, once.
 *
 * They were written into the JSX of two screens. Google Play needs the policy
 * at a public URL a reviewer can open without installing anything, so a second
 * copy had to exist somewhere — and two copies of a legal document drift, with
 * nobody noticing which one is true. This is the source; the screens render it
 * and the web build renders it to static HTML.
 *
 * The previous text was also incomplete in a way that matters. It said project
 * code goes to an isolated sandbox, which is true, and stopped there — leaving
 * out that prompts and the code around them are sent to a third-party model
 * provider. That is the single most significant thing this product does with
 * someone's data, and Play's data-safety form asks about it directly.
 * ---------------------------------------------------------------------------
 */

export interface LegalSection {
  heading: string;
  /** Paragraphs and bullet lines. A line starting with "- " renders as a bullet. */
  body: string[];
}

export interface LegalDocument {
  title: string;
  /** Shown under the title so a reader knows how current it is. */
  updated: string;
  intro: string;
  sections: LegalSection[];
}

/** Where to reach a human. Play requires a working contact on the listing. */
export const SUPPORT_EMAIL = "support@retrobuild.space";

export const LAST_UPDATED = "29 August 2026";

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  updated: LAST_UPDATED,
  intro:
    "Retro Code turns what you describe into working software. This explains what we " +
    "collect to do that, who else sees it, and how to get rid of it.",
  sections: [
    {
      heading: "What we collect",
      body: [
        "- **Your account.** An email address and a password you choose. The password is stored hashed by our authentication provider; we never see it.",
        "- **Your projects.** The files the agent writes for you, and the conversation that produced them.",
        "- **Usage counts.** How many builds and messages you have sent, and roughly how many tokens they cost. Counts only — never the content of a message.",
        "- **Which features you use.** The name of an action you took — a build started, a project exported — with your account, your platform and the app version. The list of what may be recorded is fixed in the app; a value that is not on it is discarded rather than sent.",
        "- **A notification token,** if you turn notifications on. It identifies the device, not you, and it is removed when you turn them off or delete your account.",
        "- **Server error reports.** When something fails on our side, the failure and the request that caused it are recorded so it can be fixed. The app itself does not send crash reports.",
      ],
    },
    {
      heading: "Who else sees it",
      body: [
        "This is the part worth reading carefully.",
        "- **An AI model provider.** To answer you at all, your prompt and the parts of your project the agent is working on are sent to a third-party model provider over an encrypted connection. We do not control their retention. If that is not acceptable for a particular piece of work, do not put it in a prompt.",
        "- **Our hosting and database provider.** Your account and project files are stored there.",
        "- **Nobody else.** We do not sell your data, and we do not use your projects to train models.",
      ],
    },
    {
      heading: "Where your code runs",
      body: [
        "When the agent runs a command, it does so in an isolated sandbox created for that run and destroyed when the run ends. The sandbox cannot read other users' projects, and it is not given the keys our own servers hold.",
        "Files the agent writes are saved to your project, which only your account can read.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "Projects and conversations are kept until you delete them or delete your account.",
        "Usage counts are pruned after seven days; they exist only to enforce the allowance.",
        "Feature-use records and server error reports are kept while they are still useful for finding problems, and are not used to build a profile of you.",
      ],
    },
    {
      heading: "Deleting your data",
      body: [
        "You can delete your account from Settings, under Account. This removes your profile, your projects and their files, and your conversations. It cannot be undone.",
        `If you would rather ask us to do it, write to ${SUPPORT_EMAIL} from the address on the account.`,
      ],
    },
    {
      heading: "Children",
      body: [
        "Retro Code is not directed at children under 13, and we do not knowingly collect their information.",
      ],
    },
    {
      heading: "Changes and contact",
      body: [
        "If this policy changes in a way that affects you, the app will say so rather than quietly replacing the text.",
        `Questions: ${SUPPORT_EMAIL}`,
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: "Terms of Service",
  updated: LAST_UPDATED,
  intro: "The short version: use it for lawful work, the output is yours, and it comes without a warranty.",
  sections: [
    {
      heading: "Your account",
      body: [
        "You need an account, and you are responsible for what happens under it. Tell us if you think someone else has access.",
        "One person, one account. Do not share credentials.",
      ],
    },
    {
      heading: "What you build is yours",
      body: [
        "You own the code the agent writes for you, and you are responsible for it — including checking that it works and that it is safe to publish before you rely on it.",
        "Generated code is not reviewed by us. Treat it the way you would treat code from any other source you did not write.",
      ],
    },
    {
      heading: "Fair use",
      body: [
        "The service is free, with a limit on how many builds and messages you can send in a period. The limit is there so one person cannot exhaust it for everyone.",
        "Do not use Retro Code to build malware, to attack systems you do not own, to infringe copyright, or for anything unlawful. Do not attempt to work around the limits or extract our keys.",
      ],
    },
    {
      heading: "Availability",
      body: [
        "This is a young product. It may be unavailable, it may lose a build, and it depends on a model provider we do not control.",
        "It is provided as is, without warranty. Keep your own copy of anything you would mind losing — every project can be downloaded as a zip.",
      ],
    },
    {
      heading: "Ending it",
      body: [
        "You can delete your account whenever you like.",
        "We may suspend an account that is breaking these terms or putting the service at risk for others.",
      ],
    },
    {
      heading: "Contact",
      body: [`${SUPPORT_EMAIL}`],
    },
  ],
};

/** One piece of a line: plain text, or text that should be emphasised. */
export interface RichSpan {
  text: string;
  bold: boolean;
}

/**
 * Split a document line into spans.
 *
 * `**bold**` is the only markup these documents use, and it is interpreted in
 * three places — the in-app screen, the generated HTML, and any future export.
 * One definition, so they cannot disagree about what a line means.
 */
export function splitRich(line: string): RichSpan[] {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part.length > 0)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

/** True for a line the reader should see as a bullet. */
export function isBullet(line: string): boolean {
  return line.startsWith("- ");
}

/** A bullet line without its marker; any other line unchanged. */
export function bulletText(line: string): string {
  return isBullet(line) ? line.slice(2) : line;
}
