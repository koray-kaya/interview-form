"use client";
// The admin page's link maker: a company number (UID) becomes a German and
// an English invitation link. The check digit is only a warning — every link
// gets the AI follow-ups — but a mistyped number would label the answers
// wrongly. Personal links for people are made in company-reach, which records
// who each one went to (#24); this app never learns a name. Runs in the
// browser; nothing is stored.
import { useState } from "react";
import { inviteLinks } from "@/links";
import { isValidUid } from "@/uid";

type Made = { tag: string; warning: boolean };

export function LinkMaker() {
  const [uid, setUid] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function fromUid() {
    const tag = uid.trim();
    if (!tag) return;
    setMade({ tag, warning: !isValidUid(tag) });
    setCopied(null);
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
    } catch {
      setCopied(null); // clipboard refused: the link is on screen to select by hand
    }
  }

  const links = made ? inviteLinks(window.location.origin, made.tag) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-white/70 p-5">
      <h2 className="text-xl font-semibold text-foreground">Invitation link</h2>
      <p className="text-sm text-body">
        Personal links for people without a company number are made in company-reach, which records who each one went to.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-body">Company number (UID), e.g. CHE-123.456.789</span>
        <input
          value={uid}
          onChange={(event) => setUid(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") fromUid();
          }}
          className="rounded-md border border-accent/30 bg-white px-3 py-2 text-base text-foreground outline-none focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={fromUid} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
          Create links
        </button>
      </div>

      {made?.warning && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-1.5 text-sm text-danger">
          This number fails the UID check digit. The link works, but check the number: the answers will carry it as their label.
        </p>
      )}

      {links && (
        <ul className="flex flex-col gap-2">
          {(["de", "en"] as const).map((lang) => (
            <li key={lang} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm font-semibold uppercase text-muted-foreground">{lang}</span>
              <code className="min-w-0 flex-1 break-all rounded bg-accent/5 px-2 py-1 text-sm text-foreground">{links[lang]}</code>
              <button
                type="button"
                onClick={() => copy(links[lang])}
                aria-label={`Copy the ${lang === "de" ? "German" : "English"} link`}
                className="shrink-0 rounded-md border border-accent/30 px-3 py-1 text-sm text-accent hover:bg-accent/10"
              >
                {copied === links[lang] ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
