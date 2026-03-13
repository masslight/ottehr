import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, MedicalDecision, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeMedicalDecision: DataComposer<{ allChartData: AllChartData }, MedicalDecision> = ({
  allChartData,
}) => {
  const { additionalChartData } = allChartData;
  const medicalDecision = additionalChartData?.medicalDecision?.text;

  return {
    medicalDecision,
  };
};

export const createMedicalDecisionSection = <
  TData extends { encounter?: EncounterInfo; medicalDecision?: MedicalDecision },
>(): PdfSection<TData, MedicalDecision> => {
  return createConfiguredSection(null, () => ({
    title: 'Medical Decision Making',
    dataSelector: (data) => data.medicalDecision,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.medicalDecision,
    render: (client, data, styles) => {
      drawRegularText(client, styles, data.medicalDecision);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
