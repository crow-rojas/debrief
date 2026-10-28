import { execFile } from "node:child_process"
import { networkInterfaces } from "node:os"
import { promisify } from "node:util"

const run = promisify(execFile)

export type PairingProbe = {
  tailscale(): Promise<{ dnsName: string } | null>
  lanIp(): string | null
  serve(port: number): Promise<void>
}

export type Pairing = { via: "tailscale" | "lan"; url: string; warning?: string }

// Tailscale first (HTTPS inside the tailnet); otherwise the LAN over plain HTTP, with a warning.
// Never `tailscale funnel`: that would put the daemon on the public internet.
export async function choosePairing(probe: PairingProbe, port: number): Promise<Pairing | null> {
  const tailscale = await probe.tailscale()
  if (tailscale) {
    await probe.serve(port)
    return { via: "tailscale", url: `https://${tailscale.dnsName.replace(/\.$/, "")}` }
  }
  const ip = probe.lanIp()
  return ip ? { via: "lan", url: `http://${ip}:${port}`, warning: "cli.lanWarning" } : null
}

export const systemProbe: PairingProbe = {
  async tailscale() {
    try {
      const { stdout } = await run("tailscale", ["status", "--json"])
      const status = JSON.parse(stdout) as { BackendState?: string; Self?: { DNSName?: string } }
      return status.BackendState === "Running" && status.Self?.DNSName
        ? { dnsName: status.Self.DNSName }
        : null
    } catch {
      return null
    }
  },
  lanIp() {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const a of addresses ?? []) {
        if (
          a.family === "IPv4" &&
          !a.internal &&
          /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)
        ) {
          return a.address
        }
      }
    }
    return null
  },
  async serve(port) {
    await run("tailscale", ["serve", "--bg", String(port)])
  },
}
