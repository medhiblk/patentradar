import { ProfileSchema } from "@formaproof/contracts";
import type { AssemblySpec } from "@formaproof/engineering";
/** Draft from actual editable parts. Never executes search or invents functions. */
export function designResearchDraft(spec: AssemblySpec) {
  const parts = spec.components.slice(0, 20);
  if (!parts.length) return null;
  const keywords = [...new Set(parts.map(p => p.name.trim()).filter(Boolean))].slice(0, 12).map(name => name.slice(0, 150));
  const profile = ProfileSchema.parse({
    title: spec.title || "Conception à étudier", domain: "Conception mécanique — domaine à vérifier",
    operatingPrinciple: spec.goal || "Fonctionnement à préciser à partir des composants sélectionnés.",
    technicalFeatures: parts.map(p => ({ name: p.name, description: (p.description || "Composant de l’assemblage ; sa fonction doit être précisée avant la recherche.").slice(0, 1500) })),
    searchKeywords: keywords,
  });
  return { profile, query: keywords.slice(0, 3).join(" ").slice(0, 150) };
}
