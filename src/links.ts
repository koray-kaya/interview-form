// Invitation links for the admin page: the form's address with the company
// tag (?c=) and the language (?l=), and personal codes for people without a
// company number. Plain functions, no library; used in the browser.

/** No 0, O, 1, I or L: a code read aloud or retyped cannot be misread. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const cryptoRandom = (): number => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/** "P-" and six characters, e.g. P-7K3Q9X; about a billion possibilities. */
export function personalCode(random: () => number = cryptoRandom): string {
  let code = "P-";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export function inviteLinks(origin: string, tag: string): { de: string; en: string } {
  const link = (lang: string) => {
    const url = new URL("/", origin);
    url.searchParams.set("c", tag);
    url.searchParams.set("l", lang);
    return url.toString();
  };
  return { de: link("de"), en: link("en") };
}
