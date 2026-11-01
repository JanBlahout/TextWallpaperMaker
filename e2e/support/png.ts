const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Reads a PNG's pixel dimensions from its IHDR chunk. */
export function pngSize(png: Buffer): { width: number; height: number } {
  if (!PNG_SIGNATURE.every((byte, i) => png[i] === byte)) throw new Error("Not a PNG file");
  if (png.toString("ascii", 12, 16) !== "IHDR") throw new Error("PNG has no IHDR chunk first");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
