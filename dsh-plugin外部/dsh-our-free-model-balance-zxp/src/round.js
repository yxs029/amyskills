/**
 * One polling round: who is signed in, then how much each of them has left.
 *
 * Two calls, in this order, for a reason. `credits.balances` can only answer a
 * question you ask one channel at a time, so asking all ten costs ten round
 * trips — and for a channel with no account the answer is an empty list, which
 * is indistinguishable from "signed in but reading failed" unless you ask the
 * cheap question first. `provider.status` answers "which of these have an
 * account" for the whole catalogue in one call, so the balance fan-out only
 * covers channels that can actually report something.
 *
 * A single channel failing is normal (one vendor's endpoint down, or a quota
 * that needs a network route this machine does not have). It becomes one
 * `unavailable` row and never fails the round; only a broken discovery call or
 * an unreachable kernel fails the round as a whole.
 */
import { CHANNELS } from './channels.js'
import { normalizeRow } from './balances.js'

/**
 * The channels that have at least one account, from a `provider.status` reply.
 * @param {Record<string, { accounts?: { total?: number } }> | undefined} statuses
 * @returns {string[]} Channel ids in the order the reply listed them.
 */
export function loggedInFromStatuses(statuses) {
  if (statuses === null || statuses === undefined || typeof statuses !== 'object') return []
  const out = []
  for (const [provider, status] of Object.entries(statuses)) {
    const total = status?.accounts?.total
    if (typeof total === 'number' && total > 0) out.push(provider)
  }
  return out
}

/**
 * Read one round of balances.
 * @param {object} options
 * @param {{ call: Function }} options.rpc Kernel RPC caller.
 * @param {readonly string[]} options.catalogue Channel ids to consider.
 * @param {number} options.timeoutMs Per-channel deadline.
 * @param {() => number} [options.now] Clock, for tests.
 * @returns {Promise<{ rows: any[] }>} One normalized row per catalogue channel,
 *   each carrying `loggedIn`.
 */
export async function fetchRound({ rpc, catalogue, timeoutMs, now = () => Date.now() }) {
  const ids = Array.isArray(catalogue) && catalogue.length > 0 ? catalogue : CHANNELS.map(channel => channel.id)

  // The discovery call needs its own deadline too. Without one a hang leaves the
  // poller's round in flight for ever: state stays `polling`, the client re-reads
  // every two seconds, and nothing ever backs off or reports a reason.
  const discovery = new AbortController()
  const discoveryTimer = setTimeout(() => discovery.abort(), timeoutMs)
  let status
  try {
    status = await rpc.call('provider.status', { providers: [...ids] }, discovery.signal)
  } finally {
    clearTimeout(discoveryTimer)
  }
  const loggedIn = new Set(loggedInFromStatuses(status?.value?.statuses))

  const rows = await Promise.all(ids.map(async id => {
    if (!loggedIn.has(id)) {
      // Normalizing an empty account list yields `state: 'empty'`, which the UI
      // treats as "not signed in" — the honest reading of a channel we never
      // queried.
      return { ...normalizeRow(id, { ok: true, value: { accounts: [] } }), loggedIn: false }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const reply = await rpc.call('credits.balances', { provider: id }, controller.signal)
      return { ...normalizeRow(id, reply), loggedIn: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ...normalizeRow(id, { ok: false, error: { message } }), loggedIn: true }
    } finally {
      clearTimeout(timer)
    }
  }))

  return { rows, at: now() }
}
