import { randomBytes, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { home, homePath } from "../paths.ts"

// The pairing token: 32 random bytes, created once, readable only by the user.
export function ensureToken(): string {
  const file = homePath("token")
  if (existsSync(file)) return readFileSync(file, "utf8").trim()
  mkdirSync(home(), { recursive: true })
  const token = randomBytes(32).toString("base64url")
  writeFileSync(file, token, { mode: 0o600 })
  return token
}

export function sameToken(given: string | undefined, token: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}
