/** STEP assemblies are never silently truncated to the editor's part limit. */
export function requireSupportedStepSolids<T>(solids: T[]): T[] {
  if (!solids.length) throw new Error("No supported STEP solids");
  if (solids.length > 20)
    throw new Error(`This STEP contains ${solids.length} solids. The editor supports at most 20; split the file in your CAD tool before importing. No parts were imported.`);
  return solids;
}
