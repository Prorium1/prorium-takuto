"use client";

import { useState } from "react";
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
  const admin = path.startsWith("/admin");

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
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
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
            className={!admin && path !== "/reports" ? "active" : ""}
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
              <Link href="/admin/investors" onClick={() => setOpen(false)}>
                <ShieldCheck size={18} />
                <span>Investor Access</span>
              </Link>
              <Link
                className={admin && path !== "/admin/import" ? "active" : ""}
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
                <a href={`#${id}`} key={id} onClick={() => setOpen(false)}>
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
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="メニューを開く"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
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
