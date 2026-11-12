/**
 * The HTTP surface, as a pure function.
 *
 * Keeping dispatch here rather than inside the web-server handler is the only
 * reason this half of the plugin has tests at all: `index.js` owns the socket
 * and the body stream, which is the part that cannot be exercised without a
 * live host, while "which route, which method, which body" is plain data.
 */
import { sanitizeSettings } from './settings.js'

/** Which methods each known route accepts. */
const ROUTES = {
  '/snapshot': ['GET'],
  '/watch': ['POST'],
  '/refresh': ['POST'],
  '/settings': ['GET', 'PUT'],
}

/**
 * @param {object} deps
 * @param {{ watch: Function, read: Function, refresh: Function, reconfigure: Function }} deps.poller
 * @param {() => object} deps.getSettings
 * @param {(settings: object) => Promise<object>} deps.putSettings
 */
export function createRoutes({ poller, getSettings, putSettings }) {
  /**
   * @param {{ method: string, route: string, body?: unknown }} request
   * @returns {Promise<{ status: number, body: object }>}
   */
  async function handle({ method, route, body }) {
    const allowed = ROUTES[route]
    if (allowed === undefined) return { status: 404, body: { error: 'not found' } }
    if (!allowed.includes(method)) return { status: 405, body: { error: 'method not allowed', allowed } }

    if (route === '/snapshot') {
      // Reading is observing. A client that only ever reads the snapshot is
      // still a client that has the numbers on screen, so it counts as a watch
      // — otherwise a passive tab could never keep the poller awake.
      return { status: 200, body: poller.watch().snapshot }
    }

    if (route === '/watch') {
      const { snapshot, triggered } = poller.watch()
      return { status: 200, body: { ...snapshot, triggered } }
    }

    if (route === '/refresh') {
      const snapshot = await poller.refresh()
      return { status: 200, body: snapshot }
    }

    // /settings
    if (method === 'GET') {
      return { status: 200, body: { settings: getSettings() } }
    }

    const saved = await putSettings(sanitizeSettings(body))
    poller.reconfigure(saved)
    return { status: 200, body: { settings: saved } }
  }

  return { handle }
}
