/**
 * Readiness detection for the `dsh web` child process. The web runtime prints
 * one URL line after its Loader tree settles (`printUrl` in
 * `@deepseek-ai/dsh-web-app`), and that line is the documented supervisor
 * readiness signal: the server binds before it prints, so observing the line
 * means the page and its `/api` routes are servable.
 * @module @deepseek-ai/dsh-desktop/readiness
 */

/** The exact prefix the web runtime's URL line starts with. */
const READY_PREFIX = 'dsh web: '

/**
 * Extract the served URL from one `dsh web` output line.
 * @param line - one stdout line from the child process.
 * @returns the URL the line reports, or undefined when the line is not the
 * readiness line. The optional `(LAN: …)` suffix never rides along: only the
 * first whitespace-delimited token after the prefix is a candidate, and a
 * token that does not parse as an http(s) URL is rejected rather than guessed.
 */
export function parseReadyUrl(line: string): URL | undefined {
  const prefixAt = line.indexOf(READY_PREFIX)
  if (prefixAt === -1) return undefined
  const candidate = line.slice(prefixAt + READY_PREFIX.length).trim().split(/\s+/)[0] ?? ''
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return undefined
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
}
