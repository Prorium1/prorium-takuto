import { ShellClient } from "./shell-client";
import {
  isMockEnvironment,
  isCloudMockPreview,
} from "@/lib/server/environment";
import Link from "next/link";
import type { Role } from "@/lib/domain/types";
export function Shell({
  children,
  role,
  report = false,
}: {
  children: React.ReactNode;
  role: Role;
  report?: boolean;
}) {
  return (
    <ShellClient role={role} report={report} mock={isMockEnvironment()}>
      {isCloudMockPreview() && (
        <div className="cloud-preview-notice">
          <span>
            <strong>確認用デモ</strong> 架空データのみ ·
            入力内容は保存されません
          </span>
          {role === "admin" && (
            <Link href="/admin/reports/report-2026-09-v1-0">
              振り返りを試す →
            </Link>
          )}
        </div>
      )}
      {children}
    </ShellClient>
  );
}
