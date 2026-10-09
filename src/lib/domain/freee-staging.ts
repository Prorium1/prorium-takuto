import { z } from "zod";

const money = z.number().safe().int();
const metric = z.object({ current: money, previous: money });
export const stagedRowSchema = z.object({
  id: z.uuid(),
  period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  candidate: z.object({
    period: z.string(), currency: z.literal("JPY"), source: z.literal("freee"),
    completeness: z.literal("month-to-date").optional(),
    throughDate: z.string().optional(),
    revenue: metric, operatingProfit: metric, ordinaryProfit: metric, cash: metric,
    assets: money.nonnegative(), liabilities: money.nonnegative(), equity: money,
    monthlyFixedCosts: z.null(),
  }),
  provenance: z.object({
    period: z.string(), closeConfirmed: z.literal(false), retrievedAt: z.iso.datetime({ offset: true }),
    cashAccountIds: z.object({ current: z.array(z.number().int().positive()), previous: z.array(z.number().int().positive()) }),
  }),
});
export type StagedFreeeRow = z.infer<typeof stagedRowSchema>;
