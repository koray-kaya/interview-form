// Two languages, German first. Every participant-facing string is a Text
// with both; t() picks one. parseLang() turns the ?l= query value into a Lang.
export type Lang = "de" | "en";
export type Text = Record<Lang, string>;

export function t(text: Text, lang: Lang): string {
  return text[lang];
}

export function parseLang(value: string | string[] | undefined): Lang {
  return value === "en" ? "en" : "de";
}
