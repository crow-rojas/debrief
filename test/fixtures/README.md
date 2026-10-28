# Fixtures

Agent session logs used by the reader tests. **Never put private code or real transcripts here.**

Each folder under `claude-code/` and `codex/` is named after the agent version line it was modeled on. The files are synthetic: built by hand, record by record, to match the structure (record types, keys and enum values) of logs that version writes, with toy content only. The structure was read from real logs with a script that printed only record types, keys and enum values, never message text.

To support a new agent version:

1. Print the structure of a recent log, never its contents, for example the record types and keys per line with `python3 -c 'import json,sys; [print(r.get("type"), sorted(r)) for r in map(json.loads, open(sys.argv[1]))]' <file>`.
2. Copy the closest folder to one named after the new version line and adjust the records that changed.
3. Add the version line to the reader's supported range and run its tests.

Files outside a version folder (such as `future-version.jsonl`) are deliberately unsupported versions, used to prove the reader skips them.
