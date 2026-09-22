"use client";
// A textarea for open answers. On a keyboard, Enter submits and Shift+Enter
// inserts a line break (the Typeform convention). On a touch screen there is
// no Shift key, so Enter is a line break and the OK button submits. A counter
// appears near the cap.
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
        rows={5}
        value={value}
        maxLength={maxChars}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || touch) return;
          if (event.nativeEvent.isComposing) return; // an accent or a suggestion is being typed
          event.preventDefault();
          onSubmit();
        }}
        className="w-full rounded-lg border border-border bg-input p-3 text-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{touch ? "" : t(UI.shiftEnter, lang)}</span>
        {value.length > maxChars - 500 && <span>{value.length} / {maxChars}</span>}
      </div>
    </div>
  );
}
