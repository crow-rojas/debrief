# ADR-007: Privacy defaults and phone access

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

ownship handles company code. It must be safe on a work laptop, reachable from the phone, and free.

## Decision

**What never leaves the machine**: the database, the knowledge notes and the session logs. The phone receives only cards and their snippets, never repo files or transcripts.

**What reaches an LLM**: only what the user's own agent receives as generator input, filtered as ADR-004 describes. Research mode, off by default and enabled per repo, is the only way the generator reads more. Every repo is captured by default; an `exclude` list in the config leaves repos out.

**Access**:

- The daemon binds to `127.0.0.1`. Every request needs the pairing token, including on localhost, because `tailscale serve` traffic arrives from `127.0.0.1`.
- `ownship pair` shows a QR with the URL and a long-lived token, kept by the browser in a cookie. Strict CORS and CSRF, and an access log.
- If Tailscale is installed, pairing offers `tailscale serve` first: HTTPS inside the user's tailnet. Otherwise it binds the LAN IP over plain HTTP and warns that it is for trusted networks only.
- Never Tailscale Funnel, Cloudflare Tunnel or ngrok: they expose the daemon or route code through third parties.

**No notifications in v1.** Web push needs HTTPS, an installed PWA on iOS and the vendors' push services; ntfy is the cheap later option.

## Alternatives not taken

- LAN only: plain HTTP on a café network exposes snippets and the token.
- Tailscale only: not everyone has it, and the Personal plan is non-commercial (fine for the owner, whose work allows it).

## Consequences

- Users without Tailscale get a working but weaker default on untrusted networks, and are told so.
- Adding notifications later means adding HTTPS on the LAN path or relying on Tailscale.
