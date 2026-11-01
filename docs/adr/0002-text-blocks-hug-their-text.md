# Text blocks hug their text; no automatic wrapping

A text block's box always fits its text exactly. New lines come only from line breaks the user types, dragging the corner handle scales the font size, and width and height are read-only in the inspector. This deliberately departs from the original brief, which asked for an editable width and a resizable box. In this style, line breaks are deliberate ("GET UP. / DUST OFF."), so automatic wrapping rarely helps, and leaving it out means the editor and the exported PNG can't disagree about where lines break.

## Considered Options

- **Fixed width with wrapping** (Figma's fixed-width mode): rejected. The export would have to reproduce the browser's line-breaking exactly to stay pixel-identical with the editor.
- **Both modes**: rejected as extra complexity with little payoff for short statement text.

## Consequences

- A long line can run past the safe area. The user shortens it, adds a line break or scales the block down; nothing wraps it for them.
