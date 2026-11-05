# Vigas

The project owner writes in Persian (Farsi). Reply in Persian. Keep code, identifiers and commit messages in English.

## What Vigas is

One brand on three surfaces, sharing one backend and one user account:

- **Website**: public pages. SEO matters here.
- **Web app**: the logged-in experience in the browser.
- **Android app**

## Product pillars

1. **API gateway**: sell access to many AI models' APIs, exactly like OpenRouter. One OpenAI-compatible endpoint, prepaid credits, API keys, per-token prices, and routing/fallback across providers.
2. **AI leaderboard**: public rankings of AI models and agents. Anyone who wants to see a leaderboard can come to the site.
3. **AI news**: AI news and analysis. Its main job is SEO and organic traffic, and it gives the site real news content.
4. **Tools directory**: showcase AI tools, especially new, trending and well-known ones. It serves SEO and content, and it should be fun for users who want to see what's hot.
5. **RetroBuild**: a section that will be merged with https://retrobuild.space/. In the prototype it is an agent that builds an app from a description, saves a checkpoint for every step, and is billed through the user's Vigas key and credits.
6. **Chatbot**: a strong, built-in chat assistant of Vigas's own on the site. It is not in the prototype yet.

## Design reference

`design/vigas_v2.html` is the v2 clickable prototype. It is a single file of plain HTML, CSS and JS, and all its data is hard-coded mock data.

- Pages: Home, News (with an article reader), Tools (with a detail drawer), Leaderboard, API, RetroBuild.
- A viewer bar on top switches between Desktop, Tablet and Mobile frames and between the Graphite (dark) and Paper (light) themes. The viewer bar is a presentation tool, not part of the product.
- Visual language: tokens live on `.vigas{...}`. Accent orange `#FF6A1A`, sand `#E3B65C` for italic emphasis, serif display headings (Iowan Old Style / Palatino), Inter for body text, JetBrains Mono for numbers and labels. Icons are inline SVG paths in the `ICONS` map. Article covers are generated SVGs, so there are no external images.
- Responsive layout uses container queries on `.app`: ≤1080px tablet, ≤920px compact nav, ≤720px mobile (bottom tab bar, drawers become bottom sheets).
- Known quirks: the viewer bar and `body` use `--background`, `--foreground`, `--border`, `--muted-foreground`, `--card` and `--secondary`, which the file never defines; they came from the tool the prototype was made in. Line 7 loads Tailwind from a gstatic "antigravity" dev URL.

## Notes for building it

- News, Tools and Leaderboard pages need real URLs and server-side or static rendering with proper metadata. The prototype renders everything client-side in one page, which search engines index poorly.
- The prototype already ties RetroBuild to the Vigas API key and credits, so plan for one account and one credit balance across products.

## Status

- The repo holds only this file and the prototype.
- No tech stack has been chosen yet.
