import { z } from 'zod';

// Date-range selector. Relative values recompute on open; custom/customRange are fixed.
export type AdHocDateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom' | 'customRange';

// The resolved ISO instant window a dataset endpoint is queried with.
export const DateRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});
export type DateRange = z.infer<typeof DateRangeSchema>;
