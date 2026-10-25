"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { ComponentSpec } from "@/lib/cad/schema";
export type MeshPart = {
  id: string;
  stl: string;
  volume: number;
  valid: boolean;
  bounds: number[];
};
export function CADViewer({
  parts,
  components,
  selected,
  hidden,
  isolated,
  explode,
  animate,
  onSelect,
  onMove,
}: {
  parts: MeshPart[];
  components: ComponentSpec[];
  selected: string;
  hidden: string[];
  isolated: boolean;
  explode: number;
  animate: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: [number, number, number]) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    meshes = useRef(new Map<string, THREE.Mesh>()),
    gizmo = useRef<TransformControls | null>(null);
  const latest = useRef({
    components,
    selected,
    hidden,
    isolated,
    explode,
    animate,
    onSelect,
    onMove,
  });
  useEffect(() => {
    latest.current = {
      components,
      selected,
      hidden,
      isolated,
      explode,
      animate,
      onSelect,
      onMove,
    };
  });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.textContent =
        "WebGL unavailable. Parametric editing and STEP/STL exports remain available.";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive mechanical assembly",
    );
    const meshMap = meshes.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9ede9");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
    camera.up.set(0, 0, 1);
    camera.position.set(180, -200, 160);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x69817a, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(100, -100, 200);
    scene.add(light);
    const grid = new THREE.GridHelper(2000, 40, 0xa9b8ad, 0xd1d9d1);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -50;
    scene.add(grid);
    const group = new THREE.Group();
    scene.add(group);
    const loader = new STLLoader();
    meshes.current.clear();
    const colors = ["#476b5a", "#bd8a5b", "#718bb2", "#976b95", "#8f9e62"];
    parts.forEach((part, index) => {
      const bytes = Uint8Array.from(atob(part.stl), (c) => c.charCodeAt(0));
      const geometry = loader.parse(bytes.buffer);
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        metalness: 0.32,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.id = part.id;
      group.add(mesh);
      meshes.current.set(part.id, mesh);
      const c = latest.current.components.find((c) => c.id === part.id);
      if (c) {
        mesh.position.set(...c.position);
        mesh.rotation.set(
          ...(c.rotation.map((v) => THREE.MathUtils.degToRad(v)) as [
            number,
            number,
            number,
          ]),
        );
      }
    });
    const bounds = new THREE.Box3().setFromObject(group);
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3()),
        size = bounds.getSize(new THREE.Vector3()).length();
      orbit.target.copy(center);
      camera.position.copy(
        center.clone().add(new THREE.Vector3(size, -size, size * 0.8)),
      );
      camera.far = Math.max(20000, size * 20);
      camera.updateProjectionMatrix();
    }
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    gizmo.current = transform;
    scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed", (e) => {
      orbit.enabled = !e.value;
    });
    transform.addEventListener("mouseUp", () => {
      const object = transform.object;
      if (object)
        latest.current.onMove(object.userData.id, [
          object.position.x,
          object.position.y,
          object.position.z,
        ]);
    });
    const ray = new THREE.Raycaster();
    let down: [number, number] = [0, 0];
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const pointerUp = (e: PointerEvent) => {
      if (
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 ||
        transform.dragging
      )
        return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(
        [...meshes.current.values()].filter((m) => m.visible),
      )[0];
      if (hit) latest.current.onSelect(hit.object.userData.id);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const p = latest.current;
      parts.forEach((part, index) => {
        const mesh = meshes.current.get(part.id),
          c = p.components.find((c) => c.id === part.id);
        if (!mesh || !c) return;
        mesh.visible =
          !p.hidden.includes(c.id) && (!p.isolated || p.selected === c.id);
        if (!transform.dragging) {
          mesh.position.set(
            c.position[0] + p.explode * index * 25,
            c.position[1] + p.explode * index * 15,
            c.position[2] + p.explode * index * 12,
          );
          mesh.rotation.set(
            ...(c.rotation.map((v) => THREE.MathUtils.degToRad(v)) as [
              number,
              number,
              number,
            ]),
          );
          if (p.animate && p.selected === c.id)
            mesh.rotation.z += performance.now() / 1000;
        }
        (mesh.material as THREE.MeshStandardMaterial).emissive.set(
          p.selected === c.id ? "#28392f" : "#000000",
        );
      });
      const chosen = meshes.current.get(p.selected);
      if (chosen && chosen.visible && !p.explode && !p.animate) {
        if (transform.object !== chosen) transform.attach(chosen);
      } else transform.detach();
      orbit.update();
      renderer.render(scene, camera);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      transform.dispose();
      orbit.dispose();
      meshMap.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      meshMap.clear();
      renderer.dispose();
      renderer.domElement.remove();
      gizmo.current = null;
    };
  }, [parts]);
  return (
    <div
      className="cad-canvas"
      ref={host}
      role="img"
      aria-label="3D assembly viewer: orbit with mouse, zoom with wheel, select parts and drag axes"
    />
  );
}
