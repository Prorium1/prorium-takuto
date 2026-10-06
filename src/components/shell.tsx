import { ShellClient } from "./shell-client";
import { isMockEnvironment } from "@/lib/server/environment";
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
      {children}
    </ShellClient>
  );
}
