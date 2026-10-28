import { open } from "node:fs/promises"
import type { AgentName, RawTurn } from "../event.ts"

// offset is where the next read starts: right after the last line that closed a turn, so a turn
// still in progress, or a line still being written, is read again whole next time.
export type ReadResult = {
  turns: RawTurn[]
  offset: number
  skipped: { reason: string; at: number }[]
}

export interface Reader {
  id: AgentName
  version: number
  root(): string
  files(): Promise<string[]>
  read(file: string, offset: number): Promise<ReadResult>
}

export type Line = { text: string; start: number; end: number }

// The complete lines of a buffer that starts at byte offset; a trailing line without "\n" is left out.
export function linesOf(buffer: Buffer, offset = 0): Line[] {
  const lines: Line[] = []
  let start = 0
  for (let nl = buffer.indexOf(10); nl !== -1; nl = buffer.indexOf(10, start)) {
    lines.push({
      text: buffer.toString("utf8", start, nl),
      start: offset + start,
      end: offset + nl + 1,
    })
    start = nl + 1
  }
  return lines
}

// The complete lines of a file from a byte offset.
export async function readLines(file: string, offset: number): Promise<Line[]> {
  const handle = await open(file, "r")
  try {
    const { size } = await handle.stat()
    if (offset >= size) return []
    const buffer = Buffer.alloc(size - offset)
    await handle.read(buffer, 0, buffer.length, offset)
    return linesOf(buffer, offset)
  } finally {
    await handle.close()
  }
}
