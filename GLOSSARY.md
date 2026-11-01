# Text Wallpaper Maker

A browser-only editor for designing minimalist, text-only wallpapers at an exact screen resolution and exporting them as PNG.

## Language

### The wallpaper

**Wallpaper**:
The single thing being designed and exported: a resolution, a background colour and a set of text blocks.
_Avoid_: Design, document, project, canvas

**Resolution**:
A wallpaper's exact width × height in pixels; the exported PNG has exactly these dimensions.
_Avoid_: Canvas size, dimensions

**Preset**:
A named resolution offered for convenience; the pixel dimensions matter more than the name.
_Avoid_: Device, template

**Text block**:
The only kind of thing placed on a wallpaper: a piece of text, with its own typography and position, whose box always hugs its text.
_Avoid_: Element, layer, text box, section

**Anchor**:
On each axis, the safe-area edge or centre a text block sits nearest to, which it keeps its distance from when the wallpaper is re-fitted.

**Re-fit**:
Moving a wallpaper to a new resolution: every text block scales by one common factor and keeps its anchors.
_Avoid_: Resize, rescale

### The editor

**Canvas**:
The editor's on-screen, zoomable view of the wallpaper; never exported.
_Avoid_: Using "canvas" to mean the wallpaper or its resolution

**Safe margin**:
The equal inset from every edge of the wallpaper, expressed as a percentage of its shorter side.
_Avoid_: Padding, bleed

**Safe area**:
The region of the wallpaper inside the safe margin.

**Grid**:
A set of columns that evenly divide the safe area, with rows added automatically so cells are close to square.

**Guide**:
Any line the editor draws to help alignment (grid lines, safe-area edges, centre lines); guides never appear in the export.
_Avoid_: Overlay, helper line

**Smart guide**:
A temporary guide that appears while dragging when a text block lines up with something.
_Avoid_: Alignment guide, snap line

**Editor settings**:
The persisted preferences for how the editor behaves (grid, safe margin, guide visibility, snapping and zoom), which are not part of the wallpaper.
_Avoid_: Wallpaper settings
