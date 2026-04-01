import { Box } from '@mui/material';
import type { ExamCardComponent, ExamItemConfig } from 'config-types';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { isDropdownComponent, isMultiSelectComponent } from 'utils';
import { useExamObservationsStore } from '../../../stores/appointment/exam-observations.store';
import { ExamReviewGroup } from './ExamReviewGroup';

type ExaminationContainerProps = {
  examConfig: ExamItemConfig;
};

export const ExaminationContainer: FC<ExaminationContainerProps> = (props) => {
  const { examConfig } = props;

  const examObservations = useExamObservationsStore();

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

  const extractObservationsFromComponents = (
    components: Record<string, ExamCardComponent>,
    section: 'normal' | 'abnormal',
    columnLabel?: string
  ): { field: string; label: string; abnormal: boolean }[] => {
    const items: { field: string; label: string; abnormal: boolean }[] = [];

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
            const componentLabel = component.label;
            const selectedOptions: { field: string; label: string; abnormal: boolean }[] = [];
            Object.entries(component.options).forEach(([optionName, option]) => {
              const observation = examObservations[optionName];
              if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                const baseLabel = columnLabel ? `${columnLabel}: ${component.label}` : component.label;
                const description = option.description ? ` (${option.description})` : '';
                selectedOptions.push({
                  field: optionName,
                  label: `${baseLabel}: ${option.label}${description}`,
                  abnormal: section === 'abnormal',
                });
              }
            });
            const observation = examObservations[fieldName];
            if (observation && observation.value === true && selectedOptions.length === 0) {
              items.push({
                field: fieldName,
                label: `${componentLabel}`,
                abnormal: section === 'abnormal',
              });
            }
            items.push(...selectedOptions);
          }
          break;
        }

        case 'column': {
          const nestedItems = extractObservationsFromComponents(component.components, section, component.label);
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
                  .map(([group, items]) => (group ? `${group}: ${items.join(', ')}` : items.join(', ')))
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
  };

  const getSectionObservations = (
    sectionKey: string
  ): {
    normalItems: { field: string; label: string; abnormal: boolean }[];
    abnormalItems: { field: string; label: string; abnormal: boolean }[];
  } => {
    const section = examConfig[sectionKey];
    if (!section) return { normalItems: [], abnormalItems: [] };

    const normalItems = extractObservationsFromComponents(section.components.normal, 'normal', undefined);
    const abnormalItems = extractObservationsFromComponents(section.components.abnormal, 'abnormal', undefined);

    return { normalItems, abnormalItems };
  };

  // Collect all field names that are recognized by the config
  const knownFields = new Set<string>();
  const collectFromComponents = (components: Record<string, ExamCardComponent>): void => {
    Object.entries(components).forEach(([key, component]) => {
      if (component.type === 'checkbox' || component.type === 'modal-exam') {
        knownFields.add(key);
        // For L/R paired modals, also add the base key
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

  // Find unmatched observations that have value=true but aren't in the config
  const unmatchedItems = Object.values(examObservations)
    .filter((obs) => obs.value === true && !knownFields.has(obs.field))
    .map((obs) => ({
      field: obs.field,
      label: obs.label || obs.field,
      abnormal: true,
    }));

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer}
    >
      {Object.entries(examConfig)
        .map(([sectionKey, section]) => {
          const { normalItems, abnormalItems } = getSectionObservations(sectionKey);
          const allItems = [...normalItems, ...abnormalItems];
          const comment = Object.keys(section.components.comment)
            .map((key) => examObservations[key]?.note)
            .filter((note) => note !== undefined)
            .join(' ');

          if (allItems.length === 0 && !comment) {
            return null;
          }

          return <ExamReviewGroup key={sectionKey} label={section.label} items={allItems} comment={comment} />;
        })
        .filter(Boolean)}
      {unmatchedItems.length > 0 && <ExamReviewGroup label="Other findings" items={unmatchedItems} />}
    </Box>
  );
};
