# One wallpaper targets one resolution

A wallpaper is designed for exactly one resolution, and positions, sizes and font sizes are stored in that resolution's real pixels. Changing the resolution re-fits the existing text blocks (one common scale factor, each block keeping its anchors) rather than keeping separate layouts per device. We chose this because "design once, export to every device" needs either per-device layouts or a constraint system, and that's far more than an MVP should carry for a tool whose core loop is "choose size → add text → align → export".

## Considered Options

- **One design exported to many resolutions**: rejected for the MVP. It would need per-device layout overrides or Figma-style constraints, and storage in relative units instead of real pixels.

## Consequences

- Re-fitting is lossy: switching from a desktop resolution to a phone and back does not restore the original layout (the scale factors differ each way). Undo restores it.
