"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CAMPAIGN_TOKENS } from "@/types/database";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export function TokenPickerTextarea({ value, onChange, placeholder, rows = 5 }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function insertToken(token: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + `{{${token}}}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + `{{${token}}}` + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const pos = start + `{{${token}}}`.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="ghost" size="sm" className="h-7 text-xs" />}>
            Insert token
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1" align="end">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1">
              Personalization tokens
            </div>
            {CAMPAIGN_TOKENS.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => insertToken(t.token)}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent flex justify-between items-center"
              >
                <span>{t.label}</span>
                <code className="text-[10px] text-muted-foreground">{`{{${t.token}}}`}</code>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
      {value.length > 160 && (
        <p className="text-[11px] text-muted-foreground">
          {value.length} chars — long SMS messages are split into multiple segments and billed separately.
        </p>
      )}
    </div>
  );
}
