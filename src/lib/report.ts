import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { disclaimer, type Research } from "./model";
import { compare, triage } from "./compare";
export function reportSections(data: Research) {
  return [
    [
      "Executive summary",
      `${data.mode} analysis of ${data.profile.title}. ${data.patents.length} patent records and ${data.papers.length} scientific works retrieved. ${disclaimer}`,
    ],
    [
      "Technical invention profile",
      `${data.profile.domain}\n${data.profile.operatingPrinciple}\n${data.profile.technicalFeatures.map((f) => f.name + ": " + f.description).join("\n")}`,
    ],
    [
      "Search methodology",
      `Executed queries: ${data.queries.join("; ")}. Keyword-based public patent-metadata and literature discovery, plus exact EP publication lookup when supplied. OpenAIRE metadata is normalized; credit OpenAIRE Graph and upstream Lens. CC-BY licensing: https://graph.openaire.eu/faq . Other content rights remain source-specific. Ranking is the average proportion of distinct feature terms shared with the best available evidence excerpt; no semantic or legal inference.`,
    ],
    [
      "Data sources",
      [
        ...new Set([
          ...data.patents.map((p) => p.source),
          ...data.papers.map((p) => p.source),
        ]),
      ].join(", ") || "No external sources",
    ],
    [
      "Patent shortlist",
      data.patents
        .map(
          (p) =>
            `${p.publicationNumber} — ${p.title}\n${p.synthetic ? "SYNTHETIC DEMO — NOT A REAL PATENT. " : ""}${p.source}; retrieved ${p.retrievedAt}\n${triage(data.profile, p).priority}. ${triage(data.profile, p).applicant}\nPatent PDF: ${p.pdfUrl || "Unavailable"}\n${p.sourceUrl}\n${(p.additionalSources || []).map((s) => s.name + ": " + s.url).join("\n")}`,
        )
        .join("\n\n") || "No patent evidence retrieved.",
    ],
    [
      "Technical comparison",
      data.patents
        .map((p) => {
          const c = compare(data.profile, p);
          return `${p.publicationNumber}: ${c.score}% lexical relevance. ${c.limitation}\n${c.matches.map((m) => `${m.feature}: ${m.strength}. ${m.explanation}\nExcerpt: ${m.excerpt}`).join("\n")}`;
        })
        .join("\n\n") || "No patent comparison available.",
    ],
    [
      "Competitor landscape",
      data.patents.flatMap((p) => p.applicants).join(", ") +
        "\nRetrieved sample only; not a complete competitive landscape.",
    ],
    ["Research limitations", data.warnings.join("\n")],
    [
      "Recommended follow-up research",
      "Validate claims, family members, priority dates and legal status with authorized sources. Expand applicant aliases and multilingual searches. Consult qualified patent counsel for legal assessment.",
    ],
    [
      "Source references",
      [
        ...data.patents.map(
          (p) => `${p.publicationNumber}: ${p.sourceUrl} (${p.retrievedAt})`,
        ),
        ...data.papers.map(
          (p) => `${p.title}: ${p.sourceUrl} (${p.source}, ${p.retrievedAt})`,
        ),
      ].join("\n"),
    ],
  ];
}
export async function createReport(data: Research) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage();
  let y = 790;
  const line = (s: string, heading = false) => {
    if (y < 55) {
      page = doc.addPage();
      y = 790;
    }
    page.drawText(s, {
      x: 45,
      y,
      size: heading ? 13 : 10,
      font: heading ? bold : font,
      color: rgb(0.08, 0.15, 0.25),
    });
    y -= heading ? 23 : 15;
  };
  const ascii = (s: string) => s.replace(/[^\x20-\x7E\n]/g, "?");
  line("Format Proof | Patent intelligence report", true);
  line(`Generated ${new Date().toISOString()} | ${data.mode}`);
  for (const [title, body] of reportSections(data)) {
    y -= 12;
    line(title, true);
    for (const paragraph of ascii(body).split("\n")) {
      let current = "";
      for (const word of paragraph.split(" ")) {
        for (let start = 0; start < word.length || start === 0; start += 85) {
          const part = word.slice(start, start + 85);
          if (font.widthOfTextAtSize(current + " " + part, 10) > 500) {
            line(current);
            current = part;
          } else current += (current ? " " : "") + part;
        }
      }
      line(current);
    }
  }
  return doc.save();
}
