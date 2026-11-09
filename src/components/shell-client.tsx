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
  PieChart,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Brand } from "./brand";
import type { Role } from "@/lib/domain/types";

export const reportSections = [
  ["summary", "今月のまとめ"],
  ["performance", "売上と利益"],
  ["drivers", "数字が変わった理由"],
  ["business", "事業の進み具合"],
  ["ai", "AIの活用"],
  ["position", "資金と財産の状況"],
  ["forward", "これからの見通し"],
  ["risks", "心配なことと対応"],
  ["ceo", "社長からのメッセージ"],
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
        <span className="nav-label">株主向け · 報告を見る</span>
        <nav className="primary-nav" aria-label="メインナビゲーション">
          <Link
            className={path === "/dashboard" ? "active" : ""}
            href="/dashboard"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard size={18} />
            <span>株主のホーム</span>
            <span className="nav-dot" />
          </Link>
          <Link
            className={path === "/reports" ? "active" : ""}
            href="/reports"
            onClick={() => setOpen(false)}
          >
            <Archive size={18} />
            <span>月次レポート</span>
          </Link>
          <Link
            href="/documents"
            className={path === "/documents" ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            <FileText size={18} />
            <span>資料を保存</span>
          </Link>
          <Link
            href="/shareholders"
            className={path === "/shareholders" ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            <PieChart size={18} />
            <span>株主構成</span>
          </Link>
          {role === "admin" && (
            <>
              <span className="nav-label admin-nav-label">
                経営者向け · 報告を作る
              </span>
              <Link
                className={path === "/admin/investors" ? "active" : ""}
                href="/admin/investors"
                onClick={() => setOpen(false)}
              >
                <ShieldCheck size={18} />
                <span>閲覧する株主を登録</span>
              </Link>
              <Link
                className={
                  admin &&
                  path !== "/admin/import" &&
                  path !== "/admin/investors" &&
                  path !== "/admin/shareholders"
                    ? "active"
                    : ""
                }
                href="/admin"
                onClick={() => setOpen(false)}
              >
                <ShieldCheck size={18} />
                <span>経営者のホーム</span>
              </Link>
              <Link
                href="/admin/shareholders"
                className={path === "/admin/shareholders" ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <PieChart size={18} />
                <span>株主構成を登録</span>
              </Link>
              <Link
                className={path === "/admin/import" ? "active" : ""}
                href="/admin/import"
                onClick={() => setOpen(false)}
              >
                <Upload size={18} />
                <span>財務データの取込</span>
              </Link>
            </>
          )}
        </nav>
        {report && (
          <div className="contents-nav">
            <span className="nav-label">この報告の目次</span>
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
                  ? "架空データの確認用画面"
                  : "登録された方だけが閲覧できます"}
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
            <span>Prorium</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {admin
                ? "経営者の画面"
                : path === "/reports"
                  ? "過去の報告"
                  : "株主向けの画面"}
            </strong>
          </div>
          <div className="topbar-right">
            {mock && <span className="mock-badge">確認用データ</span>}
            <span className="audience-label">
              {admin ? "経営者用" : "株主向け"}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="site-footer">
          <span>© 2026 Prorium Inc.</span>
          <span>
            <FileText size={12} /> 株主限定の資料です{" "}
            {mock && <span className="footer-mock">/ サンプルデータ</span>}
          </span>
        </footer>
      </div>
    </div>
  );
}
