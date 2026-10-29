// A repo's slug without its "-xxxxxxxx" hash suffix.
export const repoName = (slug: string) => slug.replace(/-[0-9a-f]{8}$/, "")
