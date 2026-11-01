/** Structured data (schema.org JSON-LD) for search engines. */
export function JsonLd({ data }: { data: object }) {
  // Escaping "<" keeps any text in the data from closing the script element.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
