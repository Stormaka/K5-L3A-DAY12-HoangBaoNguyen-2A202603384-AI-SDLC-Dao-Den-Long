// Local leaderboard rules (Ticket-04 §3). Pure functions shared by the server, the browser and tests.
// Entry: { name, score, nights_won, achieved_at (ISO 8601 with offset), seed }. Top 10, score desc,
// equal score -> earlier achieved_at first (and an older entry before a newer one at the same instant).

export const MAX_ENTRIES = 10;
// 3-12 characters: ASCII letters/digits/underscore are required by the ticket; Vietnamese letters with
// diacritics are accepted as the optional bonus (any Unicode letter, counted in code points after NFC).
export const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;
const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export const normalizeName = (name) => String(name ?? '').normalize('NFC').trim();

export function validateEntry(e) {
  if (!e || typeof e !== 'object') return 'entry must be an object';
  const name = normalizeName(e.name);
  if (!NAME_RE.test(name)) return 'name: 3-12 letters, digits or _';
  if (!Number.isInteger(e.score) || e.score < 0) return 'score: integer >= 0';
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) return 'nights_won: 0-3';
  if (typeof e.achieved_at !== 'string' || !ISO_TZ.test(e.achieved_at) || Number.isNaN(Date.parse(e.achieved_at))) return 'achieved_at: ISO 8601 with time zone';
  if (!Number.isInteger(e.seed)) return 'seed: integer';
  return null;
}

export const cleanEntry = (e) => ({ name: normalizeName(e.name), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed });

/** Returns { entries, rank } where rank is the 1-based position of the new entry or null if it did not make the top 10. */
export function addEntry(entries, entry) {
  const err = validateEntry(entry);
  if (err) throw new Error(err);
  const e = cleanEntry(entry);
  const all = [...entries, e]; // stable sort keeps older entries ahead on a full tie
  all.sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
  const top = all.slice(0, MAX_ENTRIES);
  const i = top.indexOf(e);
  return { entries: top, rank: i < 0 ? null : i + 1 };
}

/** Local time as ISO 8601 with the numeric offset, e.g. 2026-11-20T16:05:09+07:00. */
export function isoLocal(d = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}
