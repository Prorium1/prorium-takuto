import { z } from "zod";
import { periodSchema } from "./validation";
export const DOCUMENT_CATEGORIES = {
  pl: "損益計算書（P/L）",
  bs: "貸借対照表（B/S）",
  "trial-balance": "残高試算表",
  "cash-flow": "キャッシュフロー計算書",
  other: "その他の財務資料",
} as const;
export const DOCUMENT_BASES = {
  monthly: "単月",
  ytd: "期首からの累計",
  "year-end": "決算時点",
  other: "その他",
} as const;
export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(["pl", "bs", "trial-balance", "cash-flow", "other"]),
  period: periodSchema,
  basis: z.enum(["monthly", "ytd", "year-end", "other"]),
  description: z.string().trim().max(1000),
  fileName: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^/\\\r\n]+\.pdf$/i),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(4 * 1024 * 1024),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
