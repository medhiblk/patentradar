import type { Metadata } from "next";
import { SpotWorkspace } from "@/components/spot-workspace";
export const metadata: Metadata = { title: "Check a PDF for patents — FormaProof", description: "Upload a technical PDF, identify patent publications and inspect matching source evidence." };
export default async function Spot({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const params = await searchParams;
  return <SpotWorkspace fromDesign={params.from === "design"} />;
}
