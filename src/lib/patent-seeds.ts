export function patentSeed(input: string) {
  const normalized = input.normalize('NFKC').toUpperCase().replace(/[\s,./-]/g, '');
  const match = /^(EP|US|CN|JP|WO|KR|GB|DE|FR|CA|AU)(\d{5,14})([A-Z]\d?)?$/.exec(normalized);
  if (!match) throw new Error(`Invalid publication number: ${input}`);
  return { publicationNumber: normalized, jurisdiction: match[1], number: match[2], kindCode: match[3] || null, referenceUrl: `https://patents.google.com/patent/${normalized}/en` };
}
export function parseSeeds(input: string) {
  const entries = input.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
  if (entries.length > 10) throw new Error('Use at most 10 publication numbers.');
  return [...new Map(entries.map(s => { const p = patentSeed(s); return [p.publicationNumber, p] as const; })).values()];
}
