import { z } from "zod";
export const SHAREHOLDER_GROUPS = {
  founder: "創業者",
  team: "経営陣・従業員",
  fund: "ファンド・VC",
  corporate: "事業会社",
  individual: "個人投資家",
  other: "その他",
  treasury: "自己株式",
} as const;
export type ShareholderGroup = keyof typeof SHAREHOLDER_GROUPS;
const shares = z.number().int().positive().max(1_000_000_000_000);
export const ownershipSchema = z
  .object({
    asOf: z.iso.date().refine(
      (date) =>
        date <=
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      "基準日は本日以前の日付を入力してください。",
    ),
    basis: z.literal("issued-shares"),
    display: z.enum(["grouped", "named"]),
    issuedShares: shares,
    sourceLabel: z.string().trim().min(2).max(120),
    notes: z.string().trim().max(600),
    rows: z
      .array(
        z
          .object({
            group: z.enum([
              "founder",
              "team",
              "fund",
              "corporate",
              "individual",
              "other",
              "treasury",
            ]),
            name: z.string().trim().max(100).default(""),
            shareClass: z.string().trim().min(1).max(80),
            shares,
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.rows.reduce((sum, row) => sum + row.shares, 0) !==
      value.issuedShares
    )
      ctx.addIssue({
        code: "custom",
        path: ["issuedShares"],
        message: "内訳の合計を発行済株式数に一致させてください。",
      });
    if (value.display === "named" && value.rows.some((r) => !r.name))
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message:
          "氏名・法人名を表示する場合は、すべての行に公開する名称を入力してください。",
      });
    if (value.display === "grouped" && value.rows.some((r) => r.name))
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "区分別の公開情報には個別の株主名を含めないでください。",
      });
  });
export type OwnershipSnapshot = z.infer<typeof ownershipSchema>;
export function validOwnership(value: unknown): OwnershipSnapshot | null {
  const parsed = ownershipSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function ownershipRows(snapshot: OwnershipSnapshot) {
  if (snapshot.display === "named")
    return snapshot.rows.map((row, i) => ({
      id: `${i}`,
      label: row.name,
      detail: row.shareClass,
      shares: row.shares,
      ratio: (row.shares / snapshot.issuedShares) * 100,
    }));
  const grouped = new Map<ShareholderGroup, number>();
  for (const row of snapshot.rows)
    grouped.set(row.group, (grouped.get(row.group) || 0) + row.shares);
  return [...grouped].map(([group, count]) => ({
    id: group,
    label: SHAREHOLDER_GROUPS[group],
    detail: "発行済株式ベース",
    shares: count,
    ratio: (count / snapshot.issuedShares) * 100,
  }));
}
export function latestOwnershipReport(
  reports: import("./types").ReportVersion[],
) {
  // A correction replaces the published snapshot for its month, including a
  // deliberate withdrawal of ownership information in the corrected version.
  const newestByMonth = new Map<string, import("./types").ReportVersion>();
  for (const report of reports) {
    if (report.state !== "published") continue;
    const current = newestByMonth.get(report.period);
    if (!current || report.createdAt > current.createdAt)
      newestByMonth.set(report.period, report);
  }
  return (
    [...newestByMonth.values()]
      .filter(
        (r) => r.state === "published" && validOwnership(r.content.ownership),
      )
      .sort(
        (a, b) =>
          b.content.ownership!.asOf.localeCompare(a.content.ownership!.asOf) ||
          b.createdAt.localeCompare(a.createdAt),
      )[0] || null
  );
}
export function latestPublishedOwnership(
  monthly: import("./types").ReportVersion[],
  annual: import("./fiscal-publication").FiscalPublication[],
) {
  const candidates: {
    snapshot: OwnershipSnapshot;
    href: string;
    label: string;
    publishedAt: string;
  }[] = [];
  const report = latestOwnershipReport(monthly);
  if (report?.content.ownership)
    candidates.push({
      snapshot: report.content.ownership,
      href: `/reports/${report.period}?version=${encodeURIComponent(report.version)}#shareholders`,
      label: `${report.period} 月次レポート · ${report.version}`,
      publishedAt: report.publishedAt || report.createdAt,
    });
  const newest = new Map<number, (typeof annual)[number]>();
  for (const r of annual
    .filter((r) => r.state === "published")
    .toSorted((a, b) => b.version - a.version))
    if (!newest.has(r.year)) newest.set(r.year, r);
  for (const r of newest.values()) {
    const snapshot = validOwnership(r.content.ownership);
    if (snapshot)
      candidates.push({
        snapshot,
        href: `/fiscal/${r.year}?version=${r.version}#fiscal-ownership`,
        label: `${r.year}年10月期 年次レポート · v1.${r.version - 1}`,
        publishedAt: r.publishedAt || "",
      });
  }
  return (
    candidates.sort(
      (a, b) =>
        b.snapshot.asOf.localeCompare(a.snapshot.asOf) ||
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.href.localeCompare(b.href),
    )[0] || null
  );
}
