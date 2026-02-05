import {
  ExamCardComponent,
  examConfig,
  ExamObservationDTO,
  GetChartDataResponse,
  isDropdownComponent,
  isInPersonAppointment,
  isMultiSelectComponent,
} from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import {
  EncounterInfo,
  Examination,
  PdfExaminationBlockData,
  PdfSection,
  ProgressNoteVisitDataInput,
} from '../../types';

export const composeExamination: DataComposer<ProgressNoteVisitDataInput, Examination> = ({
  allChartData,
  appointmentPackage,
}) => {
  const { chartData } = allChartData;
  const { appointment } = appointmentPackage;
  const isInPerson = isInPersonAppointment(appointment);

  const { examination } = parseExamFieldsFromExamObservations(chartData, isInPerson);

  return { examination };
};

export const createExaminationSection = <
  TData extends { encounter?: EncounterInfo; examination?: Examination },
>(): PdfSection<TData, Examination> => {
  return createConfiguredSection(null, () => ({
    title: 'Examination',
    dataSelector: (data) => data.examination,
    shouldRender: (_sectionData, rootData) => !rootData?.encounter?.isFollowup,
    render: (client, data, styles, assets) => {
      const drawExamProviderComment = (comment?: string): void => {
        if (!comment) {
          client.setY(client.getY() - 16);
          return;
        }
        // +8 we add as margin between exam cards and comments
        client.setY(client.getY() - 8);
        client.drawText(comment, styles.textStyles.examProviderComment);
      };
      const drawExtraItems = (extraItems?: string[]): void => {
        if (!extraItems) return;
        extraItems.forEach((item, index) => {
          client.drawText(item, styles.textStyles.regularText);
          if (index + 1 < extraItems.length)
            client.drawSeparatedLine(styles.lineStyles.examExtraItemsSeparatedLineStyle);
        });
      };
      const drawExaminationCard = (
        cardHeader: string,
        cardContent?: Array<{ label: string; abnormal: boolean; field: string }>,
        extraItems?: string[],
        cardComment?: string
      ): void => {
        if ((cardContent && cardContent.length > 0) || cardComment) {
          client.drawTextSequential(cardHeader, styles.textStyles.examCardHeader);
          if (cardContent && cardContent.length > 0) {
            const headerDims = client.getTextDimensions(cardHeader, styles.textStyles.examCardHeader);
            client.setLeftBound(client.getLeftBound() + headerDims.width);
            cardContent.forEach((item) => {
              const itemText = ` ${item.label}   `;
              const textDimensions = client.getTextDimensions(itemText, styles.textStyles.examBoldField);
              if (
                textDimensions.width + styles.imageStyles!.examColorDotsStyle.width + client.getX() >
                client.getRightBound()
              )
                client.newLine(textDimensions.height + styles.textStyles.examBoldField.spacing);
              if (item.abnormal) {
                client.drawImage(
                  assets.icons!.redDot,
                  styles.imageStyles!.examColorDotsStyle,
                  styles.textStyles.examBoldField
                );
                client.drawTextSequential(itemText, styles.textStyles.examBoldField);
              } else {
                client.drawImage(
                  assets.icons!.greenDot,
                  styles.imageStyles!.examColorDotsStyle,
                  styles.textStyles.examRegularField
                );
                client.drawTextSequential(itemText, styles.textStyles.examRegularField);
              }
            });
            client.setLeftBound(client.getLeftBound() - headerDims.width);
          }
          if (extraItems || [].length > 0) {
            client.newLine(
              client.getTextDimensions('A', styles.textStyles.examRegularField).height +
                styles.textStyles.examRegularField.spacing
            );
            drawExtraItems(extraItems);
          } else {
            client.newLine(client.getTextDimensions('a', styles.textStyles.examRegularField).height + 2);
          }
          if (cardComment) drawExamProviderComment(cardComment);
        }
      };

      const examination = data.examination;

      if (examination && Object.keys(examination).length > 0) {
        Object.entries(examination).forEach(([sectionKey, section]) => {
          if (section.items && section.items.length > 0) {
            const sectionLabel = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
            drawExaminationCard(`${sectionLabel}:   `, section.items, undefined, section.comment);
          } else if (section.comment) {
            // If there are no items but there's a comment, still show the section
            const sectionLabel = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
            drawExaminationCard(`${sectionLabel}:   `, [], undefined, section.comment);
          }
        });
      }

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};

function parseExamFieldsFromExamObservations(
  chartData: GetChartDataResponse,
  isInPersonAppointment: boolean
): {
  examination: PdfExaminationBlockData['examination'];
} {
  const examObservations: {
    [field: string]: ExamObservationDTO;
  } = {};
  chartData.examObservations?.forEach((exam) => {
    examObservations[exam.field] = exam;
  });

  // Get exam configuration based on whether it's in-person or telemed
  const examConfigComponents = examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;

  // If no exam config or observations, return empty examination
  if (!examConfigComponents || !chartData.examObservations || chartData.examObservations.length === 0) {
    return {
      examination: {},
    };
  }

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
    section: 'normal' | 'abnormal'
  ): Array<{ field: string; label: string; abnormal: boolean }> => {
    const items: Array<{ field: string; label: string; abnormal: boolean }> = [];

    Object.entries(components).forEach(([fieldName, component]) => {
      if (component.type === 'text') return;

      switch (component.type) {
        case 'checkbox': {
          const observation = examObservations[fieldName];
          if (observation && typeof observation.value === 'boolean' && observation.value === true) {
            items.push({
              field: fieldName,
              label: component.label,
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
                items.push({
                  field: optionName,
                  label: `${component.label}: ${option.label}`,
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
              const formattedElementName = formatElementName(elementName);
              const note = observation.note ? ` | ${observation.note}` : '';

              items.push({
                field: elementName,
                label: `${component.label}: ${formattedElementName}${note}`,
                abnormal: section === 'abnormal',
              });
            }
          });
          break;
        }

        case 'multi-select': {
          if (isMultiSelectComponent(component)) {
            const selectedOptions: { field: string; label: string; abnormal: boolean }[] = [];
            Object.entries(component.options).forEach(([optionName, option]) => {
              const observation = examObservations[optionName];
              if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                const description = option.description ? ` (${option.description})` : '';
                selectedOptions.push({
                  field: optionName,
                  label: `${component.label}: ${option.label}${description}`,
                  abnormal: section === 'abnormal',
                });
              }
            });
            const observation = examObservations[fieldName];
            if (observation && observation.value === true && selectedOptions.length === 0) {
              items.push({
                field: fieldName,
                label: component.label,
                abnormal: section === 'abnormal',
              });
            }
            items.push(...selectedOptions);
          }
          break;
        }

        case 'column': {
          const nestedItems = extractObservationsFromComponents(component.components, section);
          const itemsWithColumnLabel = nestedItems.map((item) => ({
            ...item,
            label: `${component.label}: ${item.label}`,
          }));
          items.push(...itemsWithColumnLabel);
          break;
        }

        default:
          break;
      }
    });

    return items;
  };

  const examinationData: Record<
    string,
    { items: Array<{ field: string; label: string; abnormal: boolean }>; comment?: string }
  > = {};

  Object.entries(examConfigComponents).forEach(([sectionKey, section]) => {
    const normalItems = extractObservationsFromComponents(section.components.normal, 'normal');
    const abnormalItems = extractObservationsFromComponents(section.components.abnormal, 'abnormal');
    const allItems = [...normalItems, ...abnormalItems];

    let comment: string | undefined;
    Object.keys(section.components.comment).forEach((commentKey) => {
      const observation = examObservations[commentKey];
      if (observation?.note) {
        comment = observation.note;
      }
    });

    examinationData[sectionKey] = {
      items: allItems,
      comment,
    };
  });

  return {
    examination: examinationData,
  };
}
