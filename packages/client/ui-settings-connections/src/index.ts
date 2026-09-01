/**
 * Connections settings surface, node half. The empty apply exists so the
 * plugin appears in the host cordis.yml / Loader; the browser half owns the
 * Connections section and its SSH hosts card through exports["./client"],
 * discovered from the package.json dsh.client declaration. The `terminal-ssh`
 * namespace itself stays owned by the terminal-ssh Host plugin; this surface
 * only stages and writes the user-managed roster through the shared settings
 * scope.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
