import {
  VITAL_ALERT_LEVELS_BY_TYPE,
  VITAL_ALERT_TYPES,
  VitalAlertAgeRange,
  VitalAlertLevel,
  VitalAlertLevels,
  VitalAlertType,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';

export type VitalAlertLevelsFormValues = Partial<Record<VitalAlertLevel, number | null>>;

export interface VitalsAlertConfigFormValues {
  ageRanges: VitalAlertAgeRange[];
  thresholds: Record<VitalAlertType, Record<string, VitalAlertLevelsFormValues>>;
}

export const toVitalAlertLevelsFormValues = (
  vital: VitalAlertType,
  levels: VitalAlertLevels = {}
): VitalAlertLevelsFormValues =>
  Object.fromEntries(VITAL_ALERT_LEVELS_BY_TYPE[vital].map((level) => [level, levels[level] ?? null]));

export const fromVitalAlertLevelsFormValues = (levels: VitalAlertLevelsFormValues = {}): VitalAlertLevels =>
  Object.fromEntries(
    Object.entries(levels).filter((entry): entry is [VitalAlertLevel, number] => typeof entry[1] === 'number')
  );

export const toVitalsAlertConfigFormValues = (config: VitalsAlertConfig): VitalsAlertConfigFormValues => ({
  ageRanges: config.ageRanges,
  thresholds: Object.fromEntries(
    VITAL_ALERT_TYPES.map((vital) => [
      vital,
      Object.fromEntries(
        config.ageRanges.map((range) => [
          range.id,
          toVitalAlertLevelsFormValues(vital, config.thresholds[vital]?.[range.id]),
        ])
      ),
    ])
  ) as VitalsAlertConfigFormValues['thresholds'],
});
