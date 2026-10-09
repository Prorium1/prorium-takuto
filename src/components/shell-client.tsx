"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Brand } from "./brand";
import type { Role } from "@/lib/domain/types";

export const reportSections = [
  ["summary", "Executive Summary"],
  ["performance", "Financial Performance"],
  ["drivers", "Why It Changed"],
  ["business", "Business Highlights"],
  ["ai", "AI Transformation"],
  ["position", "Financial Position"],
  ["forward", "Forward Indicators"],
  ["risks", "Risks & Actions"],
  ["ceo", "CEO Commentary"],
];
const mobileQuery = "(max-width: 900px)";
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getMobile = () => window.matchMedia(mobileQuery).matches;
const getServerMobile = () => false;

export function ShellClient({
  children,
  role,
  report = false,
  mock = false,
}: {
  children: React.ReactNode;
  role: Role;
  report?: boolean;
  mock?: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("summary");
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobile,
    getServerMobile,
  );
  const admin = path.startsWith("/admin");

  useEffect(() => {
    if (!report) return;
    const sections = reportSections
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    let frame: number | null = null;
    function updateReadingPosition() {
      frame = null;
      const readingLine = window.innerHeight * 0.4;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top > readingLine) break;
        current = section;
      }
      if (current) setActiveSection(current.id);
    }
    function scheduleUpdate() {
      if (frame === null) frame = requestAnimationFrame(updateReadingPosition);
    }
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [path, report]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const trigger = menuRef.current;
    const sidebar = sidebarRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus after the drawer becomes visible and the workspace becomes inert.
    const focusFrame = requestAnimationFrame(() => {
      sidebar
        ?.querySelector<HTMLElement>("a, button")
        ?.focus({ preventScroll: true });
    });
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !sidebar) return;
      const targets = [
        ...sidebar.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ),
      ].filter((element) => element.getClientRects().length > 0);
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = originalOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [isMobile, open]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        本文へ移動
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="メニューを閉じる"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="portal-navigation"
        ref={sidebarRef}
        className={`sidebar ${open ? "is-open" : ""}`}
        inert={isMobile && !open}
        aria-label="株主ポータル ナビゲーション"
      >
        <Link
          href="/dashboard"
          className="brand-link"
          onClick={() => setOpen(false)}
        >
          <Brand />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="メニューを閉じる"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <span className="nav-label">SHAREHOLDER PORTAL</span>
        <nav className="primary-nav" aria-label="メインナビゲーション">
          <Link
            className={
              path === "/dashboard" || path.startsWith("/reports/")
                ? "active"
                : ""
            }
            href="/dashboard"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard size={18} />
            <span>Monthly Report</span>
            <span className="nav-dot" />
          </Link>
          <Link
            className={path === "/reports" ? "active" : ""}
            href="/reports"
            onClick={() => setOpen(false)}
          >
            <Archive size={18} />
            <span>Report Archive</span>
          </Link>
          <Link
            href="/documents"
            className={path === "/documents" ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            <FileText size={18} />
            <span>Financial Documents</span>
          </Link>
          {role === "admin" && (
            <>
              <span className="nav-label admin-nav-label">MANAGEMENT</span>
              <Link
                className={path === "/admin/investors" ? "active" : ""}
                href="/admin/investors"
                onClick={() => setOpen(false)}
              >
                <ShieldCheck size={18} />
                <span>Investor Access</span>
              </Link>
              <Link
                className={
                  admin &&
                  path !== "/admin/import" &&
                  path !== "/admin/investors"
                    ? "active"
                    : ""
                }
                href="/admin"
                onClick={() => setOpen(false)}
              >
                <ShieldCheck size={18} />
                <span>Report Management</span>
              </Link>
              <Link
                className={path === "/admin/import" ? "active" : ""}
                href="/admin/import"
                onClick={() => setOpen(false)}
              >
                <Upload size={18} />
                <span>Data Import</span>
              </Link>
            </>
          )}
        </nav>
        {report && (
          <div className="contents-nav">
            <span className="nav-label">IN THIS REPORT</span>
            <nav aria-label="レポート目次">
              {reportSections.map(([id, name], i) => (
                <a
                  href={`#${id}`}
                  key={id}
                  className={activeSection === id ? "current" : ""}
                  aria-current={activeSection === id ? "location" : undefined}
                  onClick={() => {
                    setActiveSection(id);
                    setOpen(false);
                  }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {name}
                </a>
              ))}
            </nav>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="portal-note">
            <LockKeyhole size={16} />
            <span>
              株主限定ポータル
              <small>
                {mock
                  ? "Mock development environment"
                  : "Private investor portal"}
              </small>
            </span>
          </div>
          <form action={logoutAction}>
            <button className="logout-button">
              <LogOut size={15} />
              ログアウト
              <ArrowUpRight size={14} />
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace" inert={isMobile && open}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="mobile-menu icon-button"
              aria-label="メニューを開く"
              aria-expanded={open}
              aria-controls="portal-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Link
              className="mobile-brand"
              href="/dashboard"
              aria-label="Prorium 最新のレポート"
            >
              <Brand />
            </Link>
            <span>Investor Relations</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {admin
                ? "Management"
                : path === "/reports"
                  ? "Report Archive"
                  : "Monthly Report"}
            </strong>
          </div>
          <div className="topbar-right">
            {mock && <span className="mock-badge">MOCK DATA</span>}
            <span className="private-label">
              <LockKeyhole size={12} /> PRIVATE
            </span>
            <span className="user-avatar">
              {role === "admin" ? "AD" : "PS"}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="site-footer">
          <span>© 2026 Prorium Inc.</span>
          <span>
            <FileText size={12} /> Confidential · For shareholders only{" "}
            {mock && <span className="footer-mock">/ サンプルデータ</span>}
          </span>
        </footer>
      </div>
    </div>
  );
}
