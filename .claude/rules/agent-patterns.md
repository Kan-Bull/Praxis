# Background Agent Limitations

- Background agents (`run_in_background: true`) CANNOT get interactive permission approval for Write/Edit/Bash tools
- This is already noted in build.md but applies broadly: never delegate file-writing work to background agents
- For multi-file edit tasks, apply edits directly from the orchestrator after agents provide the change specifications
- Agents CAN read files in background mode — use them for analysis/research only
