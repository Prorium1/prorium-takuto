// The database uses the same structural contract as the application. Business
// invariants (balances, periods, totals, and workflow) are checked separately.
import { z } from "zod";
import { fiscalPublicationContentSchema } from "../src/lib/domain/fiscal-publication";
export const fiscalContract = () =>
  z.toJSONSchema(fiscalPublicationContentSchema);
