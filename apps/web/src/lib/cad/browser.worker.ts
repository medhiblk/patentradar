/// <reference lib="webworker" />
import * as cad from "replicad";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import { AssemblySchema, buildable, type ComponentSpec } from "./schema";
let initialized: Promise<OpenCascadeInstance> | undefined;
async function kernel() {
  return (initialized ||= (async () => {
    const url = "/cad-kernel/replicad_single.js";
    const runtimeModule = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ url
    );
    const oc: OpenCascadeInstance = await runtimeModule.default({
      locateFile: () => "/cad-kernel/replicad_single.wasm",
    });
    cad.setOC(oc);
    return oc;
  })());
}
async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function primitive(p: ComponentSpec): cad.Shape3D {
  if (!buildable(p)) throw new Error("Required dimensions are missing");
  const d = p.dimensions;
  if (p.shape === "box") {
    const box = cad.makeBox(
      [-d.length! / 2, -d.width! / 2, -d.height! / 2],
      [d.length! / 2, d.width! / 2, d.height! / 2],
    );
    if (!p.pocket) return box;
    const { wall, floor } = p.pocket;
    const cavity = cad.makeBox(
      [-d.length! / 2 + wall, -d.width! / 2 + wall, -d.height! / 2 + floor],
      [d.length! / 2 - wall, d.width! / 2 - wall, d.height! / 2 + 1],
    );
    try {
      return box.cut(cavity);
    } finally {
      cavity.delete();
      box.delete();
    }
  }
  const outer = cad.makeCylinder(d.diameter! / 2, d.length!, [
    0,
    0,
    -d.length! / 2,
  ]);
  if (p.shape === "tube") {
    if (d.innerDiameter! >= d.diameter!)
      throw new Error("Inner diameter must be smaller than the outer diameter");
    const bore = cad.makeCylinder(d.innerDiameter! / 2, d.length!, [
      0,
      0,
      -d.length! / 2,
    ]);
    try {
      return outer.cut(bore);
    } finally {
      bore.delete();
    }
  }
  return outer;
}
self.onmessage = async (event: MessageEvent) => {
  const { id, action, payload } = event.data;
  const cleanup: cad.AnyShape[] = [];
  try {
    const oc = await kernel();
    let shapes: {
      id: string;
      name: string;
      shape: cad.Shape3D;
      position: [number, number, number];
      rotation: [number, number, number];
    }[] = [];
    if (action === "build") {
      const spec = AssemblySchema.parse(payload);
      if (!spec.components.length) throw new Error("No components");
      const loaded = new Map<File, cad.Shape3D[]>();
      for (const p of spec.components) {
        const source = payload.imports?.[p.id];
        let shape: cad.Shape3D;
        if (source) {
          if (
            !(source.file instanceof Blob) ||
            source.file.size > 4 * 1024 * 1024 ||
            !Number.isInteger(source.solidIndex) ||
            source.solidIndex < 0 ||
            source.solidIndex >= 20
          )
            throw new Error("Invalid imported solid reference");
          if (!loaded.has(source.file)) {
            const imported = await cad.importSTEP(source.file);
            cleanup.push(imported);
            const solids = imported.solids.slice(0, 20);
            cleanup.push(...solids);
            loaded.set(source.file, solids);
          }
          const original = loaded.get(source.file)![source.solidIndex];
          if (!original)
            throw new Error("Imported solid no longer exists; reimport STEP");
          shape = original.clone();
        } else shape = primitive(p);
        cleanup.push(shape);
        shapes.push({ ...p, shape });
      }
    } else if (action === "import") {
      if (
        !(payload.file instanceof Blob) ||
        payload.file.size > 4 * 1024 * 1024
      )
        throw new Error("STEP file exceeds the limit");
      const imported = await cad.importSTEP(payload.file);
      cleanup.push(imported);
      const solids = imported.solids.slice(0, 20);
      if (!solids.length) throw new Error("No supported STEP solids");
      shapes = solids.map((shape, index) => {
        cleanup.push(shape);
        const item = payload.placements?.find(
          (p: { id: string }) => p.id === `part-${index + 1}`,
        );
        return {
          id: `part-${index + 1}`,
          name: `Imported part ${index + 1}`,
          shape,
          position: item?.position || [0, 0, 0],
          rotation: item?.rotation || [0, 0, 0],
        };
      });
    } else throw new Error("Unsupported operation");
    const parts = [];
    const placed: cad.Shape3D[] = [];
    for (const p of shapes) {
      const analyzer = new oc.BRepCheck_Analyzer(
        p.shape.wrapped,
        true,
        false,
        false,
      );
      const valid = analyzer.IsValid();
      analyzer.delete();
      if (!valid) throw new Error("Kernel rejected invalid geometry");
      const volume = cad.measureVolume(p.shape);
      if (!Number.isFinite(volume) || volume <= 0)
        throw new Error("Not a positive-volume solid");
      const bounds = p.shape.boundingBox;
      parts.push({
        id: p.id,
        stl: await base64(
          p.shape.blobSTL({
            binary: true,
            tolerance: 0.15,
            angularTolerance: 0.2,
          }),
        ),
        volume,
        valid,
        bounds: [bounds.width, bounds.height, bounds.depth],
      });
      bounds.delete();
      const moved = p.shape
        .clone()
        .rotate(p.rotation[0], [0, 0, 0], [1, 0, 0])
        .rotate(p.rotation[1], [0, 0, 0], [0, 1, 0])
        .rotate(p.rotation[2], [0, 0, 0], [0, 0, 1])
        .translate(p.position);
      placed.push(moved);
      cleanup.push(moved);
    }
    let exports = placed;
    if (payload.fuse) {
      let fused = placed[0].clone();
      cleanup.push(fused);
      for (const part of placed.slice(1)) {
        fused = fused.fuse(part);
        cleanup.push(fused);
      }
      const solidCount = fused.solids.length;
      if (solidCount !== 1)
        throw new Error(
          "Fusion needs touching or overlapping solids. Keep separate parts as an assembly or adjust their positions.",
        );
      const check = new oc.BRepCheck_Analyzer(
        fused.wrapped,
        true,
        false,
        false,
      );
      const valid = check.IsValid();
      check.delete();
      if (!valid) throw new Error("Fusion produced invalid geometry");
      exports = [fused];
    }
    const exportVolume = payload.fuse
      ? cad.measureVolume(exports[0])
      : undefined;
    const step = await base64(
      cad.exportSTEP(
        exports.map((shape, i) => ({
          shape,
          name: payload.fuse ? "Fused prototype" : shapes[i].name,
        })),
        { unit: "MM", modelUnit: "MM" },
      ),
    );
    const compound = cad.makeCompound(exports);
    cleanup.push(compound);
    const stl = await base64(
      compound.blobSTL({
        binary: true,
        tolerance: 0.15,
        angularTolerance: 0.2,
      }),
    );
    self.postMessage({
      id,
      result: {
        parts,
        step,
        stl,
        engine: "Replicad 1.2 / OpenCascade WASM — computed on your device",
        units: "mm",
        fused: !!payload.fuse,
        exportVolume,
        reconstructionStatus:
          "Measured primitive approximation; engineering validation required",
      },
    });
  } catch (e) {
    self.postMessage({
      id,
      error:
        e instanceof Error
          ? e.message
          : "CAD computation failed. Check parameters and browser memory.",
    });
  } finally {
    for (const shape of cleanup.reverse())
      try {
        shape.delete();
      } catch {
        /* OCP wrappers may share ownership. */
      }
  }
};
