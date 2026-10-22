// A Report Studio file's date range: a preset of the Studio's picker, or fixed custom days. Read here to
// publish a Studio file as a system report (system/system-report.ts maps it onto the EHR picker's filters).
import { z } from 'zod';

export const DATE_RANGE_PRESETS = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'last90days',
  'last365days',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'lastYear',
  'custom',
] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DateRangeSpecSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS),
  /** yyyy-MM-dd days in the viewer's zone, custom only. */
  start: z.string().optional(),
  end: z.string().optional(),
});
export type DateRangeSpec = z.infer<typeof DateRangeSpecSchema>;
