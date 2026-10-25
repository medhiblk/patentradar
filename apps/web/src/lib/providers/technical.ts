import { z } from "zod";
import { request } from "./http";
import type { CitationRecord, PatentReference } from "./contracts";
import { normalizePublication } from "../normalize";
export async function compoundPatents(cid: string): Promise<PatentReference[]> {
  if (!/^\d{1,10}$/.test(cid)) throw new Error("Invalid compound CID");
  const url =
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" +
    cid +
    "/xrefs/PatentID/JSON";
  const data = z
    .object({
      InformationList: z.object({
        Information: z.array(
          z.object({ PatentID: z.array(z.string()).optional() }),
        ),
      }),
    })
    .parse(JSON.parse(await request("pubchem", url)));
  const ids = [
    ...new Set(
      data.InformationList.Information.flatMap((r) => r.PatentID || []),
    ),
  ];
  return ids
    .flatMap((id) => {
      try {
        const number = normalizePublication(id);
        return [
          {
            publicationNumber: number,
            jurisdiction: number.slice(0, 2),
            source: "PubChem patent cross-reference; not full patent metadata",
            sourceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/" + cid,
            retrievedAt: new Date().toISOString(),
          },
        ];
      } catch {
        return [];
      }
    })
    .slice(0, 100);
}
export async function compoundProperties(name: string) {
  const url =
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" +
    encodeURIComponent(name) +
    "/property/MolecularFormula,MolecularWeight/JSON";
  const data = z
    .object({
      PropertyTable: z.object({
        Properties: z.array(
          z.object({
            CID: z.number(),
            MolecularFormula: z.string().optional(),
            MolecularWeight: z.union([z.string(), z.number()]).optional(),
          }),
        ),
      }),
    })
    .parse(JSON.parse(await request("pubchem", url)));
  return {
    properties: data.PropertyTable.Properties,
    source: "PubChem",
    sourceUrl: url,
    retrievedAt: new Date().toISOString(),
  };
}
export async function citations(
  doi: string,
  direction: "citations" | "references",
): Promise<CitationRecord[]> {
  if (!/^10\.\d{4,9}\/.{1,200}$/.test(doi)) throw new Error("Invalid DOI");
  const url =
    "https://api.opencitations.net/index/v2/" +
    direction +
    "/doi:" +
    encodeURIComponent(doi);
  const data = z
    .array(z.object({ oci: z.string(), citing: z.string(), cited: z.string() }))
    .parse(JSON.parse(await request("opencitations", url)));
  return data
    .slice(0, 100)
    .map((c) => ({
      id: c.oci,
      citing: c.citing,
      cited: c.cited,
      source: "OpenCitations Index / CC0",
      sourceUrl: url,
      retrievedAt: new Date().toISOString(),
    }));
}
export async function structure(pdb: string) {
  if (!/^[0-9][a-zA-Z0-9]{3}$/.test(pdb))
    throw new Error("Invalid PDB identifier");
  const id = pdb.toUpperCase();
  const data = z
    .object({
      entry: z.object({ id: z.string() }),
      struct: z.object({ title: z.string() }),
      exptl: z.array(z.object({ method: z.string() })).optional(),
    })
    .parse(
      JSON.parse(
        await request("rcsb", "https://data.rcsb.org/rest/v1/core/entry/" + id),
      ),
    );
  return [
    {
      id: data.entry.id,
      title: data.struct.title,
      source: "RCSB PDB / CC0 structure metadata",
      method: data.exptl?.map((r) => r.method).join(", "),
      sourceUrl: "https://www.rcsb.org/structure/" + id,
      retrievedAt: new Date().toISOString(),
    },
  ];
}
