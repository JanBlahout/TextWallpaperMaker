Build a simple web application for creating minimalist text-based wallpapers.

The application should be built with **Next.js** and should feel lightweight, fast, and easy to use. The main use case is creating wallpapers with motivational quotes, especially in a style similar to Jocko Willink’s _Discipline Equals Freedom_ aesthetic.

## Core concept

The user selects a target screen resolution, places one or more text blocks on a canvas, aligns them using a visible grid and safe margins, customizes typography, and exports the result as an image.

The editor should prioritize simplicity over advanced design features.

## Recommended stack

Use:

- Next.js
- TypeScript
- React
- Tailwind CSS
- Zustand or simple React state for editor state
- `html-to-image`, Canvas API, or a similar client-side solution for exporting the final wallpaper as PNG

Avoid adding a backend unless it becomes necessary later.

Everything should work client-side for the initial version.

## Main layout

Use a desktop-first editor layout with three main areas:

### Left sidebar

Contains the configuration and creation controls.

Include:

- canvas / device preset selector
- custom resolution inputs
- font selector
- add text button
- background controls
- grid settings
- export button

### Center area

Contains the actual wallpaper canvas.

The canvas should:

- preserve the exact aspect ratio of the selected resolution
- scale visually to fit the browser window
- internally use the real target dimensions
- allow dragging and positioning text blocks
- show alignment guides and grid lines while editing
- hide all editor UI when exporting

### Right sidebar

Contains properties for the currently selected text block.

For example:

- text content
- font family
- font size
- font weight
- letter spacing
- line height
- text alignment
- text color
- opacity
- uppercase toggle
- position
- width
- rotation if needed later

The first version does not need complicated effects.

## Canvas presets

Provide several common presets.

### Desktop

- 1920 × 1080 — Full HD, 16:9
- 2560 × 1440 — QHD, 16:9
- 3840 × 2160 — 4K, 16:9
- 3440 × 1440 — Ultrawide
- 2560 × 1600 — 16:10
- 3024 × 1964 — MacBook Pro 14"
- 3456 × 2234 — MacBook Pro 16"

### Mobile

Include a few common smartphone presets, for example:

- 1179 × 2556 — modern iPhone portrait
- 1206 × 2622 — larger iPhone portrait
- 1290 × 2796 — large iPhone portrait
- 1080 × 2400 — common Android portrait
- 1440 × 3200 — high-resolution Android portrait

Do not make the preset name more important than the actual pixel dimensions.

Also include:

**Custom resolution**

with:

- width input
- height input

The canvas should immediately update when the resolution changes.

## Typography

The primary font should be:

**OCR A**

This should be the default font when the app opens.

Self-host the font if the license allows it. Use `@font-face` or Next.js font loading where appropriate.

Also provide several simple alternatives, for example:

- OCR A
- Helvetica / Arial
- Inter
- IBM Plex Mono
- Space Mono
- Courier Prime
- system monospace

The font architecture should make it easy to add more fonts later.

## Text blocks

The user must be able to create multiple independent text blocks.

Each text block should support:

- arbitrary text
- multiline text
- drag and drop positioning
- resizing its bounding box
- font selection
- font size
- letter spacing
- line height
- text color
- text alignment
- uppercase transformation
- duplication
- deletion

For example, a wallpaper could contain:

GOOD.

GET UP.
DUST OFF.
RELOAD.
RECALIBRATE.
RE-ENGAGE.

Each section should be independently positionable.

Clicking a text block should select it.

The selected block should have a subtle bounding box that is not included in the exported image.

## Grid system

A strong alignment system is important.

The editor should provide an optional visual grid over the canvas.

The grid should support:

- snap to grid
- configurable grid size
- visible / hidden state

A good default might be a grid based on either:

- 8 px units
- 16 px units
- a 12-column layout

For wallpaper design, a proportional grid may work better than a purely pixel-based grid.

Consider combining:

- horizontal and vertical grid lines
- center lines
- safe-area guides

## Safe margins

Add visible safe-area guides around the canvas.

The user should be able to keep content an equal distance from each edge.

For example, default safe margins could be:

- 5% from every side

or optionally:

- 8%
- 10%

