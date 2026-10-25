import type { Metadata } from "next";
import { ProjectEntry } from "@/components/project-entry";
export const metadata: Metadata = { title: "Nouveau projet — FormaProof" };
export default async function Workspace({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal } = await searchParams;
  return <ProjectEntry initialGoal={goal === "design" ? "design" : "patents"} />;
}
