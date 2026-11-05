# Vigas premium design (v3)

Source files of the design canvas: https://claude.ai/artifact/QrWtt1Wq8pva2r8qE4xmjv

Each `*.dc.html` file is one artboard. Markup uses inline styles plus a small template syntax:
`{{name}}` reads a value from the `renderVals()` method in the `<script data-dc-script>` block at the
bottom of the file, `<sc-for list=… as=…>` repeats, `<sc-if value=…>` shows conditionally, and
`<dc-import name="SiteHeader">` mounts `SiteHeader.dc.html`. The data in `renderVals()` is sample
content from the v2 prototype.

| Website | Android |
|---|---|
| `Main` (home), `Models`, `Chat`, `Leaderboard`, `News`, `Article`, `Tools`, `RetroBuild`, `SiteHeader`, `SiteFooter` | `AndroidHome`, `AndroidChat`, `AndroidRanks`, `AndroidArticle`, `AndroidExplore`, `AndroidWallet` |
