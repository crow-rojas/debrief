import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs"

// A ts-fsrs Card as stored in SQLite: dates as ISO strings.
export type FsrsState = Omit<Card, "due" | "last_review"> & { due: string; last_review?: string }

const scheduler = fsrs()

export function schedule(state: FsrsState | null, rating: "again" | "good", now: Date): FsrsState {
  const card: Card = state
    ? {
        ...state,
        due: new Date(state.due),
        last_review: state.last_review ? new Date(state.last_review) : undefined,
      }
    : createEmptyCard(now)
  const next = scheduler.next(card, now, rating === "good" ? Rating.Good : Rating.Again).card
  return { ...next, due: next.due.toISOString(), last_review: next.last_review?.toISOString() }
}
