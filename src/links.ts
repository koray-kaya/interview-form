// Invitation links for the admin page: the form's address with the company
// tag (?c=) and the language (?l=). Personal codes (P-XXXXXX) are made in
// company-reach (#24). Plain functions, no library; used in the browser.

export function inviteLinks(origin: string, tag: string): { de: string; en: string } {
  const link = (lang: string) => {
    const url = new URL("/", origin);
    url.searchParams.set("c", tag);
    url.searchParams.set("l", lang);
    return url.toString();
  };
  return { de: link("de"), en: link("en") };
}
