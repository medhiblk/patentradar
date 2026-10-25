export async function pdfTextPages(raw: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: raw,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const doc = await task.promise;
  try {
    if (doc.numPages > 80) throw new Error("PDF exceeds 80 pages");
    const pages = [];
    let total = 0;
    for (let page = 1; page <= Math.min(doc.numPages, 20); page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item
            ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
            : "",
        )
        .join("")
        .slice(0, 8000);
      total += text.length;
      pages.push({ page, text });
      if (total > 60000) break;
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
