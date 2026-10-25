import { ProfileSchema } from "@formaproof/contracts";
import type { AssemblySpec } from "@formaproof/engineering";
/** Draft from actual editable parts. Never executes search or invents functions. */
export function designResearchDraft(spec: AssemblySpec) {
  const parts = spec.components.slice(0, 20);
  if (!parts.length) return null;
  const keywords = [...new Set(parts.map(p => p.name.trim()).filter(Boolean))].slice(0, 12).map(name => name.slice(0, 150));
  const profile = ProfileSchema.parse({
    title: spec.title || "Design to investigate", domain: "Mechanical design — review the domain",
    operatingPrinciple: spec.goal || "Review the operating functions of the selected components.",
    technicalFeatures: parts.map(p => ({ name: p.name, description: (p.description || "Assembly component; review its function before searching.").slice(0, 1500) })),
    searchKeywords: keywords,
  });
  return { profile, query: keywords.slice(0, 3).join(" ").slice(0, 150) };
}
