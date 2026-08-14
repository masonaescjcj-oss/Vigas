# NOTICE

This project (**Issac**) is an independent work. It includes original code and
documentation authored for this project.

## Architectural attribution

Some *architectural patterns* in Issac's coding-agent layer — plan-first
execution, a small orthogonal tool surface, an anchored search/replace edit
primitive, a structured multi-file patch envelope, and worktree-isolated
parallel subagents — were **inspired by**, and adapted from the design of, the
following Apache-2.0 licensed open-source projects:

- **Grok Build** — `xai-org/grok-build`, licensed under the Apache License,
  Version 2.0. Issac studied its public architecture (agent prompt structure,
  tool schemas, and workspace/checkpoint model) and re-implemented equivalent
  *logic* in TypeScript. No source code was copied; the original is written in
  Rust and Issac shares none of it.

- **OpenAI Codex** `apply_patch` format — the `*** Begin Patch` / `*** End Patch`
  envelope grammar used by Issac's `apply_patch` tool is a re-implementation of
  the Codex patch format (Apache License, Version 2.0). The parser and applier in
  `src/core/agent/toolRegistry.ts` were written independently from that public
  format specification.

Attribution here is provided in the spirit of, and to comply with, the
attribution provisions of the Apache License, Version 2.0. This NOTICE does not
imply endorsement by, or affiliation with, the original authors or their
organizations.

## What was deliberately excluded

For security and privacy reasons, Issac does **not** port and does not contain,
in any form (including disabled, commented-out, or feature-flagged variants):

- any logic that uploads the user's repository, git history, or session state to
  a third-party bucket or service (e.g. the `upload/gcs` and `upload/trace`
  paths of the referenced project);
- any `session_state_upload`-style automatic telemetry of user files.

Issac never exfiltrates workspace contents. See
`docs/grok-build-port-analysis.md` for details.

## License references

- Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0
