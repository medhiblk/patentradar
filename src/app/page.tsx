"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home } from "@/components/home";
import { AppNavigation } from "@/components/app-navigation";
import { pageFromHash, workspaceHref } from "@/lib/navigation";
const Workspace = dynamic(() => import("@/components/research-workspace"), {
  ssr: false,
  loading: () => (
    <div className="workspace-loading" role="status">
      <span className="live-dot" />
      Opening your workspace…
    </div>
  ),
});
export default function HomePage() {
  const router = useRouter();
  const [entry, setEntry] = useState<{
    page: string;
    realPatent?: boolean;
  } | null>(null);
  useEffect(() => {
    const open = () => {
      const page = pageFromHash(window.location.hash);
      if (page !== "Overview") setEntry({ page });
    };
    const handoff = [
      "patentradar-private-file-handoff",
      "patentradar-engineering-handoff",
    ].some((key) => {
      try {
        return !!sessionStorage.getItem(key);
      } catch {
        return false;
      }
    });
    const frame = requestAnimationFrame(() => {
      if (handoff) setEntry({ page: "Overview" });
      else open();
    });
    window.addEventListener("hashchange", open);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", open);
    };
  }, []);
  function go(page: string) {
    if (page === "Engineering Studio") {
      router.push("/engineering");
      return;
    }
    window.history.pushState(null, "", workspaceHref(page));
    if (page !== "Overview") setEntry({ page });
  }
  return entry ? (
    <Workspace
      initialPage={entry.page}
      startWithRealPatent={!!entry.realPatent}
    />
  ) : (
    <div className="app">
      <AppNavigation onNavigate={go} />
      <main id="main-content" className="content home-content">
        <Home
          go={go}
          demo={() => setEntry({ page: "Overview", realPatent: true })}
          busy={false}
        />
      </main>
    </div>
  );
}
