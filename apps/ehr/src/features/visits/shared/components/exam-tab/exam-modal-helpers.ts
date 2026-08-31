import { ExamCardCheckboxWithModalComponent } from 'config-types/config/examination';
export interface FlatOption {
  key: string;
  label: string;
  groupLabel: string;
  header?: string;
  headerAbbreviation?: string;
  description?: string;
  abnormal?: boolean;
}

export function buildAllOptionsNew(config: ExamCardCheckboxWithModalComponent): FlatOption[] {
  return Object.values(config.modal).flatMap((section) =>
    Object.values(section.columns).flatMap((column) =>
      Object.values(column.groups).flatMap((group) =>
        Object.entries(group.options).map(([key, opt]) => ({
          key,
          label: opt.label,
          groupLabel: group.label,
          header: column.header,
          headerAbbreviation: column.headerAbbreviation,
          description: opt.description,
          abnormal: opt.abnormal,
        }))
      )
    )
  );
}

export function buildColumnMap(options: FlatOption[]): Record<string, FlatOption[]> {
  const map = new Map<string, FlatOption[]>();
  options.forEach((opt) => {
    const header = opt.header ? opt.header : 'single-column';
    const existing = map.get(header);
    if (existing) existing.push(opt);
    else map.set(header, [opt]);
  });

  return Object.fromEntries(map);
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
