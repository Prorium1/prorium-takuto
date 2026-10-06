import { z } from "zod";

export const periodSchema = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])$/, "期間はYYYY-MMで入力してください。");
const text = z.string().trim().min(1).max(2000);
export const contentEditSchema = z.object({
  headline: text.max(100),
  summary: text,
  summaryPoints: z.array(text.max(300)).max(5),
  summaryOutlook: z.string().trim().max(500),
  financialAnalysis: text,
  highlights: z
    .array(
      z.object({
        id: z.string().max(100),
        title: text.max(100),
        business_unit: text.max(100),
        metric: text.max(100),
        metric_value: text.max(100),
        description: text,
        status: text.max(100),
        period: periodSchema,
      }),
    )
    .max(12),
  forward: z
    .array(
      z.object({
        id: z.string().max(100),
        kind: z.enum(["Actual", "Committed", "Forecast", "Pipeline"]),
        title: text.max(100),
        value: text.max(100),
        description: text,
        timing: text.max(100),
      }),
    )
    .max(16),
  risks: z
    .array(
      z.object({
        id: z.string().max(100),
        title: text.max(100),
        impact: z.enum(["高", "中", "低"]),
        description: text,
        action: text,
        owner: text.max(100),
        due: text.max(100),
      }),
    )
    .max(12),
  ceoQuote: text.max(200),
  ceoMessage: text,
});
export type ContentEdit = z.infer<typeof contentEditSchema>;
