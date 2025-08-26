import { Box } from '@mui/material';
import { FC } from 'react';
import { ExamCardComponent, ExamItemConfig, isDropdownComponent, isMultiSelectComponent } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useExamObservationsStore } from '../../../../state';
import { ExamReviewComment } from './ExamReviewComment';
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
            Object.entries(component.options).forEach(([optionName, option]) => {
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

        case 'column': {
          const nestedItems = extractObservationsFromComponents(component.components, section, component.label);
          items.push(...nestedItems);
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

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer}
    >
      {Object.entries(examConfig).map(([sectionKey, section]) => {
        const { normalItems, abnormalItems } = getSectionObservations(sectionKey);
        const allItems = [...normalItems, ...abnormalItems];

        return (
          <Box key={sectionKey} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <ExamReviewGroup label={section.label} items={allItems} />

            {Object.keys(section.components.comment).map((key) => (
              <ExamReviewComment key={key} item={examObservations[key]} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
};
