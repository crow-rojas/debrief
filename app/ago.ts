// "12 minutes ago", "in 3 hours": the distance from now to iso, in the largest unit that fits.
export function ago(iso: string, locale: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute")
  if (Math.abs(minutes) < 60 * 24) return format.format(Math.round(minutes / 60), "hour")
  return format.format(Math.round(minutes / 1440), "day")
}
