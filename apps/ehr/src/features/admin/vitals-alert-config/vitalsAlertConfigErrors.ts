import { FieldErrors } from 'react-hook-form';
import {
  VITAL_ALERT_LABELS,
  VITAL_ALERT_LEVELS,
  VITAL_ALERT_TYPES,
  VitalAlertAgeRange,
  VitalAlertType,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { formatVitalAlertAgeRange } from 'utils/lib/utils/vitals-alert-config';

interface MessageNode {
  message?: string;
}

type AgeNodeErrors = MessageNode & { value?: MessageNode; unit?: MessageNode };

type AgeRangeErrors =
  | (MessageNode & Array<{ minAge?: AgeNodeErrors; maxAge?: AgeNodeErrors; id?: MessageNode }>)
  | undefined;

const ageNodeMessages = (node: AgeNodeErrors | undefined, label: string): string[] =>
  [
    node?.message,
    node?.value?.message ? `${label} age is required` : undefined,
    node?.unit?.message ? `${label} age unit is required` : undefined,
  ].filter((message): message is string => !!message);

/** Cross-row rules attach to the `minAge` / `maxAge` nodes rather than to any rendered input. */
const collectAgeRangeErrors = (errors: FieldErrors<VitalsAlertConfig>): string[] => {
  const ageRangeErrors = errors.ageRanges as AgeRangeErrors;
  if (!ageRangeErrors) return [];

  const messages: string[] = [];
  if (ageRangeErrors.message) {
    messages.push(ageRangeErrors.message);
  }
  if (Array.isArray(ageRangeErrors)) {
    ageRangeErrors.forEach((rowError, index) => {
      // zod skips the array-level refinements once any row fails field validation, so sub-field
      // messages can be the only ones present.
      [
        ...ageNodeMessages(rowError?.minAge, 'Start'),
        ...ageNodeMessages(rowError?.maxAge, 'End'),
        ...(rowError?.id?.message ? [rowError.id.message] : []),
      ].forEach((message) => {
        messages.push(`Age range ${index + 1}: ${message}`);
      });
    });
  }
  return messages;
};

export const getVitalsWithThresholdErrors = (errors: FieldErrors<VitalsAlertConfig>): Set<VitalAlertType> => {
  const withErrors = new Set<VitalAlertType>();
  const thresholds = errors.thresholds as Record<string, unknown> | undefined;
  if (!thresholds) return withErrors;
  VITAL_ALERT_TYPES.forEach((vital) => {
    if (thresholds[vital]) {
      withErrors.add(vital);
    }
  });
  return withErrors;
};

const collectThresholdErrors = (errors: FieldErrors<VitalsAlertConfig>, ageRanges: VitalAlertAgeRange[]): string[] => {
  const thresholds = errors.thresholds as
    | Record<string, Record<string, Record<string, MessageNode | undefined> | undefined> | undefined>
    | undefined;
  if (!thresholds) return [];

  const rangeLabels = new Map(ageRanges.map((range) => [range.id, formatVitalAlertAgeRange(range)]));
  const messages: string[] = [];

  VITAL_ALERT_TYPES.forEach((vital) => {
    const perRange = thresholds[vital];
    if (!perRange) return;
    Object.entries(perRange).forEach(([rangeId, levelErrors]) => {
      if (!levelErrors) return;
      VITAL_ALERT_LEVELS.forEach((level) => {
        const message = levelErrors[level]?.message;
        if (message) {
          messages.push(`${VITAL_ALERT_LABELS[vital]}, ${rangeLabels.get(rangeId) ?? rangeId}: ${message}`);
        }
      });
    });
  });
  return messages;
};

export const collectVitalsAlertConfigErrors = (
  errors: FieldErrors<VitalsAlertConfig>,
  ageRanges: VitalAlertAgeRange[]
): string[] => Array.from(new Set([...collectAgeRangeErrors(errors), ...collectThresholdErrors(errors, ageRanges)]));
