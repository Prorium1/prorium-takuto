import { z } from "zod";
import { ownershipSchema } from "./ownership";

export const ownershipImportSchema = z
  .object({
    snapshot: ownershipSchema,
    retrievedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type OwnershipImport = z.infer<typeof ownershipImportSchema>;
