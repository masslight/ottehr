import type { ExamCardModalExamComponent } from 'config-types';

export interface FlatOption {
  key: string;
  label: string;
  groupLabel: string;
  description?: string;
  abnormal?: boolean;
}

export function buildAllOptions(config: ExamCardModalExamComponent): FlatOption[] {
  return Object.values(config.sections).flatMap((section) =>
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
