import { z } from "zod";
import type { PatentRecord } from "../providers/types";
import { normalizeApplicant } from "../normalize";
import { entityKey, normalizeMultilingual } from "../providers/normalization";

/** Corporate equivalence is only applied when explicitly confirmed by the user. */
export const ConfirmedApplicantAliasSchema = z.object({
  name: z.string().trim().min(1).max(200),
  aliases: z.array(z.string().trim().min(1).max(200)).max(20),
  confirmed: z.literal(true),
}).strict();
export type ConfirmedApplicantAlias = z.infer<typeof ConfirmedApplicantAliasSchema>;
export type ApplicantActivity = { name: string; count: number; aliases: string[] };
const key = (name: string) => entityKey(normalizeApplicant(name));
export function applicantActivity(patents: PatentRecord[], confirmedAliases: ConfirmedApplicantAlias[] = []): ApplicantActivity[] {
  const aliases = new Map<string, string>();
  const names = new Map<string, string>();
  for (const input of confirmedAliases) {
    const group = ConfirmedApplicantAliasSchema.parse(input);
    const canonical = key(group.name);
    names.set(canonical, normalizeMultilingual(group.name));
    for (const name of [group.name, ...group.aliases]) {
      const candidate = key(name);
      if (aliases.has(candidate) && aliases.get(candidate) !== canonical)
        throw new Error("An applicant alias cannot belong to two confirmed groups.");
      aliases.set(candidate, canonical);
    }
  }
  const groups = new Map<string, ApplicantActivity>();
  const publications = new Map<string, Set<string>>();
  for (const patent of patents) {
    for (const raw of patent.applicants) {
      const label = normalizeMultilingual(raw);
      if (!label) continue;
      const canonical = aliases.get(key(label)) || key(label);
      const group = groups.get(canonical) || { name: names.get(canonical) || label, count: 0, aliases: [] };
      if (!group.aliases.includes(label)) group.aliases.push(label);
      const seen = publications.get(canonical) || new Set<string>();
      seen.add(patent.publicationNumber);
      publications.set(canonical, seen);
      group.count = seen.size;
      groups.set(canonical, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
