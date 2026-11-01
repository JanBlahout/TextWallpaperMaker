"use client";

import type { ReactNode } from "react";

/** A labelled checkbox for turning something on or off. */
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 cursor-pointer accent-neutral-300"
      />
      {children}
    </label>
  );
}
