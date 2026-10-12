# TypeSafe / Jev

Use the installed `typesafe-ai` skill when working on TypeSafe integrations and
semantic judgment features in this project. Read its live documentation before
changing API calls or question design. The installed skill is at
`C:/Users/Administrator/.agents/skills/typesafe-ai/SKILL.md`.

Jev uses `https://api.typesafe.ai/v1/systemone` for typed Choice, Score, and Noul
judgments. It is not the Codex conversational model provider.

- Credentials: `TYPESAFE_API_KEY` in the Windows user environment. Never print or
  commit the value. An already-running shell can read the user variable explicitly.
- Model alias: `jev-latest`; retain the actual response model ID and usage in
  benchmark evidence. Pin a version for reproducible comparisons.
- PowerShell helper: `tools/typesafe/invoke-jev.ps1`; use `-ListModels` to list
  models, or `-RequestPath <JSON file>` to evaluate a state and questions.
- Read `tools/typesafe/README.md` for examples. Only send task-relevant content.
