/**
 * Turn one channel's `credits.balances` reply into a row the panel renders.
 *
 * The envelope is the pack's own shape: `{ ok: true, value: { accounts: [...] } }`
 * on success, `{ ok: false, error: { code, message } }` on refusal. Each account
 * row is `{ accountId, nickname, balance: number|null, error?: string }`.
 *
 * The one distinction that matters: `balance === 0` means the quota is used up,
 * while `balance === null` means it could not be read. OFM's own source calls
 * this out — showing 0 for an unreadable account would tell the user they have
 * nothing when the truth is that we do not know.
 */
import { channelFor, unitLabel, unitShort } from './channels.js'

/** @typedef {'ok'|'empty'|'unknown'|'unavailable'} RowState */

function blank(id, name, unit) {
  const channel = channelFor(id)
  return {
    id,
    name,
    unit,
    unitLabel: unitLabel(unit),
    unitShort: unitShort(unit),
    // The vendor's own colour travels with the row, so the browser half needs
    // no second copy of the channel table to mark the current one.
    accent: channel === undefined ? '#8A8F98' : channel.accent,
    state: /** @type {RowState} */ ('unavailable'),
    value: null,
    amount: '',
    exact: '',
    partial: false,
    reason: '',
    accounts: [],
  }
}

/**
 * The number to show for one account, or null when the reply carries none.
 *
 * The pack answers in two shapes: a bare number, and a structured
 * `{ total, packages, expiredTotal }` — the latter is what every logged-in
 * channel actually returns (Loomy, TRAE, Raccoon, MiniMax, ZCode). OFM's own
 * panel reads `balance.total`, so this does too. Reading only the numeric shape
 * is what made every signed-in channel report "no balance returned".
 */
function balanceTotal(balance) {
  if (typeof balance === 'number' && Number.isFinite(balance)) return balance
  if (balance !== null && typeof balance === 'object' && Number.isFinite(balance.total)) return balance.total
  return null
}

/**
 * @param {string} channelId
 * @param {{ ok?: boolean, value?: { accounts?: any[] }, error?: { message?: string } }} envelope
 */
export function normalizeRow(channelId, envelope) {
  const channel = channelFor(channelId)
  if (channel === undefined) {
    // A channel this build does not know: report the absence, never a number.
    return { ...blank(channelId, channelId, 'credits'), reason: '未知渠道' }
  }

  const row = blank(channel.id, channel.name, channel.unit)

  if (!envelope || envelope.ok !== true) {
    row.reason = envelope?.error?.message ?? '查询失败'
    return row
  }

  const accounts = Array.isArray(envelope.value?.accounts) ? envelope.value.accounts : []
  if (accounts.length === 0) {
    row.state = 'empty'
    return row
  }

  const values = []
  let partial = false
  let reason = ''
  for (const account of accounts) {
    const value = balanceTotal(account?.balance)
    if (value !== null) {
      values.push(value)
      continue
    }
    partial = true
    if (reason === '' && typeof account?.error === 'string' && account.error !== '') reason = account.error
  }

  if (values.length === 0) {
    row.state = 'unknown'
    row.reason = reason
    return row
  }

  row.state = 'ok'
  // `value` stays exact: the "used up" decision is `value === 0`, and a
  // rounded value would turn a real 0.04 into 0 and report a false "used up".
  // `amount` is the display form only.
  //
  // Across one channel's accounts the meaningful figure is the SUM: the
  // gateway hands a request to any account in the pool, so the pool's total is
  // what the user actually has left — the same number OFM's own panel shows
  // ("账号 2/2 · 剩余积分 15K"). The first version took the minimum, which
  // answered a different question ("when does the first account run dry") and
  // disagreed with the source of truth.
  const exact = values.reduce((total, value) => total + value, 0)
  row.value = exact
  // Two representations on purpose: `amount` is abbreviated for the row (7.3K,
  // scannable at a glance), `exact` keeps every digit for the hover card, where
  // the user is reading one number carefully rather than comparing a column.
  row.amount = formatAmount(exact)
  row.exact = formatExact(exact)
  row.partial = partial
  row.reason = reason
  // Per-account detail, for the hover. The sum alone hides what a user with
  // several accounts in one pool actually wants to see: which account holds
  // how much, and which one could not be read.
  row.accounts = accounts.map(account => {
    const total = balanceTotal(account?.balance)
    return {
      name: typeof account?.nickname === 'string' && account.nickname !== ''
        ? account.nickname
        : String(account?.accountId ?? ''),
      amount: total === null ? '' : formatAmount(total),
      exact: total === null ? '' : formatExact(total),
      note: total === null ? (typeof account?.error === 'string' ? account.error : '查询失败') : '',
    }
  })
  return row
}

/**
 * The unabbreviated form, always two decimals: `7510.00`, `0.04`, `8000000.00`.
 * The hover card shows this one, because "which account holds how much" is a
 * question about exact figures, not order of magnitude.
 */
function formatExact(value) {
  if (!Number.isFinite(value)) return ''
  return value.toFixed(2)
}

/**
 * The display form of a balance.
 *
 * Above a thousand it abbreviates with OFM's own rule (`kilo()` in its
 * client.js): ≥10M → whole M, ≥1M → one-decimal M, ≥10K → whole K, ≥1K →
 * one-decimal K — so a channel's total reads "15K" here exactly as it does on
 * OFM's panel. Below a thousand it keeps the one-decimal precision the user
 * asked for earlier, which OFM's own function would round away.
 */
function formatAmount(value) {
  if (!Number.isFinite(value)) return ''
  const whole = Math.round(value)
  if (Math.abs(whole) >= 1_000_000) {
    return `${(whole / 1_000_000).toFixed(whole >= 10_000_000 ? 0 : 1)}M`
  }
  if (Math.abs(whole) >= 1000) {
    return `${(whole / 1000).toFixed(whole >= 10_000 ? 0 : 1)}K`
  }
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
