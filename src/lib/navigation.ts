export const workspaceRoutes: Record<string, string> = {
  Overview: "",
  "Engineering Studio": "studio",
  "New Analysis": "analyze",
  "Patent Search": "patents",
  "My Inventions": "projects",
  Reports: "reports",
  "Account & Monitoring": "account",
  "API Providers": "sources",
  "Patent Results": "results",
  "Claim Comparison": "comparison",
  "Competitor Intelligence": "competitors",
  "Technology Landscape": "landscape",
  "Physical Analysis": "physical",
};
export function pageFromHash(hash: string) {
  return (
    Object.entries(workspaceRoutes).find(
      ([, slug]) => slug === hash.replace(/^#/, ""),
    )?.[0] || "Overview"
  );
}
export function workspaceHref(page: string) {
  return "/" + (workspaceRoutes[page] ? "#" + workspaceRoutes[page] : "");
}
