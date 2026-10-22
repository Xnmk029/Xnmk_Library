# Migration note

- Collected from sandbox run `20260922-004753-VoxelLujiazui`
- source project: `L3_Advanced/VoxelLujiazui`
- protocol: `2.0` (bare)
- workdir: `F:\bench-runs\grok-4.7\20260922-004753-VoxelLujiazui`
- prompt_sha256: `dfed9c93685058b2432df1ba3d36dfbe3f0e4e6aff8af82fc720e0e9bc4ee38e`
- collected_at: 2026-09-22T04:38:37+0800
- primary_deliverable: `index.html`
- deliverable_map: `{'index.html': 'answer.html', 'README.md': 'README.md'}`
- review_scope: `project_prompt_only`
- verdict: `PASS`
- caveat (orchestrator): execution_status=process_error (Windows 0xC0000409 fast-fail after 2934s). The 84134-byte deliverable was already written and is structurally complete (ends with </body></html>); stdout/stderr trace was lost because --output-format json flushes only at process exit. Adopted by explicit human decision over the 3rd attempt (20260922-023309, timeout + 962-file browser-profile pollution).
