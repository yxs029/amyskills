/**
 * Host half: keep a fresh snapshot of every channel's balance and serve it.
 *
 * The browser never talks to Our Free Model. It reads this plugin's own
 * snapshot route, which is answered from memory, so the chip paints instantly
 * and any number of tabs share one upstream read. Polling happens here, on a
 * timer, at the interval the user chose — and stops when no client has reported
 * itself for a while (see `src/poller.js`).
 *
 * Everything decidable lives in `src/`: the channel table, the balance
 * normalization, the kernel call, one round, the snapshot, the poller and the
 * route dispatch. This file only owns the socket: it reads bytes, calls
 * `handle`, and writes JSON.
 */
import os from 'node:os'
import path from 'node:path'
import { CHANNELS } from './src/channels.js'
import { loadSettings, sanitizeSettings, saveSettings, settingsFile } from './src/settings.js'
import { parseJsonObject } from './src/body.js'
import { makeKernelRpc } from './src/kernel-rpc.js'
import { fetchRound } from './src/round.js'
import { createPoller } from './src/poller.js'
import { createRoutes } from './src/routes.js'

export const name = 'dsh-our-free-model-balance-zxp'
export const inject = ['webServer']

const BASE = '/api/our-free-model-balance-zxp'
const CATALOGUE = CHANNELS.map(channel => channel.id)
const CHANNEL_TIMEOUT_MS = 20_000

function json(res, status, body) {
  // The snapshot is a live reading, not a document: a cached copy is worse than
  // no copy, because it looks up to date.
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

export function apply(ctx) {
  const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  const file = settingsFile(home)

  /** Start on defaults so the first paint works before the file is read. */
  let settings = sanitizeSettings({})
  /**
   * Set once the user has saved anything. The deferred read below must not then
   * overwrite their choice with what was on disk before they made it.
   */
  let userSaved = false

  const readConnection = () => {
    try {
      const viaGet = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
      if (viaGet !== undefined && viaGet !== null) return viaGet
    } catch { /* fall through */ }
    try { return ctx.connection ?? undefined } catch { return undefined }
  }

  const rpc = makeKernelRpc(readConnection)

  const poller = createPoller({
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: handle => clearTimeout(handle),
    fetchRound: () => fetchRound({
      rpc,
      catalogue: CATALOGUE,
      timeoutMs: CHANNEL_TIMEOUT_MS,
      now: () => Date.now(),
    }),
    settings,
  })

  const routes = createRoutes({
    poller,
    getSettings: () => settings,
    putSettings: async next => {
      // Write first, then commit to memory: if the disk write fails the caller
      // gets an error and memory still matches what is on disk. Assigning first
      // would leave the three copies (memory, disk, poller) disagreeing.
      await saveSettings(file, next)
      settings = next
      userSaved = true
      return settings
    },
  })

  // Read the saved settings after the route exists: a slow or broken file must
  // never delay the plugin coming up, and the defaults are already usable.
  void loadSettings(file).then(loaded => {
    if (userSaved) return
    settings = loaded
    poller.reconfigure(loaded)
  }).catch(() => { /* defaults stand */ })

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = url.pathname.slice(BASE.length).replace(/\/+$/, '')
      const hasBody = req.method === 'PUT' || req.method === 'POST'
      try {
        const parsed = hasBody ? parseJsonObject(await readBody(req)) : { ok: true, value: undefined }
        if (!parsed.ok) {
          json(res, 400, { error: parsed.error })
          return
        }
        const { status, body: payload } = await routes.handle({ method: req.method ?? 'GET', route, body: parsed.value })
        json(res, status, payload)
      } catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'our-free-model-balance-zxp: snapshot routes')

  ctx.effect(() => () => poller.stop(), 'our-free-model-balance-zxp: poller')
}
