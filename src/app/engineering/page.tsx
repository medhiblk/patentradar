"use client";
import dynamic from "next/dynamic";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { useRouter } from "next/navigation";
const EngineeringStudio = dynamic(
  () =>
    import("@/components/engineering-studio").then((m) => m.EngineeringStudio),
  {
    ssr: false,
    loading: () => (
      <p className="workspace-loading" role="status">
        Opening 3D Studio…
      </p>
    ),
  },
);
export default function Engineering() {
  const router = useRouter();
  return (
    <WorkspaceShell page="Engineering Studio">
      <main className="engineering-page" id="main-content">
        <EngineeringStudio
          onPatentResearch={(text) => {
            sessionStorage.setItem("patentradar-engineering-handoff", text);
            router.push("/");
          }}
        />
      </main>
    </WorkspaceShell>
  );
}
