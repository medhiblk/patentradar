import endpoints from "./catalogue.json";
export const endpointCatalogue = endpoints;
export function eligibilitySummary() {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of endpoints) counts[row.tier as keyof typeof counts]++;
  return {
    endpoints: endpoints.length,
    providerFamilies: new Set(endpoints.map((p) => p.provider)).size,
    tiers: counts,
    note: "Verification is a dated observation; Tier A applies only to the declared metadata/retrieval scope, licence and quota. Endpoint count is not provider count.",
  };
}
export function isDefaultEligible(provider: string) {
  return endpoints.some((e) => e.provider === provider && e.tier === "A");
}
