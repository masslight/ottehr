import { mapResourceByNameField } from '../../helpers/mappers';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { DiagnosesData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeDiagnoses: DataComposer<{ allChartData: AllChartData }, DiagnosesData> = ({ allChartData }) => {
  const { chartData } = allChartData;
  const diagnoses = chartData?.diagnosis
    ? {
        primary: mapResourceByNameField(chartData.diagnosis.filter((d) => d.isPrimary)),
        secondary: mapResourceByNameField(chartData.diagnosis.filter((d) => !d.isPrimary)),
      }
    : { primary: [], secondary: [] };
  return diagnoses;
};

export const createDiagnosesSection = <TData extends { diagnoses?: DiagnosesData }>(): PdfSection<
  TData,
  DiagnosesData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Assessment',
    dataSelector: (data) => data.diagnoses,
    shouldRender: (sectionData) => !!sectionData.primary?.length || !!sectionData.secondary?.length,
    render: (client, data, styles) => {
      if (data.primary.length) {
        client.drawText('Primary Dx:', styles.textStyles.subHeader);
        data.primary.forEach((dx) => {
          client.drawText(dx, styles.textStyles.regular);
        });
      }
      if (data.secondary.length) {
        client.drawText('Secondary Dx:', styles.textStyles.subHeader);
        data.secondary.forEach((dx) => {
          client.drawText(dx, styles.textStyles.regular);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
