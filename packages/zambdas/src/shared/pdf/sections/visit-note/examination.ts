import {
  collectKnownExamFields,
  examConfig,
  ExamObservationDTO,
  extractObservationsFromExamComponents,
  GetChartDataResponse,
} from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, Examination, PdfSection, ProgressNoteVisitDataInput } from '../../types';

export const composeExamination: DataComposer<ProgressNoteVisitDataInput, Examination> = ({ allChartData }) => {
  return parseExamFieldsFromExamObservations(allChartData.chartData);
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
        Object.entries(examination).forEach(([_sectionKey, section]) => {
          const sectionLabel = section.groupLabel;

          if (section.items && section.items.length > 0) {
            drawExaminationCard(`${sectionLabel}:   `, section.items, undefined, section.comment);
          } else if (section.comment) {
            // If there are no items but there's a comment, still show the section
            drawExaminationCard(`${sectionLabel}:   `, [], undefined, section.comment);
          }
        });
      }

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};

function parseExamFieldsFromExamObservations(chartData: GetChartDataResponse): {
  examination: Examination['examination'];
} {
  const examObservations: {
    [field: string]: ExamObservationDTO;
  } = {};
  chartData.examObservations?.forEach((exam) => {
    examObservations[exam.field] = exam;
  });

  const examConfigComponents = examConfig.default.components;

  // If no exam config or observations, return empty examination
  if (!examConfigComponents || !chartData.examObservations || chartData.examObservations.length === 0) {
    return {
      examination: {},
    };
  }

  const matchedFields = collectKnownExamFields(examConfigComponents);

  const examinationData: Examination['examination'] = {};

  Object.entries(examConfigComponents).forEach(([sectionKey, section]) => {
    const normalItems = extractObservationsFromExamComponents(section.components.normal, 'normal', examObservations);
    const abnormalItems = extractObservationsFromExamComponents(
      section.components.abnormal,
      'abnormal',
      examObservations
    );
    const allItems = [...normalItems, ...abnormalItems];

    let comment: string | undefined;
    Object.keys(section.components.comment).forEach((commentKey) => {
      const observation = examObservations[commentKey];
      if (observation?.note) {
        comment = observation.note;
      }
    });

    examinationData[sectionKey] = {
      groupLabel: section.label,
      items: allItems,
      comment,
    };
  });

  // Add unmatched observations as "Other findings"
  const unmatchedItems = Object.values(examObservations)
    .filter((obs) => obs.value === true && !matchedFields.has(obs.field))
    .map((obs) => ({
      field: obs.field,
      label: obs.label || obs.field,
      abnormal: true,
    }));

  if (unmatchedItems.length > 0) {
    examinationData['other-findings'] = {
      groupLabel: 'Other findings',
      items: unmatchedItems,
    };
  }

  return {
    examination: examinationData,
  };
}
