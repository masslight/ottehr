import { FieldErrors } from 'react-hook-form';
import {
  VITAL_ALERT_LABELS,
  VITAL_ALERT_LEVELS_BY_TYPE,
  VITAL_ALERT_TYPES,
  VitalAlertAgeRange,
  VitalAlertType,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { formatVitalAlertAgeRange } from 'utils/lib/utils/vitals-alert-config';

interface MessageNode {
  message?: string;
}

type RootedNode = MessageNode & { root?: MessageNode };

type AgeNodeErrors = RootedNode & { value?: MessageNode; unit?: MessageNode };

type AgeRangeErrors =
  | (RootedNode & Array<{ minAge?: AgeNodeErrors; maxAge?: AgeNodeErrors; id?: MessageNode }>)
  | undefined;

const ownMessage = (node: RootedNode | undefined): string | undefined => node?.message ?? node?.root?.message;

const ageNodeMessages = (node: AgeNodeErrors | undefined, label: string): string[] =>
  [
    ownMessage(node),
    node?.value?.message ? `${label} age is required` : undefined,
    node?.unit?.message ? `${label} age unit is required` : undefined,
  ].filter((message): message is string => !!message);

const collectAgeRangeErrors = (errors: FieldErrors<VitalsAlertConfig>): string[] => {
  const ageRangeErrors = errors.ageRanges as AgeRangeErrors;
  if (!ageRangeErrors) return [];

  const messages: string[] = [];
  const arrayMessage = ownMessage(ageRangeErrors);
  if (arrayMessage) {
    messages.push(arrayMessage);
  }
  if (Array.isArray(ageRangeErrors)) {
    ageRangeErrors.forEach((rowError, index) => {
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
      VITAL_ALERT_LEVELS_BY_TYPE[vital].forEach((level) => {
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