The safe area should scale proportionally with the selected resolution.

Include guides for:

- left margin
- right margin
- top margin
- bottom margin
- horizontal center
- vertical center

These guides should not appear in the exported image.

## Smart alignment

When dragging text blocks, show temporary alignment guides similar to Figma.

For example, show guides when:

- a block is centered horizontally
- a block is centered vertically
- two text blocks share the same left edge
- two text blocks share the same right edge
- two blocks have equal spacing
- a block aligns with the safe margin

Support snapping to these guides.

This is important because the editor should make it easy to create visually balanced layouts without requiring manual pixel calculations.

## Position controls

In addition to dragging, allow precise positioning.

For the selected element display:

- X position
- Y position
- width

Optional:

- height
- rotation

Also add quick alignment actions:

- align left
- center horizontally
- align right
- align top
- center vertically
- align bottom

Alignment should be relative to either:

- the entire canvas
- the safe area

Using the safe area as the default would probably make the most sense.

## Background

For the first version, support:

- solid background color

Default:

- black background
- off-white or white OCR A text

Later versions could support:

- gradients
- uploaded images
- texture
- grain

Do not include those in the initial MVP unless implementation is trivial.

## Editing interaction

The canvas should behave similarly to a lightweight version of Figma or Canva.

Expected interactions:

- click an element to select it
- drag to move
- double-click text to edit directly
- Delete / Backspace removes selected element
- Cmd/Ctrl + D duplicates
- arrow keys move the selected element
- Shift + arrow moves it by a larger amount
- Cmd/Ctrl + Z undo
- Cmd/Ctrl + Shift + Z redo

Keyboard interaction is valuable because positioning text precisely is important.

## Zoom

Allow users to zoom the editor without changing the final output.

Provide:

- zoom in
- zoom out
- fit to screen
- 100%

The actual internal canvas dimensions must remain unchanged.

For example, a 3840 × 2160 wallpaper could visually appear at 960 × 540 inside the browser while still exporting at full 4K resolution.

## Export

Allow the user to export the finished wallpaper as:

**PNG**

The PNG must use the exact selected resolution.

For example:

1920 × 1080 preset → exported PNG must be exactly 1920 × 1080 pixels.

Do not include:

- grid
- guides
- selection outlines
- editor UI

in the export.

Suggested export button text:

**Export Wallpaper**

Optionally display the resulting dimensions next to it:

Export Wallpaper  
3840 × 2160 PNG

## Persistence

Store the current design in `localStorage`.

Refreshing the page should restore:

- canvas resolution
- text blocks
- their positions
- typography
- background
- grid settings

No account system is necessary.

## Optional templates

The app could later include simple layout presets.

Examples:

### Centered statement

Text centered horizontally and vertically.

### Bottom-left quote

Text aligned to the bottom-left safe margin.

### Top-left statement

Text aligned to the upper-left safe margin.

### Large single word

One very large word centered or aligned to the grid.

These should only define positioning and styling, not pre-written copyrighted quote content.

## Example initial state

When the app first opens:

Canvas:

1920 × 1080

Background:

black

Font:

OCR A

Text:

DISCIPLINE  
EQUALS  
FREEDOM.

Position:

bottom-left inside the safe area

Text color:

#F2F2F2

Grid:

visible

Safe margins:

visible

This immediately communicates what the application is designed for.

## Visual style of the application

Keep the editor UI minimal and utilitarian.

Use:

- dark interface
- subtle borders
- monochrome colors
- compact controls
- minimal decoration

The wallpaper itself should remain visually separate from the editor UI.

Avoid making the application look like a generic SaaS dashboard.

It should feel closer to a focused design tool.

## MVP priorities

Focus first on:

1. Canvas presets
2. Custom canvas size
3. OCR A font
4. Multiple text blocks
5. Dragging and positioning
6. Typography controls
7. Grid
8. Safe margins
9. Alignment snapping
10. PNG export
11. Local persistence

Do not spend time initially on:

- accounts
- cloud storage
- collaboration
- AI
- image editing
- complex graphical elements
- animations
- templates marketplace

The core experience should be:

**Choose size → add text → align it beautifully → export wallpaper.**
