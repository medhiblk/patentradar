import { designResearchDraft } from "./design-research";
import { peekDesignSession, type DesignSession } from "./design-session";

/** Explicit engineering brief: functions and relationships, never a dimension-based query. */
export function designFunctionText(session: DesignSession) {
  return [
    "Current user design — editable engineering brief, not an original PDF page.",
    session.spec.title,
    session.spec.goal ? `Intended function: ${session.spec.goal}` : "Intended function must be reviewed by the user.",
    ...session.spec.components.map(part => [
      `Component: ${part.name}`,
      `Function/description supplied for this design: ${part.description || "Function not specified; user review required."}`,
      ...(part.connections.length ? [`Declared relationships (not mechanically validated): ${part.connections.join("; ")}`] : []),
    ].join("\n")),
  ].filter(Boolean).join("\n\n");
}

/** In-memory intake for Spot. No provider call, upload or confidential browser storage. */
export function makeSpotDesignPages(session: DesignSession | null = peekDesignSession()) {
  if (!session) return null;
  const draft = designResearchDraft(session.spec);
  if (!draft) return null;
  const designText = designFunctionText(session);
  const sourceExcerpts = session.spec.components
    .filter(part => part.basis === "source-text" && part.sourceQuote.trim() && part.sourceHash && part.sourceHash === session.source.hash)
    .map(part => ({ page: part.sourcePage, text: part.sourceQuote, sourceName: part.sourceName || session.source.name, sourceHash: part.sourceHash! }));
  return {
    // These numbered pages belong to this supplied design brief, not its source PDF.
    pages: [{ page: 1, text: designText.slice(0, 40000) }],
    sourceLabel: "user-design" as const,
    designText,
    documentPages: session.documentPages?.map(page => ({ ...page })) || [],
    sourceExcerpts,
    sourceFile: session.sourceFile,
    profile: draft.profile,
    query: draft.query,
    requiresReview: true,
  };
}
