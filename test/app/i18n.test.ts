import { describe, expect, it } from "vitest"
import en from "../../app/i18n/en.json"
import es from "../../app/i18n/es.json"

const keys = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
    : [prefix]

describe("i18n", () => {
  it("en and es have the same keys", () => {
    expect(keys(es).sort()).toEqual(keys(en).sort())
  })
})
