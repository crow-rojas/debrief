// Cards set aside with "Not now", by id with their repo slug. They stay due on the server and
// come back on the next page visit.
export const skipped = new Map<number, string>()

// How many skipped cards belong to repo, or to any repo when repo is not given.
export const skippedIn = (repo?: string) =>
  [...skipped.values()].filter((slug) => !repo || slug === repo).length
