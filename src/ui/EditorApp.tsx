"use client";

import { useEffect, type ReactNode } from "react";
import { BackgroundControls } from "./BackgroundControls";
import { ExportButton } from "./ExportButton";
import { startEditor, useEditor, useEditorStore, useSettings, useView, useWallpaper } from "./editorStore";
import { GuideSettings } from "./GuideSettings";
import { Inspector } from "./Inspector";
import { NewWallpaperButton } from "./NewWallpaperButton";
import { ResolutionControls } from "./ResolutionControls";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { WallpaperCanvas } from "./WallpaperCanvas";

export function EditorApp() {
  const editor = useEditor();
  useEffect(() => {
    void startEditor();
  }, []);
  useKeyboardShortcuts(editor);

  return (
    <>
      <LargerScreenMessage />
      <div className="hidden h-dvh grid-cols-[240px_minmax(0,1fr)_260px] bg-neutral-950 text-neutral-300 lg:grid">
        <LeftSidebar />
        <main className="min-w-0 bg-neutral-950">
          <CanvasArea />
        </main>
        <Inspector />
      </div>
    </>
  );
}

function LeftSidebar() {
  const editor = useEditor();
  const wallpaper = useWallpaper();
  const settings = useSettings();

  return (
    <aside className="flex min-h-0 flex-col border-r border-neutral-800 bg-neutral-900">
      <header className="border-b border-neutral-800 px-4 py-3">
        <AppTitle />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {editor && wallpaper && <ResolutionControls editor={editor} resolution={wallpaper.resolution} />}
        {editor && wallpaper && <BackgroundControls editor={editor} wallpaper={wallpaper} />}
        {editor && settings && <GuideSettings editor={editor} settings={settings} />}
      </div>
      <footer className="flex flex-col gap-3 border-t border-neutral-800 p-4">
        <NewWallpaperButton editor={editor} />
        <ExportButton wallpaper={wallpaper} />
      </footer>
    </aside>
  );
}

function CanvasArea() {
  const phase = useEditorStore((state) => state.phase);
  const editor = useEditor();
  const wallpaper = useWallpaper();
  const view = useView();
  const settings = useSettings();
  const error = useEditorStore((state) => state.error);

  if (phase === "failed") {
    return <CenteredNote>{error}</CenteredNote>;
  }
  if (!editor || !wallpaper || !view || !settings) {
    return <CenteredNote>Loading…</CenteredNote>;
  }
  return <WallpaperCanvas editor={editor} wallpaper={wallpaper} view={view} settings={settings} />;
}

function AppTitle() {
  return <h1 className="text-xs font-semibold tracking-wide text-neutral-100 uppercase">Text Wallpaper Maker</h1>;
}

function CenteredNote({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-xs text-neutral-500">{children}</div>;
}

function LargerScreenMessage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-neutral-950 p-8 text-center lg:hidden">
      <div className="max-w-xs">
        <AppTitle />
        <p className="mt-3 text-sm text-neutral-400">
          Please use a larger screen. The editor needs a desktop-sized window to design wallpapers.
        </p>
      </div>
    </div>
  );
}
