import { renderScreeningQuestionsForPDF } from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { AiObservationField, ASQ_FIELD, ASQKeys, asqLabels } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { drawBlockHeader } from '../../helpers/render/blockHeader';
import { drawRegularText } from '../../helpers/render/regularText';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { AdditionalQuestions, EncounterInfo, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

const AI_OBSERVATION_FIELDS = new Set<string>(Object.values(AiObservationField));

export const composeAdditionalQuestions: DataComposer<{ allChartData: AllChartData }, AdditionalQuestions> = ({
  allChartData,
}) => {
  const { chartData, additionalChartData } = allChartData;
  const additionalQuestions: Record<string, any> = {};
  // Include all screening observations, skipping AI-generated fields and the ASQ field (handled below).
  chartData.observations?.forEach((obs) => {
    if (obs.value !== undefined && !AI_OBSERVATION_FIELDS.has(obs.field) && obs.field !== ASQ_FIELD) {
      additionalQuestions[obs.field] = obs;
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
