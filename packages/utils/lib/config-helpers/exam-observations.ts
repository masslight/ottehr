import type { ExamCardComponent, ExamItemConfig } from 'config-types';
import { DefaultExamComponentsConfig } from '../ottehr-config/examination/default-components.config';
import { isDropdownComponent, isMultiSelectComponent } from '../ottehr-config/examination/examination.schema';
import type { ExamObservationComponentDTO, ExamObservationDTO } from '../types/api/chart-data/chart-data.types';

export interface ExamObservationItem {
  field: string;
  label: string;
  abnormal: boolean;
}

type ExamObservationMap = Record<string, ExamObservationDTO>;

const formatElementName = (elementName: string): string => {
  return elementName
    .split('-')
    .map((word) => {
      return word
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    })
    .join(' | ');
};

export function extractObservationsFromExamComponents(
  components: Record<string, ExamCardComponent>,
  section: 'normal' | 'abnormal',
  examObservations: ExamObservationMap,
  columnLabel?: string
): ExamObservationItem[] {
  const items: ExamObservationItem[] = [];

  Object.entries(components).forEach(([fieldName, component]) => {
    if (component.type === 'text') return;

    switch (component.type) {
      case 'checkbox': {
        const observation = examObservations[fieldName];
        if (observation && typeof observation.value === 'boolean' && observation.value === true) {
          items.push({
            field: fieldName,
            label: columnLabel ? `${columnLabel}: ${component.label}` : component.label,
            abnormal: section === 'abnormal',
          });
        }
        break;
      }

      case 'dropdown': {
        if (isDropdownComponent(component)) {
          Object.entries(component.components).forEach(([optionName, option]) => {
            const observation = examObservations[optionName];
            if (observation && typeof observation.value === 'boolean' && observation.value === true) {
              const baseLabel = columnLabel ? `${columnLabel}: ${component.label}` : component.label;
              items.push({
                field: optionName,
                label: `${baseLabel}: ${option.label}`,
                abnormal: section === 'abnormal',
              });
            }
          });
        }
        break;
      }

      case 'form': {
        Object.entries(component.components).forEach(([elementName]) => {
          const observation = examObservations[elementName];
          if (observation && typeof observation.value === 'boolean' && observation.value === true) {
            const baseLabel = columnLabel ? `${columnLabel}: ${component.label}` : component.label;
            const formattedElementName = formatElementName(elementName);
            const note = observation.note ? ` | ${observation.note}` : '';

            items.push({
              field: elementName,
              label: `${baseLabel}: ${formattedElementName}${note}`,
              abnormal: section === 'abnormal',
            });
          }
        });
        break;
      }

      case 'multi-select': {
        if (isMultiSelectComponent(component)) {
          const componentLabel = columnLabel ? `${columnLabel}: ${component.label}` : component.label;
          const selectedOptions: ExamObservationItem[] = [];
          Object.entries(component.options).forEach(([optionName, option]) => {
            const observation = examObservations[optionName];
            if (observation && typeof observation.value === 'boolean' && observation.value === true) {
              const description = option.description ? ` (${option.description})` : '';
              selectedOptions.push({
                field: optionName,
                label: `${componentLabel}: ${option.label}${description}`,
                abnormal: section === 'abnormal',
              });
            }
          });
          const observation = examObservations[fieldName];
          if (observation && observation.value === true && selectedOptions.length === 0) {
            items.push({
              field: fieldName,
              label: columnLabel ? `${columnLabel}: ${component.label}` : component.label,
              abnormal: section === 'abnormal',
            });
          }
          items.push(...selectedOptions);
        }
        break;
      }

      case 'column': {
        const nestedItems = extractObservationsFromExamComponents(
          component.components,
          section,
          examObservations,
          component.label
        );
        items.push(...nestedItems);
        break;
      }

      case 'checkbox-with-modal': {
        const observation = examObservations[fieldName];
        if (!observation || observation.value !== true) break;

        if (!observation.components?.length) {
          items.push({
            field: fieldName,
            label: component.label,
            abnormal: section === 'abnormal',
          });
          break;
        }

        let abnormalContained = false;

        const grouped = groupComponents(observation.components, (isAbnormal: boolean | undefined) => {
          if (isAbnormal || isAbnormal === undefined) abnormalContained = true;
        });

        const consolidatedLabel = formatGroupedComponents(grouped);
        const observationLabel = observation.label ? `${observation.label}: ` : '';

        items.push({
          field: fieldName,
          label: `${observationLabel}${consolidatedLabel}`,
          abnormal: abnormalContained,
        });

        break;
      }

      default:
        break;
    }
  });

  return items;
}

export function collectKnownExamFields(examConfig: ExamItemConfig): Set<string> {
  const knownFields = new Set<string>();

  const collectFromComponents = (components: Record<string, ExamCardComponent>): void => {
    Object.entries(components).forEach(([key, component]) => {
      if (component.type === 'checkbox' || component.type === 'checkbox-with-modal') {
        knownFields.add(key);
      } else if (component.type === 'text') {
        knownFields.add(key);
      } else if (component.type === 'dropdown') {
        knownFields.add(key);
        if (isDropdownComponent(component)) {
          Object.keys(component.components).forEach((k) => knownFields.add(k));
        }
      } else if (component.type === 'column') {
        collectFromComponents(component.components);
      } else if (component.type === 'multi-select') {
        knownFields.add(key);
        if (isMultiSelectComponent(component)) {
          Object.keys(component.options).forEach((k) => knownFields.add(k));
        }
      } else if (component.type === 'form') {
        Object.keys(component.components).forEach((k) => knownFields.add(k));
      }
    });
  };

  Object.values(examConfig).forEach((section) => {
    collectFromComponents(section.components.normal);
    collectFromComponents(section.components.abnormal);
    Object.keys(section.components.comment).forEach((k) => knownFields.add(k));
  });

  return knownFields;
}

