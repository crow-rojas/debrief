import { homedir } from "node:os"
import { join } from "node:path"

// Read on every call so tests (and users) can point OWNSHIP_HOME elsewhere.
export function home(): string {
  return process.env.OWNSHIP_HOME ?? join(homedir(), ".ownship")
}

export function homePath(...parts: string[]): string {
  return join(home(), ...parts)
}
