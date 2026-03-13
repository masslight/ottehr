import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { Assessment, EncounterInfo, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeAssessment: DataComposer<{ allChartData: AllChartData }, Assessment> = ({ allChartData }) => {
  const { chartData } = allChartData;
  const diagnoses = chartData?.diagnosis || [];
  const primary = diagnoses.find((item) => item.isPrimary)?.display ?? '';
  const secondary = diagnoses.filter((item) => !item.isPrimary).map((item) => item.display);

  return {
    primary,
    secondary,
  };
};

export const createAssessmentSection = <
  TData extends { encounter?: EncounterInfo; assessment?: Assessment },
>(): PdfSection<TData, Assessment> => {
  return createConfiguredSection(null, () => ({
    title: 'Assessment',
    dataSelector: (data) => data.assessment,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.primary,
    render: (client, data, styles) => {
      drawBlockHeader(client, styles, 'Primary:', styles.textStyles.blockSubHeader);
      drawRegularText(client, styles, data.primary);
      if (data.secondary.length > 0) {
        drawBlockHeader(client, styles, 'Secondary:', styles.textStyles.blockSubHeader);
        data.secondary.forEach((assessment) => {
          drawRegularText(client, styles, assessment);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
