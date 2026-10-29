import { chmodSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { homePath } from "./paths.ts"

// Each entry moves the schema one version up; never edit one that has shipped, add the next.
const MIGRATIONS = [
  `CREATE TABLE turns (
     id INTEGER PRIMARY KEY,
     agent TEXT NOT NULL, session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
     worktree TEXT NOT NULL, common_dir TEXT NOT NULL, slug TEXT NOT NULL,
     ended_at TEXT NOT NULL, status TEXT NOT NULL,
     state TEXT NOT NULL CHECK (state IN ('queued', 'generated', 'expired', 'skipped', 'failed')),
     attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, event_json TEXT NOT NULL,
     UNIQUE (agent, session_id, turn_id)
   );
   CREATE TABLE reader_offsets (
     reader_id TEXT NOT NULL, file TEXT NOT NULL, offset INTEGER NOT NULL,
     PRIMARY KEY (reader_id, file)
   );
   CREATE TABLE snapshots (worktree TEXT PRIMARY KEY, tree TEXT NOT NULL, taken_at TEXT NOT NULL);
   CREATE TABLE cards (
     id INTEGER PRIMARY KEY, turn_id INTEGER NOT NULL REFERENCES turns (id),
     kind TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
     state TEXT NOT NULL CHECK (state IN ('active', 'discarded')),
     fsrs_json TEXT, due TEXT
   );
   CREATE TABLE reviews (
     review_id TEXT PRIMARY KEY, card_id INTEGER NOT NULL REFERENCES cards (id),
     rating TEXT NOT NULL, answered_at TEXT NOT NULL
   );
   CREATE TABLE flags (
     card_id INTEGER NOT NULL REFERENCES cards (id), note TEXT, action TEXT NOT NULL,
     created_at TEXT NOT NULL
   );`,
  `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
]

export function openDb(file = homePath("ownship.db")): DatabaseSync {
  // The database holds raw diffs and prompts: nobody else on the machine may read it.
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  chmodSync(dirname(file), 0o700)
  const db = new DatabaseSync(file)
  chmodSync(file, 0o600)
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number
  }
  for (const [index, sql] of MIGRATIONS.entries()) {
    if (index < version) continue
    db.exec("BEGIN")
    db.exec(sql)
    db.exec(`PRAGMA user_version = ${index + 1}`)
    db.exec("COMMIT")
  }
  return db
}
