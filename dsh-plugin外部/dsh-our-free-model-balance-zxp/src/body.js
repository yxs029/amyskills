/**
 * Body parsing, kept out of the socket handler so it can be tested.
 *
 * The distinction that matters: an **empty** body is a legitimate "no fields"
 * request, while a **malformed** one is the client's mistake. Collapsing the
 * two — as the first version did — turns a typo in a `PUT /settings` into a
 * write of every default, silently wiping the user's saved choices.
 */

/**
 * Parse a request body that must be a JSON object.
 * @param {string} text Raw body text.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function parseJsonObject(text) {
  if (typeof text !== 'string' || text.trim() === '') return { ok: true, value: {} }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'body is not valid JSON' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'body must be a JSON object' }
  }
  return { ok: true, value: parsed }
}