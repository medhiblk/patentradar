"use client";
import "./shell/shell.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
/** Public site navigation. Work tools belong to WorkspaceNavigation. */
export function AppNavigation({
  page = "Overview",
  onNavigate,
}: {
  page?: string;
  onNavigate?: (page: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (header.current?.contains(document.activeElement))
          toggle.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  return (
    <header className="app-navigation public-navigation" ref={header}>
      <Link
        prefetch={false}
        className="app-brand"
        href="/"
        aria-label={`${BRAND.name} home`}
        onClick={
          onNavigate
            ? (event) => {
                event.preventDefault();
                setOpen(false);
                onNavigate("Overview");
              }
            : undefined
        }
      >
        <span className="brand-mark" aria-hidden="true">
          f
        </span>
        {BRAND.name}
      </Link>
      <nav
        id="app-navigation-menu"
        className={"app-nav-links" + (open ? " is-open" : "")}
        aria-label="Main navigation"
      >
        <a href="/files" aria-current={page === "Files" ? "page" : undefined}>
          My files
        </a>
        <a
          href="/connect"
          aria-current={page === "Connect" ? "page" : undefined}
        >
          ChatGPT
        </a>
      </nav>
      <div className="app-nav-actions">
        <a href="/spot" className="nav-workspace-link">
          Check PDF <ArrowUpRight size={13} />
        </a>
        <button
          ref={toggle}
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
