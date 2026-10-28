import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Points OWNSHIP_HOME at a fresh temp directory and returns it.
export function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "ownship-home-"))
  process.env.OWNSHIP_HOME = dir
  return dir
}
