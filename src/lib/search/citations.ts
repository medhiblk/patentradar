import type { PatentRecord } from "../providers/types";
export function citationGraph(
  records: PatentRecord[],
  seeds: string[],
  hops: 1 | 2 = 1,
) {
  const edges = records.flatMap((r) => r.citations || []);
  const visited = new Set(seeds.slice(0, 50));
  const selected = new Map<string, (typeof edges)[number]>();
  let frontier = new Set(visited),
    truncated = seeds.length > 50;
  for (let hop = 0; hop < hops; hop++) {
    const next = new Set<string>();
    for (const e of edges) {
      if (!frontier.has(e.from) && !frontier.has(e.to)) continue;
      const additions = [e.from, e.to].filter((id) => !visited.has(id));
      if (visited.size + additions.length > 50 || selected.size >= 100) {
        truncated = true;
        continue;
      }
      selected.set(e.from + ">" + e.to, e);
      for (const id of additions) {
        visited.add(id);
        next.add(id);
      }
    }
    frontier = next;
  }
  return {
    nodes: [...visited],
    edges: [...selected.values()],
    truncated,
    hops,
  };
}