export interface ExamFieldSectionInfo {
  sectionKey: string;
  sectionLabel: string;
}

// Walks the exam config and produces a map from every component field name (the keys
// stored in chart data) to the section it belongs to. The preview UI uses this to
// group exam findings under their body-system header so a chip like "Soft" is
// rendered under "Abdomen" instead of floating without context.
export function buildExamFieldToSectionMap(examConfig: ExamItemConfig): Map<string, ExamFieldSectionInfo> {
  const map = new Map<string, ExamFieldSectionInfo>();

  const walk = (components: Record<string, ExamCardComponent>, sectionKey: string, sectionLabel: string): void => {
    Object.entries(components).forEach(([key, component]) => {
      if (component.type === 'checkbox' || component.type === 'checkbox-with-modal' || component.type === 'text') {
        map.set(key, { sectionKey, sectionLabel });
      } else if (component.type === 'dropdown') {
        map.set(key, { sectionKey, sectionLabel });
        if (isDropdownComponent(component)) {
          Object.keys(component.components).forEach((k) => map.set(k, { sectionKey, sectionLabel }));
        }
      } else if (component.type === 'column') {
        walk(component.components, sectionKey, sectionLabel);
      } else if (component.type === 'multi-select') {
        map.set(key, { sectionKey, sectionLabel });
        if (isMultiSelectComponent(component)) {
          Object.keys(component.options).forEach((k) => map.set(k, { sectionKey, sectionLabel }));
        }
      } else if (component.type === 'form') {
        Object.keys(component.components).forEach((k) => map.set(k, { sectionKey, sectionLabel }));
      }
    });
  };

  Object.entries(examConfig).forEach(([sectionKey, section]) => {
    walk(section.components.normal, sectionKey, section.label);
    walk(section.components.abnormal, sectionKey, section.label);
    Object.keys(section.components.comment).forEach((k) => map.set(k, { sectionKey, sectionLabel: section.label }));
  });

  return map;
}

export interface ExamFindingSectionGroup<T> {
  sectionKey: string;
  sectionLabel: string;
  findings: T[];
}

const EXAM_OTHER_SECTION_KEY = '__other__';
const EXAM_OTHER_SECTION_LABEL = 'Other';

const DEFAULT_FIELD_TO_SECTION = buildExamFieldToSectionMap(DefaultExamComponentsConfig);
const DEFAULT_SECTION_KEYS_IN_ORDER = Object.keys(DefaultExamComponentsConfig);

export function groupExamFindingsBySection<T extends { fieldName: string }>(
  findings: readonly T[]
): ExamFindingSectionGroup<T>[] {
  const groups = new Map<string, ExamFindingSectionGroup<T>>();

  for (const finding of findings) {
    const info = DEFAULT_FIELD_TO_SECTION.get(finding.fieldName);
    const sectionKey = info?.sectionKey ?? EXAM_OTHER_SECTION_KEY;
    const sectionLabel = info?.sectionLabel ?? EXAM_OTHER_SECTION_LABEL;
    const existing = groups.get(sectionKey);
    if (existing) existing.findings.push(finding);
    else groups.set(sectionKey, { sectionKey, sectionLabel, findings: [finding] });
  }

  const orderedKeys = [
    ...DEFAULT_SECTION_KEYS_IN_ORDER.filter((key) => groups.has(key)),
    ...(groups.has(EXAM_OTHER_SECTION_KEY) ? [EXAM_OTHER_SECTION_KEY] : []),
  ];

  return orderedKeys.map((key) => groups.get(key)!);
}

// helpers for formatting labels for checkbox-with-modal
function groupComponents(
  components: ExamObservationComponentDTO[],
  onAbnormal: (abnormal: boolean | undefined) => void
): Map<string | null, Map<string, string[]>> {
  const result = new Map<string | null, Map<string, string[]>>();

  components
    .filter((c) => c.value)
    .forEach((c) => {
      const columnKey = c.columnLabel || null;
      const groupKey = c.groupLabel || '';

      if (!result.has(columnKey)) {
        result.set(columnKey, new Map());
      }

      const groupMap = result.get(columnKey)!;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }

      groupMap.get(groupKey)!.push(c.label);

      onAbnormal(c.abnormal);
    });

  return result;
}

function formatGroupedComponents(grouped: Map<string | null, Map<string, string[]>>): string {
  return Array.from(grouped.entries())
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')) // handles L coming before R
    .map(([columnLabel, groupMap]) => {
      const groups = Array.from(groupMap.entries())
        .map(([groupLabel, labels]) => (groupLabel ? `${groupLabel}: ${labels.join(', ')}` : labels.join(', ')))
        .join('; ');

      return columnLabel ? `${columnLabel}: ${groups}` : groups;
    })
    .join('; ');
}
