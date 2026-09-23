// Swiss enterprise identification number (UID) check, ported from
// company-reach tools/uid.py. The link's ?c= tag gates the AI follow-ups: only
// a well-formed UID with a correct check digit turns probing on. This is a
// cost gate, not authentication — anyone can type a valid UID.
const UID = /^CHE[\s\-.]?(\d{3})[\s.]?(\d{3})[\s.]?(\d{3})$/i;

// Positional weights from the federal specification.
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4];

/**
 * Weighted sum of the first eight digits, mod 11; the check digit is 11 minus
 * the remainder, where 11 counts as 0 and 10 makes the number invalid — no
 * UID is ever issued with that combination.
 */
export function isValidUid(value: string): boolean {
  const found = UID.exec(value.trim());
  if (!found) return false;
  const digits = (found[1] + found[2] + found[3]).split("").map(Number);
  const total = WEIGHTS.reduce((sum, weight, i) => sum + weight * digits[i], 0);
  const expected = 11 - (total % 11);
  if (expected === 10) return false;
  return digits[8] === (expected === 11 ? 0 : expected);
}
