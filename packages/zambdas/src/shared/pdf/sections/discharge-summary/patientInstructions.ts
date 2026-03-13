import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PatientInstructionsData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composePatientInstructions: DataComposer<{ allChartData: AllChartData }, PatientInstructionsData> = ({
  allChartData,
}) => {
  const { chartData } = allChartData;

  const instructions: string[] = [];
  chartData?.instructions?.forEach((item) => {
    if (item.text) instructions.push(item.text);
  });
  return { instructions };
};

export const createPatientInstructionsSection = <
  TData extends { patientInstructions?: PatientInstructionsData },
>(): PdfSection<TData, PatientInstructionsData> => {
  return createConfiguredSection(null, () => ({
    title: 'Patient Instructions',
    dataSelector: (data) => data.patientInstructions,
    shouldRender: (sectionData) => !!sectionData.instructions?.length,
    render: (client, data, styles) => {
      data.instructions?.forEach((instruction) => {
        client.drawText(`- ${instruction}`, styles.textStyles.regular);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
