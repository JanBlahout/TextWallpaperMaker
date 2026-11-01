# One Canvas 2D renderer for both the on-screen view and the export

The wallpaper is drawn by a single Canvas 2D render function. The editor calls it at the current zoom, and export calls it once at exactly the wallpaper's resolution (never multiplied by the screen's pixel ratio). Guides, smart guides, the selection box, handles and the text field for in-place editing live in a separate layer on top that is never exported. Text-block bounding boxes come from the same text measurements the renderer uses, so selection, snapping and the exported PNG can't disagree. This is only practical because text blocks never wrap (ADR 0002), which makes each line a single `fillText` call.

## Considered Options

- **Normal page elements for the editor, captured with `html-to-image`**: rejected. The library's last release was in February 2025. It drops custom fonts on the first render in Safari (WebKit bug 219770), crashes on fonts in Firefox (#535), and only produces exact output dimensions when its pixel-ratio options are set correctly.
- **Normal page elements for the editor, plus a separate canvas renderer for export**: rejected. Two text renderers drift apart, and "what you see is what you export" is the product's core promise.

## Consequences

- Letter spacing needs `CanvasRenderingContext2D.letterSpacing`: Safari 18.4+, Chrome 99+, Firefox 115+.
- The renderer must wait for `document.fonts.load()` before drawing. Resizing a canvas resets its context, including font and letter spacing.
- In Safari Private Browsing (and optionally all browsing), Advanced Fingerprinting Protection adds tiny noise to canvas readback, so exported pixels can differ very slightly. Every client-side export method has this.
