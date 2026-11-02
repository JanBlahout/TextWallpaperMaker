"use client";

import { useEffect, type ReactNode } from "react";
import { GALLERY_PATH, QUOTE_WALLPAPERS, THUMBNAIL_SIZE, thumbnailPath } from "@/gallery/quoteWallpapers";
import { AddTextButton } from "./AddTextButton";
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
        <GalleryCard />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {editor && wallpaper && <ResolutionControls editor={editor} resolution={wallpaper.resolution} />}
        {editor && <AddTextButton editor={editor} />}
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

/** The page's one h1 is the desktop editor's; the phone message shows the same title as plain text. */
function AppTitle({ as: Tag = "h1" }: { as?: "h1" | "p" }) {
  return <Tag className="text-xs font-semibold tracking-wide text-neutral-100 uppercase">Text Wallpaper Maker</Tag>;
}

/**
 * A plain link, not a client-side one, so leaving the editor is a real page
 * exit and autosave writes any pending change straight away.
 */
function GalleryLink({ className, children = "Quote wallpaper gallery →" }: { className: string; children?: ReactNode }) {
  return (
    <a href={GALLERY_PATH} className={className}>
      {children}
    </a>
  );
}

/** The gallery's first few wallpapers, shown small so the link reads as a gallery at a glance. */
const CARD_WALLPAPERS = QUOTE_WALLPAPERS.slice(0, 3);

/** The way into the gallery, at the top of the sidebar so it's always in view. */
function GalleryCard() {
  return (
    <GalleryLink className="group mt-3 block rounded-md border border-neutral-700 p-2 transition-colors hover:border-neutral-500 hover:bg-neutral-800">
      <span className="grid grid-cols-3 gap-1">
        {CARD_WALLPAPERS.map((wallpaper) => (
          <img
            key={wallpaper.slug}
            src={thumbnailPath(wallpaper)}
            width={THUMBNAIL_SIZE.width}
            height={THUMBNAIL_SIZE.height}
            alt=""
            className="h-auto w-full rounded-sm bg-black ring-1 ring-neutral-800"
          />
        ))}
      </span>
      <span className="mt-2 block text-xs font-medium text-neutral-100">
        Quote wallpaper gallery <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </span>
      <span className="block text-[11px] text-neutral-500">{QUOTE_WALLPAPERS.length} free wallpapers to download</span>
    </GalleryLink>
  );
}

function CenteredNote({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-xs text-neutral-500">{children}</div>;
}

function LargerScreenMessage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-neutral-950 p-8 text-center lg:hidden">
      <div className="max-w-xs">
        <AppTitle as="p" />
        <p className="mt-3 text-sm text-neutral-400">
          Please use a larger screen. The editor needs a desktop-sized window to design wallpapers.
        </p>
        <GalleryLink className="mt-6 inline-block text-sm text-neutral-200 underline underline-offset-4" />
      </div>
    </div>
  );
}
