// The values a plan report takes from the screen that runs it (its `inputs`): the date range the plan templates,
// kept with the picker's setting as its default, and the patient a per-patient plan needs.
import { FetchPlan, planNeedsPatient, planUsesDateRange } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { AD_HOC_DATE_RANGE_FILTERS, AdHocDateRangeFilter } from 'utils/lib/types/adhoc/query/date-range';
import {
  DateRangeInputDefault,
  DateRangeInputDefaultSchema,
  SavedAdHocReportInput,
} from 'utils/lib/types/adhoc/saved/saved.types';

export interface DateRangeControls {
  dateRange: AdHocDateRangeFilter;
  customDate: string;
  customStartDate: string;
  customEndDate: string;
}

export const DATE_RANGE_INPUT_NAME = 'range';
export const PATIENT_INPUT_NAME = 'patientId';

const dateRangeInputDefault = (controls: DateRangeControls): DateRangeInputDefault => {
  if (controls.dateRange === 'custom') return { start: controls.customDate, end: controls.customDate };
  if (controls.dateRange === 'customRange') return { start: controls.customStartDate, end: controls.customEndDate };
  return { preset: controls.dateRange };
};

/** The inputs a plan declares: its date range (defaulting to the picker's current setting) and the patient it needs. */
export function inputsForPlan(plan: FetchPlan, controls: DateRangeControls): SavedAdHocReportInput[] {
  const inputs: SavedAdHocReportInput[] = [];
  if (planUsesDateRange(plan)) {
    inputs.push({
      name: DATE_RANGE_INPUT_NAME,
      kind: 'dateRange',
      required: false,
      default: dateRangeInputDefault(controls),
    });
  }
  if (planNeedsPatient(plan)) inputs.push({ name: PATIENT_INPUT_NAME, kind: 'id', required: true });
  return inputs;
}

/** The picker setting a saved report's dateRange input starts on; undefined when it declares none it can read. */
export function controlsFromInputs(
  inputs: SavedAdHocReportInput[] | undefined
): Partial<DateRangeControls> | undefined {
  const input = inputs?.find((i) => i.kind === 'dateRange');
  const parsed = input ? DateRangeInputDefaultSchema.safeParse(input.default) : undefined;
  if (!parsed?.success) return undefined;
  if ('preset' in parsed.data) {
    const preset = parsed.data.preset;
    return (AD_HOC_DATE_RANGE_FILTERS as readonly string[]).includes(preset)
      ? { dateRange: preset as AdHocDateRangeFilter }
      : undefined;
  }
  const { start, end } = parsed.data;
  return start === end
    ? { dateRange: 'custom', customDate: start }
    : { dateRange: 'customRange', customStartDate: start, customEndDate: end };
}
