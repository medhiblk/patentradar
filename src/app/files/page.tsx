import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { PrivateWorkspace } from "@/components/private-workspace";
export default function Files() {
  return (
    <main className="developer-page">
      <nav className="row between wrap">
        <Link href="/">{BRAND.name}.</Link>
        <Link href="/engineering">3D Studio ↗</Link>
        <Link href="/developers">API & MCP ↗</Link>
      </nav>
      <PrivateWorkspace />
    </main>
  );
}
