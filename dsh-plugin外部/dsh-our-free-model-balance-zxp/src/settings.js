/**
 * The plugin's user-facing preferences, in one place.
 *
 * Everything here is a pure function over plain data except the two file
 * helpers, which is what makes the interactive half testable at all: the
 * browser side of this plugin cannot be imported by Node (the page's module
 * loader delivers it), so the settings rules must live here or nowhere.
 *
 * A hand-edited or half-written file must never break the plugin: unknown
 * types fall back to the default, numbers are clamped to the documented
 * range, and a file that cannot be parsed is preserved as `.bad` before the
 * defaults take over. Losing a user's edit silently would be worse than the
 * broken file, so it is kept rather than deleted.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

export const AUTO_REFRESH_MIN = 15
export const AUTO_REFRESH_MAX = 3600

/** 0 means "no automatic refresh"; any other value is seconds between polls. */
export const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  autoRefreshSec: 60,
  showTimestamp: true,
  showUnits: true,
  showSpine: true,
  showFooter: true,
  showSignedOut: false,
  redWhenSpent: true,
  chipStyle: 'number',
  hiddenChannels: [],
})

const BOOLEAN_KEYS = [
  'showTimestamp',
  'showUnits',
  'showSpine',
  'showFooter',
  'showSignedOut',
  'redWhenSpent',
]

const CHIP_STYLES = new Set(['number', 'dot'])

/** Seconds between polls: 0 (off) or a clamped 15–3600. */
function sanitizeRefresh(value) {
  if (value === 0) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.autoRefreshSec
  const rounded = Math.trunc(value)
  // A negative or sub-second value is a typo, not a request to turn polling off
  // — clamping keeps the user's intent ("some interval") instead of silently
  // disabling the feature they came here to configure.
  if (rounded === 0) return AUTO_REFRESH_MIN
  return Math.min(Math.max(rounded, AUTO_REFRESH_MIN), AUTO_REFRESH_MAX)
}

/** Channel ids are the only thing a hide list may contain. */
function sanitizeChannels(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const entry of value) {
    if (typeof entry === 'string' && entry !== '' && !out.includes(entry)) out.push(entry)
  }
  return out
}

/**
 * Turn anything into a complete, valid settings object.
 * @param {unknown} raw Parsed file contents, or a request body.
 * @returns {typeof DEFAULT_SETTINGS} A fresh object; never a shared reference.
 */
export function sanitizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const settings = {
    ...DEFAULT_SETTINGS,
    hiddenChannels: [],
    autoRefreshSec: source.autoRefreshSec === undefined
      ? DEFAULT_SETTINGS.autoRefreshSec
      : sanitizeRefresh(source.autoRefreshSec),
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') settings[key] = source[key]
  }
  if (typeof source.chipStyle === 'string' && CHIP_STYLES.has(source.chipStyle)) {
    settings.chipStyle = source.chipStyle
  }
  settings.hiddenChannels = sanitizeChannels(source.hiddenChannels)
  return settings
}

/**
 * Where the settings file lives.
 * @param {string} home The harness home (`$DSH_HOME`).
 * @returns {string} Absolute path to this plugin's settings file.
 */
export function settingsFile(home) {
  return path.join(home, 'dsh-our-free-model-balance-zxp', 'settings.json')
}

/**
 * Read the settings, falling back to defaults for every way this can go wrong.
 * @param {string} file Absolute path to the settings file.
 * @returns {Promise<ReturnType<typeof sanitizeSettings>>}
 */
export async function loadSettings(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (error) {
    // A missing file is the normal first-run state, not a problem.
    if (error?.code === 'ENOENT') return sanitizeSettings({})
    return sanitizeSettings({})
  }
  try {
    return sanitizeSettings(JSON.parse(text))
  } catch {
    // Keep the unparseable file for the user (or a bug report) instead of
    // overwriting evidence with defaults.
    try { await fs.rename(file, `${file}.bad`) } catch { /* best effort */ }
    return sanitizeSettings({})
  }
}

/**
 * Write the settings atomically: a rename cannot leave a half-written file.
 * @param {string} file Absolute path to the settings file.
 * @param {unknown} settings Anything `sanitizeSettings` accepts.
 * @returns {Promise<void>}
 */
export async function saveSettings(file, settings) {
  const clean = sanitizeSettings(settings)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(clean, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, file)
}
