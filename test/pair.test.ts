import { describe, expect, it } from "vitest"
import { choosePairing, type PairingProbe } from "../src/pair.ts"

function probe(tailscale: { dnsName: string } | null, lanIp: string | null) {
  const commands: string[] = []
  const p: PairingProbe = {
    tailscale: async () => tailscale,
    lanIp: () => lanIp,
    serve: async (port) => {
      commands.push(`tailscale serve --bg ${port}`)
    },
  }
  return { p, commands }
}

describe("pairing", () => {
  it("prefers Tailscale when it is running", async () => {
    const { p, commands } = probe({ dnsName: "mac.tail123.ts.net." }, "192.168.1.20")
    const choice = await choosePairing(p, 47821)
    expect(choice).toEqual({ via: "tailscale", url: "https://mac.tail123.ts.net" })
    expect(commands).toEqual(["tailscale serve --bg 47821"])
  })

  it("falls back to LAN with a warning", async () => {
    const { p } = probe(null, "192.168.1.20")
    const choice = await choosePairing(p, 47821)
    expect(choice).toMatchObject({ via: "lan", url: "http://192.168.1.20:47821" })
    expect(choice?.warning).toBe("cli.lanWarning")
  })

  it("never calls funnel", async () => {
    const { p, commands } = probe({ dnsName: "mac.ts.net." }, null)
    await choosePairing(p, 1)
    expect(commands.join(" ")).not.toContain("funnel")
  })

  it("returns null with nothing to pair over", async () => {
    const { p } = probe(null, null)
    expect(await choosePairing(p, 1)).toBeNull()
  })
})
