"use client";
// A textarea for open answers. On a keyboard, Enter submits and Shift+Enter
// inserts a line break (the Typeform convention). On a touch screen there is
// no Shift key, so Enter is a line break and the OK button submits. Styled
// like Typeform: no box, a line under large navy text that grows as you type.
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

type Props = {
  value: string;
  maxChars: number;
  lang: Lang;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

// Phones and tablets report a coarse pointer. The form renders only in the
// browser (it waits for localStorage), so reading window here is safe.
function isTouchScreen(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function TextInput({ value, maxChars, lang, onChange, onSubmit }: Props) {
  const touch = isTouchScreen();
  return (
    <div className="flex flex-col gap-2">
      <textarea
        autoFocus
        rows={1}
        value={value}
        maxLength={maxChars}
        placeholder={t(UI.placeholder, lang)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || touch) return;
          if (event.nativeEvent.isComposing) return; // an accent or a suggestion is being typed
          event.preventDefault();
          onSubmit();
        }}
        className="field-sizing-content max-h-[45dvh] min-h-12 w-full resize-none border-0 border-b-2 border-accent/30 bg-transparent pb-2 text-2xl leading-snug text-accent outline-none transition-colors placeholder:text-accent/35 focus:border-accent"
      />
      <div className="flex justify-between gap-4 text-sm text-muted-foreground">
        <span>{touch ? "" : t(UI.shiftEnter, lang)}</span>
        {value.length > maxChars - 500 && <span className="tabular-nums">{value.length} / {maxChars}</span>}
      </div>
    </div>
  );
}
