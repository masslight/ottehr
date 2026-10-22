import { z } from 'zod';

// Date-range selector. Relative values recompute on open; custom/customRange are fixed.
export const AD_HOC_DATE_RANGE_PRESETS = [
  'today',
  'yesterday',
  'last-7-days',
  'last-30-days',
  'last-90-days',
  'last-365-days',
  'this-month',
  'last-month',
  'this-year',
  'last-year',
] as const;
export type AdHocDateRangePreset = (typeof AD_HOC_DATE_RANGE_PRESETS)[number];
export const AD_HOC_DATE_RANGE_FILTERS = [...AD_HOC_DATE_RANGE_PRESETS, 'custom', 'customRange'] as const;
export type AdHocDateRangeFilter = (typeof AD_HOC_DATE_RANGE_FILTERS)[number];

// The resolved ISO instant window a dataset endpoint is queried with.
export const DateRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});
export type DateRange = z.infer<typeof DateRangeSchema>;
