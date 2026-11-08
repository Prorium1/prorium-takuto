import { z } from "zod";
import { fiscalSourceSchema, type FiscalSource } from "./fiscal";
import { ownershipSchema } from "./ownership";
const count = z.number().int().min(0).max(100000).nullable();
export const organizationSchema = z
  .object({
    asOf: z.iso.date(),
    employees: count,
    onLeave: count,
    partTime: count,
    directors: count,
    contractors: count,
    confirmed: z.boolean(),
    sourceLabel: z.string().trim().min(2).max(160),
    note: z.string().trim().max(1200),
    areas: z.array(z.string().trim().min(1).max(80)).max(15),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.employees !== null && s.onLeave !== null && s.onLeave > s.employees)
      ctx.addIssue({
        code: "custom",
        message: "休業中の人数は社員数の内数で入力してください。",
      });
  });
export const fiscalEditorSchema = z
  .object({
    organization: organizationSchema,
    notes: z
      .object({
        development: z.string().trim().max(3000),
        hiring: z.string().trim().max(3000),
        requests: z.string().trim().max(3000),
        risks: z.string().trim().max(3000),
      })
      .strict(),
  })
  .strict();
export const fiscalPublicationContentSchema = fiscalEditorSchema
  .extend({
    source: fiscalSourceSchema,
    ownership: ownershipSchema.nullable(),
    video: z
      .object({
        occurredOn: z.iso.date(),
        videoUrl: z
          .url()
          .refine((v) =>
            /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(v),
          ),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.organization.asOf > v.source.asOf)
      ctx.addIssue({
        code: "custom",
        message: "組織情報の基準日を確認してください。",
      });
    const s = v.source.managementSummary;
    if (
      v.source.outlook?.sourceUrl ||
      s?.schoolLaunches.sourceUrl ||
      s?.schoolLaunches.confirmed.some((x) => x.sourceUrl)
    )
      ctx.addIssue({
        code: "custom",
        message: "株主向け資料には社内資料へのリンクを含められません。",
      });
  });
export type FiscalEditor = z.infer<typeof fiscalEditorSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type FiscalPublicationContent = z.infer<
  typeof fiscalPublicationContentSchema
>;
export type FiscalPublication = {
  id: string;
  companyId: string;
  year: number;
  version: number;
  revision: number;
  state: "draft" | "review" | "approved" | "published";
  content: FiscalPublicationContent;
  contentHash: string;
  approvedHash: string | null;
  publishedAt: string | null;
};
export function investorFiscalSource(input: FiscalSource): FiscalSource {
  const s = fiscalSourceSchema.parse(input);
  if (s.outlook) s.outlook.sourceUrl = null;
  if (s.managementSummary) {
    s.managementSummary.schoolLaunches.sourceUrl = null;
    for (const school of s.managementSummary.schoolLaunches.confirmed)
      school.sourceUrl = null;
  }
  return s;
}
export const fiscalVersionLabel = (version: number) => `v1.${version - 1}`;
export function emptyFiscalEditor(asOf: string): FiscalEditor {
  return {
    organization: {
      asOf,
      employees: null,
      onLeave: null,
      partTime: null,
      directors: null,
      contractors: null,
      confirmed: false,
      sourceLabel: "経営者による確認待ち",
      note: "",
      areas: [],
    },
    notes: { development: "", hiring: "", requests: "", risks: "" },
  };
}
export function fiscalReviewIssues(content: FiscalPublicationContent) {
  const issues: string[] = [];
  if (!content.source.managementSummary)
    issues.push("経営サマリーを登録してください。");
  if (
    !content.organization.confirmed ||
    content.organization.employees === null
  )
    issues.push("社員数とその対象範囲を確認してください。");
  if (!content.notes.risks)
    issues.push("リスク・確認中の事項を記載してください。");
  return issues;
}
