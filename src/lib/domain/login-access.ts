/** Only a verified identity with a matching company membership may enter. */
export function loginDestination(
  actor: unknown,
  verifiedUserId: string,
  companyId: string,
): "/admin" | "/dashboard" | null {
  if (!actor || typeof actor !== "object") return null;
  const value = actor as Record<string, unknown>;
  if (
    !verifiedUserId ||
    !companyId ||
    value.id !== verifiedUserId ||
    value.companyId !== companyId
  )
    return null;
  if (value.role === "admin") return "/admin";
  if (value.role === "investor") return "/dashboard";
  return null;
}
