import { datasetCatalogues } from "@/lib/providers/urls";
export async function GET() {
  return Response.json({
    catalogues: datasetCatalogues(),
    importedByThisEndpoint: 0,
    importTool: "scripts/index/import-patents.mjs",
    limitations:
      "Links only. Import requires locally downloaded, licensed, normalized PatentRecord JSONL. Raw USPTO/PatentsView TSV/ZIP parsing and automatic downloads are not implemented.",
  });
}
