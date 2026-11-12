/**
 * The one JSON the browser ever reads.
 *
 * Pure on purpose: given a round's outcome, the current settings and the
 * poller's own state, the snapshot is a function — no clock, no I/O, no cache.
 * That is what lets the rules below be tested instead of hoped for.
 *
 * Three outcomes must not be conflated:
 *
 * - **a round succeeded** — new rows, `stale: false`, and `polledAt` moves;
 * - **a round is in flight (or settings changed)** — keep showing what we have,
 *   `failed: false`. Marking this stale would make the panel claim its numbers
 *   may be wrong every time the user toggles a checkbox;
 * - **a round failed** — keep the last good rows and set `stale: true`, because
 *   wiping ten correct rows over a transient hiccup is the worse answer.
 */
export function buildSnapshot({ at, polledAt, rows, failed, settings, poller, previous }) {
  const keepPrevious = rows === null || rows === undefined
  const channels = keepPrevious ? (previous?.channels ?? []) : rows
  const loggedInCount = keepPrevious
    ? (previous?.loggedInCount ?? 0)
    : rows.filter(row => row.loggedIn === true).length
  const succeededAt = typeof polledAt === 'number'
    ? polledAt
    : (typeof previous?.polledAt === 'number' ? previous.polledAt : null)

  return {
    at,
    // `at` is when this JSON was built; `polledAt` is when the numbers in it
    // were actually read. Only the latter means anything to a reader.
    polledAt: succeededAt,
    stale: failed === true && previous !== null && previous !== undefined,
    poller: { ...poller },
    settings: { ...settings },
    channels,
    loggedInCount,
  }
}
