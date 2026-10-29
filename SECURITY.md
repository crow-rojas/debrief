# Security policy

## Supported versions

Only the latest release and `main` are supported. Fixes land on `main` and ship in the next release; there are no backports.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories: open the [Security tab](https://github.com/crow-rojas/debrief/security) and click **Report a vulnerability**. Don't open a public issue. You'll get an answer as soon as possible, and credit in the fix if you want it.

## Scope

ownship runs a local daemon that reads your agents' session logs and serves cards about your code, so these are in scope:

- The daemon's API: reaching it without the pairing token, CSRF, path traversal out of the app's static files, or a request that crashes it.
- Pairing: the token leaking (in logs, URLs or cookies without the right flags), or the daemon becoming reachable beyond `127.0.0.1`, the user's tailnet or, after an explicit LAN pairing, the local network.
- Data leaving the machine: anything beyond the filtered turn reaching the generator, secrets passing the filter, or anything other than cards and their snippets reaching the phone.
- The working tree: a snapshot touching the user's git index, stash, branches or files.
- Agent configuration: `init` or `uninstall` breaking or removing hooks that are not ownship's, or ownship reading an agent's auth files.
- Files under `~/.ownship` readable by other users of the machine.

Vulnerabilities in Claude Code, Codex, Tailscale, Node or another dependency belong to that project; report them upstream. Reports that need an attacker who already runs code as your user are out of scope, since that attacker can read your agents' logs directly.
