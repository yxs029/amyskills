/**
 * Calling the official Our Free Model plugin from inside the kernel.
 *
 * OFM deliberately locks its management surface behind browser authentication:
 * `/api/channel-pack` is registered as an exact Fetch route on the kernel's
 * `connection` service, and an HTTP request from outside the app is answered
 * 401. A plugin running in the same process may call it — by handing that route
 * a copy of the shared owner Peer and posting the kernel's own RPC envelope.
 *
 * Two shapes differ across kernel versions and must not be confused:
 *
 * - The owner Peer is `connection.browserPeer` from DSH 0.2.1 on, and
 *   `connection.operator` before that. They are the same identity under two
 *   names; each version only ever understands its own.
 * - The route answers with the handler result wrapped in an `rpcId`-keyed
 *   envelope, so the payload is `body.result ?? body`.
 *
 * Reading only one of the two Peer names is what made a sibling plugin report
 * "no owner peer" on every 0.2.0 install, so both are accepted here.
 */

/** The Fetch-route path OFM registers. */
export const CHANNEL_PACK_PATH = '/api/channel-pack'

/** The RPC endpoint name carried in the envelope's `method`. */
export const CHANNEL_PACK_METHOD = 'channel-pack'

/**
 * The Peer allowed to call an exact Fetch route, across kernel versions.
 * @param {{ browserPeer?: unknown, operator?: unknown } | null | undefined} connection
 * @returns {unknown} The owner Peer, or undefined when this kernel exposes none.
 */
export function ownerPeer(connection) {
  if (connection === null || connection === undefined) return undefined
  const peer = connection.browserPeer ?? connection.operator
  return peer === undefined || peer === null ? undefined : peer
}

/** A cheap unique id; the kernel only echoes it back. */
function rpcId() {
  return `ofm-balance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build the RPC caller.
 *
 * The connection service can be published after this plugin loads (the kernel
 * mounts it together with the web server), so it is read on every call rather
 * than once at apply time.
 *
 * @param {() => any} readConnection Returns the live `connection` service.
 * @returns {{ call: (method: string, payload: unknown, signal?: AbortSignal) => Promise<any> }}
 */
export function makeKernelRpc(readConnection) {
  return {
    /**
     * Invoke one `channel-pack` method.
     * @param {string} method Method name, e.g. `credits.balances`.
     * @param {unknown} payload Method payload.
     * @param {AbortSignal} [signal] Caller cancellation.
     * @returns {Promise<{ ok: boolean, value?: unknown, error?: { message?: string, code?: string } }>}
     */
    async call(method, payload, signal) {
      const connection = readConnection()
      if (connection === null || connection === undefined) {
        throw new Error('connection service unavailable')
      }
      const handler = typeof connection.createSharedFetchHandler === 'function'
        ? connection.createSharedFetchHandler('/api')
        : undefined
      if (handler === undefined || typeof handler.fetch !== 'function') {
        throw new Error('connection service has no shared fetch handler')
      }
      const peer = ownerPeer(connection)
      if (peer === undefined) {
        throw new Error('connection service has no owner peer (browserPeer/operator)')
      }

      const envelope = {
        type: 'client-request',
        rpcId: rpcId(),
        method: CHANNEL_PACK_METHOD,
        payload: { method, payload },
      }
      const request = new Request(`http://127.0.0.1${CHANNEL_PACK_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        signal,
      })
      const response = await handler.fetch(request, peer)
      // Any non-2xx is a refusal. Checking only 401/403 was not enough: an
      // unregistered route can answer 404 with a JSON body, which used to flow
      // on as a "successful" empty answer — the exact failure mode of showing
      // ten rows as "not signed in" when nothing was ever asked.
      if (!response.ok) {
        throw new Error(`channel-pack refused (HTTP ${response.status})`)
      }
      const text = await response.text()
      let body
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error(`channel-pack answered non-JSON (HTTP ${response.status})`)
      }
      const result = body?.result ?? body
      if (result?.ok === false) {
        throw new Error(result?.error?.message ?? result?.error?.code ?? 'channel-pack refused')
      }
      // The pack always answers `{ ok, value }`. Anything else (an error page,
      // a bare object) is not an answer, and treating it as one is how "no
      // channels" gets invented.
      if (result?.ok !== true) {
        throw new Error('channel-pack answered an unexpected envelope')
      }
      return result
    },
  }
}
