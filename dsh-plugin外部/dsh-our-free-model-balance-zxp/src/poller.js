/**
 * Who polls, and when.
 *
 * Two rules keep this honest.
 *
 * **The timer owns the interval; the heartbeat owns "is anyone looking".** A
 * heartbeat while the timer is running must not refresh on its own — otherwise
 * every open tab becomes a second scheduler and the configured interval means
 * nothing. It refreshes only when what it would show has gone older than
 * `max(idle timeout, interval)`: shorter than the interval polls more often than
 * asked, longer than the idle timeout leaves a returning user reading numbers
 * the poller itself had given up on.
 *
 * **A stopped poller restarts on the next watch, unconditionally.** That is a
 * different branch: once nothing has been watching for the idle timeout the
 * timer is gone, so a watch is the only event that can bring it back. Treating
 * it like the normal path (which would require the data to be stale by
 * `max(ttl, interval)`) leaves the poller dead until then — and with a long
 * interval, that can be minutes of a frozen chip.
 *
 * Everything here takes its clock, its timers and its round-fetcher from the
 * caller, so the whole state machine is testable without waiting on wall time.
 */
import { buildSnapshot } from './snapshot.js'

/** No watch for this long means nobody is looking; polling stops. */
export const WATCH_TTL_MS = 150_000

/** Ceiling for the failure backoff. */
export const MAX_BACKOFF_MS = 600_000

/** @typedef {'stopped'|'idle'|'polling'|'backoff'} PollerState */

/**
 * @param {object} options
 * @param {() => number} options.now
 * @param {(fn: () => void, ms: number) => any} options.setTimer
 * @param {(handle: any) => void} options.clearTimer
 * @param {(signal?: AbortSignal) => Promise<{ rows: any[] }>} options.fetchRound
 * @param {{ autoRefreshSec: number }} options.settings
 */
export function createPoller(options) {
  const { now, setTimer, clearTimer, fetchRound } = options

  let settings = { ...options.settings }
  /** @type {PollerState} */
  let state = 'stopped'
  let delayMs = intervalMs(settings)
  let error = /** @type {string|null} */ (null)
  let lastWatchAt = /** @type {number|undefined} */ (undefined)
  let lastPollAt = /** @type {number|undefined} */ (undefined)
  let lastPolledAt = /** @type {number|null} */ (null)
  let nextPollAt = /** @type {number|undefined} */ (undefined)
  let timer = /** @type {any} */ (undefined)
  let inflight = /** @type {Promise<object>|null} */ (null)
  let snapshot = /** @type {object|undefined} */ (undefined)
  /** Latched by stop(); unlike an idle stop, this never resumes. */
  let halted = false

  /** The configured interval, floored so a tiny value cannot spin. */
  function intervalMs(current) {
    return Math.max(1000, Math.round((current?.autoRefreshSec ?? 0) * 1000))
  }

  function automatic(current) {
    return (current?.autoRefreshSec ?? 0) > 0
  }

  /** Data older than this makes a returning watch refresh immediately. */
  function resumeAfterMs(current) {
    return Math.max(WATCH_TTL_MS, intervalMs(current))
  }

  /**
   * Publish a snapshot. `rows: null` means "no new rows this time"; `failed`
   * says whether that was a failure (stale) or just a round in flight.
   */
  function publish({ rows = null, failed = false } = {}) {
    snapshot = buildSnapshot({
      at: now(),
      polledAt: lastPolledAt,
      rows,
      failed,
      settings,
      poller: { state, delayMs, error, nextPollAt },
      previous: snapshot ?? null,
    })
    return snapshot
  }

  function schedule() {
    if (timer !== undefined) { clearTimer(timer); timer = undefined }
    if (halted || !automatic(settings)) { nextPollAt = undefined; return }
    nextPollAt = now() + delayMs
    timer = setTimer(() => { timer = undefined; tick() }, delayMs)
  }

  /** True once nobody has looked for the idle timeout. */
  function idledOut() {
    if (lastWatchAt === undefined) return true
    return now() - lastWatchAt > WATCH_TTL_MS
  }

  function tick() {
    if (halted) return
    if (idledOut()) {
      state = 'stopped'
      nextPollAt = undefined
      publish({ rows: null, failed: false })
      return
    }
    void refresh()
  }

  /**
   * Run one round. Concurrent callers share the round in flight, so a timer, a
   * heartbeat and a manual refresh landing together cost one upstream round.
   * @returns {Promise<object>} The snapshot after this round.
   */
  function refresh() {
    if (inflight !== null) return inflight
    state = 'polling'
    lastPollAt = now()
    publish({ rows: null, failed: false })
    inflight = (async () => {
      // Claim the round synchronously (so a watch in the same tick already sees
      // `lastPollAt` and does not fire a second one), but start the upstream
      // call on the next microtask: `watch()` promises never to block its
      // caller, and calling fetchRound here would run before watch returns.
      await Promise.resolve()
      try {
        const round = await fetchRound()
        const rows = round?.rows ?? null
        if (rows === null) throw new Error('round returned no rows')
        error = null
        delayMs = intervalMs(settings)
        state = 'idle'
        lastPolledAt = now()
        schedule()
        return publish({ rows, failed: false })
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure)
        delayMs = Math.min(delayMs * 2, MAX_BACKOFF_MS)
        state = 'backoff'
        schedule()
        return publish({ rows: null, failed: true })
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  return {
    /**
     * A client reports it is still on screen. Never blocks.
     * @returns {{ snapshot: object, triggered: boolean }}
     */
    watch() {
      const at = now()
      lastWatchAt = at

      const canPoll = automatic(settings) && !halted
      // A poller that idled out has no timer and cannot come back by itself;
      // this branch is its only way home.
      const resuming = canPoll && state === 'stopped'
      const stale = lastPollAt === undefined || at - lastPollAt >= resumeAfterMs(settings)
      const shouldTrigger = canPoll && (resuming || stale)

      if (shouldTrigger) {
        state = 'idle'
        void refresh()
      } else {
        // Re-arm a timer that was never installed (first watch) or was lost.
        if (canPoll && timer === undefined) schedule()
        if (snapshot === undefined) publish({ rows: null, failed: false })
      }
      return { snapshot: /** @type {object} */ (snapshot), triggered: shouldTrigger }
    },

    /** The current snapshot, built on demand if this poller never published one. */
    read() {
      if (snapshot === undefined) publish({ rows: null, failed: false })
      return snapshot
    },

    refresh,

    /** Apply saved settings and re-arm the timer. Not a failure: nothing went stale. */
    reconfigure(next) {
      settings = { ...next }
      delayMs = intervalMs(settings)
      if (!automatic(settings)) {
        if (timer !== undefined) { clearTimer(timer); timer = undefined }
        nextPollAt = undefined
      } else {
        schedule()
      }
      publish({ rows: null, failed: false })
      return snapshot
    },

    /** Hand back the poller's own view, for the snapshot and the settings page. */
    state() {
      return { state, delayMs, error, nextPollAt }
    },

    /** Stop for good; the plugin is unloading. */
    stop() {
      halted = true
      if (timer !== undefined) { clearTimer(timer); timer = undefined }
      nextPollAt = undefined
      state = 'stopped'
    },
  }
}
