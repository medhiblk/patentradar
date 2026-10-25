/** A job may complete only against the exact design state it received. */
export class DesignRevision {
  private revision = 0;
  changed() { this.revision += 1; }
  capture() { return this.revision; }
  assertCurrent(snapshot: number) {
    if (snapshot !== this.revision)
      throw new Error("The design changed during calculation. Rebuild the current design before exporting.");
  }
}
export async function currentDesignResult<T>(revision: DesignRevision, compute: () => Promise<T>) {
  const snapshot = revision.capture();
  const value = await compute();
  revision.assertCurrent(snapshot);
  return { value, revision: snapshot };
}
