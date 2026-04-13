import type { ExamCardCheckboxWithModalComponent } from 'config-types';

export const BORDER_STYLE = '1px solid rgba(224, 224, 224, 1)';
export interface FlatOption {
  key: string;
  label: string;
  groupLabel: string;
  description?: string;
  abnormal?: boolean;
}

export function buildAllOptions(config: ExamCardCheckboxWithModalComponent): FlatOption[] {
  return Object.values(config.modal).flatMap((section) =>
    Object.values(section.groups).flatMap((group) =>
      Object.entries(group.options).map(([key, opt]) => ({
        key,
        label: opt.label,
        groupLabel: group.label,
        description: opt.description,
        abnormal: opt.abnormal,
      }))
    )
  );
}

export function buildDescriptionMap(options: FlatOption[]): Record<string, string> {
  const map: Record<string, string> = {};
  options.forEach((opt) => {
    if (opt.description) map[opt.key] = opt.description;
  });
  return map;
}

export function buildAbnormalMap(options: FlatOption[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  options.forEach((opt) => {
    map[opt.key] = opt.abnormal ?? true;
  });
  return map;
}
