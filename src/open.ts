import { spawn } from "node:child_process"

// Opens a URL in the default browser; failing to is not an error, the URL is printed anyway.
export function openUrl(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]]
  try {
    spawn(command, args, { stdio: "ignore", detached: true })
      .on("error", () => {})
      .unref()
  } catch {
    // No browser opener on this machine.
  }
}
