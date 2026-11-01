"use client";

import type { MouseEvent, ReactNode } from "react";
import { zoomAt, type Editor, type Viewport } from "@/editor";

/** How much each zoom-in or zoom-out button press multiplies the zoom by. */
const ZOOM_STEP = 2;

/**
 * The canvas's zoom controls, floating over its bottom-right corner: zoom out
 * and in about the canvas's centre, the current zoom, Fit (Shift+1) and 100%
 * (Shift+0). Zoom is an editor setting, so none of this is an undo step.
 */
export function ZoomControls({ editor, viewport }: { editor: Editor; viewport: Viewport }) {
  const zoomedOut = zoomAt(viewport, viewport.zoom / ZOOM_STEP);
  const zoomedIn = zoomAt(viewport, viewport.zoom * ZOOM_STEP);

  return (
    <div
      role="group"
      aria-label="Zoom"
      // Pressing a control mustn't also press the canvas underneath, which would deselect.
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-md border border-neutral-800 bg-neutral-900/90 p-0.5 text-neutral-400 shadow-lg"
    >
      <ZoomButton
        label="Zoom out"
        disabled={zoomedOut.zoom === viewport.zoom}
        onClick={() => editor.setSettings(zoomedOut)}
      >
        −
      </ZoomButton>
      <span data-testid="zoom-level" className="w-12 text-center font-mono text-[11px] text-neutral-200 tabular-nums">
        {formatZoom(viewport.zoom)}
      </span>
      <ZoomButton
        label="Zoom in"
        disabled={zoomedIn.zoom === viewport.zoom}
        onClick={() => editor.setSettings(zoomedIn)}
      >
        +
      </ZoomButton>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-neutral-800" />
      <ZoomButton label="Fit" shortcut="Shift+1" onClick={() => editor.setSettings({ zoom: "fit" })}>
        Fit
      </ZoomButton>
      <ZoomButton label="100%" shortcut="Shift+0" onClick={() => editor.setSettings(zoomAt(viewport, 1))}>
        100%
      </ZoomButton>
    </div>
  );
}

/** A zoom as a whole percentage, e.g. "47%". */
function formatZoom(zoom: number) {
  return `${Math.round(zoom * 100)}%`;
}

function ZoomButton({
  label,
  shortcut,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-keyshortcuts={shortcut}
      disabled={disabled}
      onClick={onClick}
      // A click doesn't take the focus, so Space still pans afterwards instead of pressing the button again.
      onMouseDown={preventFocus}
      className="min-w-7 rounded px-1.5 py-1 font-mono text-[11px] tabular-nums transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function preventFocus(event: MouseEvent) {
  event.preventDefault();
}
