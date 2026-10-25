import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { disclaimer, type Research } from "./model";
import { compare, triage } from "./compare";
import { evidenceBasis, passageSource } from "./intelligence/evidence";
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
      [
        data.searchTrace?.context === "known-reference"
          ? "Known-reference comparison against a preselected real publication snapshot. No live worldwide search or BigQuery query was performed."
          : data.searchTrace
            ? "Provider execution history recorded for this analysis. Counts describe returned records before cross-provider deduplication and shortlist limits."
            : "No provider execution history was recorded for this analysis; do not infer which databases were queried from reference links alone.",
        "Reported queries: " + data.queries.join("; "),
        ...(data.searchTrace?.providers.map(
          (run) =>
            `${run.name}: ${run.status}; ${run.method}; ${run.patentsRetrieved} patents, ${run.papersRetrieved} scientific records. Queries: ${run.queries.join("; ")}. ${run.coverage}\n${run.requests.map((request) => `${request.endpoint}: ${request.servedFrom}; ${request.httpStatus ? "HTTP " + request.httpStatus : "HTTP status not recorded"}${request.errorCode ? "; " + request.errorCode : ""}`).join("\n")}`,
        ) || []),
        ...(data.searchTrace?.notQueried.map(
          (run) => "NOT QUERIED - " + run.name + ": " + run.reason,
        ) || []),
        data.ranking?.method === "ai-assisted"
          ? `Shortlist order was reviewed with AI at ${data.ranking.appliedAt}; underlying evidence and lexical scores remain unchanged. AI explanations are technical assessments, not legal conclusions.`
          : "Ranking is lexical feature-term overlap, not a semantic or legal conclusion.",
        "OpenAIRE metadata, where returned, credits OpenAIRE Graph and upstream Lens; CC-BY information: https://graph.openaire.eu/faq . Other content rights remain source-specific.",
      ].join("\n"),
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
            `${p.publicationNumber} — ${p.title}\n${p.synthetic ? "SYNTHETIC DEMO — NOT A REAL PATENT. " : ""}${p.source}; retrieved ${p.retrievedAt}\n${data.ranking?.entries.find((entry) => entry.publicationNumber === p.publicationNumber)?.reason || "Lexical ranking; no AI ranking explanation."}\n${triage(data.profile, p).priority}. ${triage(data.profile, p).applicant}\nPatent PDF: ${p.pdfUrl || "Unavailable"}\n${p.sourceUrl}\n${(p.additionalSources || []).map((s) => s.name + ": " + s.url).join("\n")}`,
        )
        .join("\n\n") || "No patent evidence retrieved.",
    ],
    [
      "Technical comparison",
      data.patents
        .map((p) => {
          const c = compare(data.profile, p);
          return `${p.publicationNumber}: ${c.score}% lexical relevance. Evidence: ${evidenceBasis(p)}. ${c.limitation}\n${c.matches
            .map((m) => {
              const source = passageSource(p, m.excerpt);
              return `${m.feature}: ${m.strength}. ${m.explanation}\n${m.claimIndex === undefined ? m.evidenceField : "Claim index " + m.claimIndex}; original character offsets ${m.start}-${m.end}. Excerpt: ${m.excerpt}\n${source.verified ? "Passage source" : "Record source; passage attribution unavailable"}: ${source.source}; ${source.url}${source.page ? "; original PDF page " + source.page : ""}; retrieved ${source.retrievedAt}`;
            })
            .join("\n")}`;
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
  line("PatentRadar | Patent intelligence report", true);
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
