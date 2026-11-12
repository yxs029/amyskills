/**
 * The ten account channels dsh-our-free-model offers, their credit units, and
 * their brand accents.
 *
 * The ids, names, orgs and accents are copied verbatim from OFM's own channel
 * grid (`CHANNEL_PROVIDERS` in its client.js) so both surfaces name a channel
 * the same way. The units come from its `CHANNEL_CREDITS` table: only Cline
 * bills in dollars, ZCode in tokens and Gemini in quota; everything else
 * reports credits.
 *
 * This table is deliberately a copy. OFM publishes no channel-enumeration RPC
 * (its `provider.status` needs the caller to pass ids), so a copy is the only
 * way to reach it — which means an upstream channel change makes this table
 * stale silently. `normalizeRow` covers that: an id it does not know is
 * reported as unknown rather than guessed at.
 */

/** @typedef {'credits'|'tokens'|'dollars'|'quota'} CreditUnit */
/** @typedef {{ id: string, name: string, org: string, unit: CreditUnit, accent: string }} Channel */

/** @type {ReadonlyArray<Channel>} */
export const CHANNELS = Object.freeze([
  { id: 'lobsterai', name: 'LobsterAI', org: '有道', unit: 'credits', accent: '#FF6A00' },
  { id: 'qoder', name: 'Qoder', org: '阿里系', unit: 'credits', accent: '#615CED' },
  { id: 'qodercn', name: 'Qoder 中国版', org: '阿里系', unit: 'credits', accent: '#7A6CF0' },
  { id: 'trae', name: 'TRAE', org: '字节', unit: 'credits', accent: '#00BFA6' },
  { id: 'cline', name: 'Cline', org: 'Cline', unit: 'dollars', accent: '#5B5BD6' },
  { id: 'loomy', name: 'Loomy', org: '讯飞', unit: 'credits', accent: '#2F6BFF' },
  { id: 'raccoon', name: 'Raccoon', org: '商汤', unit: 'credits', accent: '#00A6A6' },
  { id: 'minimax', name: 'MiniMax Code', org: 'MiniMax', unit: 'credits', accent: '#E4007F' },
  { id: 'zcode', name: 'ZCode', org: '智谱', unit: 'tokens', accent: '#3B6EF6' },
  { id: 'gemini', name: 'Gemini', org: 'Google Code Assist', unit: 'quota', accent: '#4285F4' },
])

/** The channel a model provider id belongs to, or undefined for a non-channel provider. */
export function channelFor(providerId) {
  return CHANNELS.find(channel => channel.id === providerId)
}

/** The localized label for a unit, spelled exactly as OFM's own panel spells it. */
export function unitLabel(unit) {
  if (unit === 'tokens') return '剩余 Token'
  if (unit === 'dollars') return '剩余余额（USD）'
  if (unit === 'quota') return '剩余配额'
  return '剩余积分'
}

/**
 * The unit as it appears after a figure inside one row.
 *
 * The full label repeats "剩余" on every line even though the panel is
 * entirely about remaining balances, and a long prefix in front of each
 * figure stops the decimal column from lining up. The row therefore carries
 * the bare unit and the panel says "balance" once, in its title.
 */
export function unitShort(unit) {
  if (unit === 'tokens') return 'Token'
  if (unit === 'dollars') return 'USD'
  if (unit === 'quota') return '配额'
  return '积分'
}
