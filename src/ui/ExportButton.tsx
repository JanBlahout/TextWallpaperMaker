"use client";

import { useState } from "react";
import type { Wallpaper } from "@/editor";
import { exportWallpaper } from "@/export/exportWallpaper";

export function ExportButton({ wallpaper }: { wallpaper: Wallpaper | null }) {
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);

  const onExport = async () => {
    if (!wallpaper) return;
    setExporting(true);
    setFailed(false);
    try {
      await exportWallpaper(wallpaper);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const resolutionLabel = wallpaper ? `${wallpaper.resolution.width} × ${wallpaper.resolution.height} PNG` : "PNG";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={!wallpaper || exporting}
        className="flex w-full flex-col items-start rounded-md bg-neutral-100 px-3 py-2 text-left text-neutral-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="text-sm font-medium">Export Wallpaper</span>
        <span className="font-mono text-[11px] text-neutral-500 tabular-nums">{resolutionLabel}</span>
      </button>
      {failed && (
        <p role="alert" className="text-[11px] text-neutral-400">
          Export failed. Please try again.
        </p>
      )}
    </div>
  );
}
