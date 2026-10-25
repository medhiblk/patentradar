"use client";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EngineeringStudio } from "@/components/engineering-studio";
export default function Engineering() {
  const router = useRouter();
  return (
    <main className="engineering-page">
      <nav className="row between">
        <Link href="/">{BRAND.name}.</Link>
        <div className="row wrap">
          <Link href="/files">Private files</Link>
          <Link href="/developers">API & MCP</Link>
          <a
            href="https://github.com/medhiblk/patentradar"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </nav>
      <EngineeringStudio
        onPatentResearch={(text) => {
          sessionStorage.setItem("patentradar-engineering-handoff", text);
          router.push("/");
        }}
      />
    </main>
  );
}
