import type { ExamCardComponent, ExamItemConfig } from 'config-types';
import { isDropdownComponent, isMultiSelectComponent } from '../ottehr-config/examination/examination.schema';
import type { ExamObservationDTO } from '../types/api/chart-data/chart-data.types';

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

      case 'modal-exam': {
        // Check if this is part of an L/R pair by looking for base observation
        const baseKey = fieldName.replace(/-[lr]$/, '');
        const isLeftKey = fieldName.endsWith('-l');
        const isRightKey = fieldName.endsWith('-r');
        const isPairedKey = isLeftKey || isRightKey;

        if (isPairedKey && isRightKey) {
          // Skip right key — it's handled when processing the left key
          break;
        }

        if (isPairedKey && isLeftKey) {
          const rightKey = baseKey + '-r';
          const baseLabel = component.label.replace(/\s+L$/, '');
          const baseObservation = examObservations[baseKey];
          const leftObservation = examObservations[fieldName];
          const rightObservation = examObservations[rightKey];

          // Generic parent observation (no laterality)
          if (baseObservation?.value === true && !leftObservation?.value && !rightObservation?.value) {
            items.push({
              field: baseKey,
              label: baseLabel,
              abnormal: section === 'abnormal',
            });
            break;
          }

          const leftComponents = leftObservation?.components?.filter((c) => c.value) ?? [];
          const rightComponents = rightObservation?.components?.filter((c) => c.value) ?? [];

          if (leftComponents.length > 0 || rightComponents.length > 0) {
            const consolidateSide = (components: typeof leftComponents): string => {
              const grouped = new Map<string, string[]>();
              components.forEach((c) => {
                const colonIdx = c.label.indexOf(': ');
                if (colonIdx > 0) {
                  const group = c.label.substring(0, colonIdx);
                  const item = c.label.substring(colonIdx + 2);
                  const existing = grouped.get(group);
                  if (existing) existing.push(item);
                  else grouped.set(group, [item]);
                } else {
                  const existing = grouped.get('');
                  if (existing) existing.push(c.label);
                  else grouped.set('', [c.label]);
                }
              });
              return Array.from(grouped.entries())
                .map(([group, groupItems]) => (group ? `${group}: ${groupItems.join(', ')}` : groupItems.join(', ')))
                .join('; ');
            };
            const parts: string[] = [];
            if (leftComponents.length > 0) {
              parts.push(`L: ${consolidateSide(leftComponents)}`);
            }
            if (rightComponents.length > 0) {
              parts.push(`R: ${consolidateSide(rightComponents)}`);
            }
            const hasAnyAbnormal = [...leftComponents, ...rightComponents].some((c) => c.abnormal !== false);
            items.push({
              field: baseKey,
              label: `${baseLabel} ${parts.join(', ')}`,
              abnormal: hasAnyAbnormal,
            });
          } else {
            // Parent checked with no sub-items on either side
            if (leftObservation?.value === true || rightObservation?.value === true) {
              const sideParts: string[] = [];
              if (leftObservation?.value) sideParts.push('L');
              if (rightObservation?.value) sideParts.push('R');
              items.push({
                field: baseKey,
                label: `${baseLabel} ${sideParts.join(', ')}`,
                abnormal: section === 'abnormal',
              });
            }
          }
          break;
        }

        // Non-paired modal-exam (e.g., Common skin findings)
        const observation = examObservations[fieldName];
        if (observation && observation.value === true) {
          if (observation.components && observation.components.length > 0) {
            observation.components
              .filter((c) => c.value)
              .forEach((c) => {
                items.push({
                  field: `${fieldName}:${c.code}`,
                  label: `${component.label}: ${c.label}`,
                  abnormal: c.abnormal ?? section === 'abnormal',
                });
              });
          } else {
            items.push({
              field: fieldName,
              label: component.label,
              abnormal: section === 'abnormal',
            });
          }
        }
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
      if (component.type === 'checkbox' || component.type === 'modal-exam') {
        knownFields.add(key);
        const baseKey = key.replace(/-[lr]$/, '');
        if (baseKey !== key) knownFields.add(baseKey);
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
