/**
 * Reads a hex colour as typed or pasted: "#RRGGBB" or "#RGB", in any case, with
 * or without the "#" and surrounding spaces. Returns it as uppercase "#RRGGBB",
 * or null when it isn't a hex colour. Alpha isn't accepted: colours are solid.
 */
export function parseHexColor(input: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return `#${digits.toUpperCase()}`;
}
