import {
  ASQ_FIELD,
  ASQKeys,
  asqLabels,
  NOTE_TYPE,
  patientScreeningQuestionsConfig,
  renderScreeningQuestionsForPDF,
} from 'utils';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { AdditionalQuestions, EncounterInfo, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeAdditionalQuestions: DataComposer<{ allChartData: AllChartData }, AdditionalQuestions> = ({
  allChartData,
}) => {
  const { chartData, additionalChartData } = allChartData;
  const additionalQuestions: Record<string, any> = {};
  // Add ALL fields from config (if they have values)
  patientScreeningQuestionsConfig.fields.forEach((field) => {
    const observation = chartData.observations?.find((obs) => obs.field === field.fhirField);
    if (observation?.value !== undefined) {
      additionalQuestions[field.fhirField] = observation;
    }
  });

  const currentASQObs = chartData?.observations?.find((obs) => obs.field === ASQ_FIELD);
  const currentASQ = (currentASQObs && asqLabels[currentASQObs.value as ASQKeys]) ?? '';

  const screeningNotes =
    additionalChartData?.notes?.filter((note) => note.type === NOTE_TYPE.SCREENING)?.map((note) => note.text) ?? [];
  return {
    additionalQuestions,
    currentASQ,
    notes: screeningNotes,
  };
};

export const createAdditionalQuestionsSection = <
  TData extends { encounter?: EncounterInfo; screening?: AdditionalQuestions },
>(): PdfSection<TData, AdditionalQuestions> => {
  return createConfiguredSection(null, () => ({
    title: 'Additional questions',
    dataSelector: (data) => data.screening,
    shouldRender: (sectionData, rootData) =>
      !rootData?.encounter?.isFollowup &&
      (!!sectionData.additionalQuestions?.length || !!sectionData.currentASQ || !!sectionData.notes),
    render: (client, data, styles) => {
      if (data.additionalQuestions) {
        renderScreeningQuestionsForPDF(data.additionalQuestions, (question, formattedValue) => {
          drawRegularText(client, styles, `${question} - ${formattedValue}`);
        });
      }

      if (data.currentASQ) {
        drawRegularText(client, styles, `ASQ - ${data.currentASQ}`);
      }

      if (data.notes && data.notes.length > 0) {
        drawBlockHeader(client, styles, 'Screening notes', styles.textStyles.blockSubHeader);
        data.notes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
