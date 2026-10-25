"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { workspaceHref } from "@/lib/navigation";
export function AppNavigation({
  page = "Overview",
  onNavigate,
}: {
  page?: string;
  onNavigate?: (page: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLDetailsElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (more.current) more.current.open = false;
      }
    };
    const outside = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) {
        setOpen(false);
        if (more.current) more.current.open = false;
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  function go(target: string) {
    setOpen(false);
    if (more.current) more.current.open = false;
    onNavigate?.(target);
  }
  function destination(
    target: string,
    label: string,
    accessibleLabel?: string,
  ) {
    const active =
      page === target ||
      (target === "Patent Search" &&
        ["New Analysis", "Patent Results", "Claim Comparison"].includes(page));
    const href =
      target === "Engineering Studio" ? "/engineering" : workspaceHref(target);
    return onNavigate ? (
      <button
        key={target}
        type="button"
        aria-label={accessibleLabel}
        aria-current={active ? "page" : undefined}
        className={active ? "current" : ""}
        onClick={() => go(target)}
      >
        {label}
      </button>
    ) : (
      <a
        key={target}
        href={href}
        aria-label={accessibleLabel}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </a>
    );
  }
  return (
    <header className="app-navigation" ref={header}>
      <Link
        prefetch={false}
        className="app-brand"
        href="/"
        aria-label={`${BRAND.name} home`}
        onClick={
          onNavigate
            ? (e) => {
                e.preventDefault();
                go("Overview");
              }
            : undefined
        }
      >
        <span className="brand-mark" aria-hidden="true">
          f
        </span>
        {BRAND.name}
        <span className="brand-context">engineering workspace</span>
      </Link>
      <nav
        id="app-navigation-menu"
        className={"app-nav-links" + (open ? " is-open" : "")}
        aria-label="Main navigation"
      >
        {destination("Engineering Studio", "3D Studio", "Engineering Studio")}
        {destination("Patent Search", "Patent Explorer")}
        {destination("My Inventions", "My Inventions")}
        {destination("Reports", "Reports")}
        <details className="nav-more" ref={more}>
          <summary>
            More <ChevronDown size={12} />
          </summary>
          <div className="nav-popover">
            <span className="nav-group-label">YOUR WORKSPACE</span>
            <a href="/files">Files & storage</a>
            {destination("Account & Monitoring", "Account")}
            <span className="nav-group-label">RESOURCES</span>
            {destination("API Providers", "Data sources")}
            <a href="/developers">
              API & MCP <ArrowUpRight size={12} />
            </a>
            <a
              href="https://github.com/medhiblk/patentradar"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ArrowUpRight size={12} />
            </a>
          </div>
        </details>
      </nav>
      <div className="app-nav-actions">
        <a href="/files" className="nav-workspace-link">
          My workspace <ArrowUpRight size={13} />
        </a>
        <button
          type="button"
          className="app-menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="app-navigation-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}
