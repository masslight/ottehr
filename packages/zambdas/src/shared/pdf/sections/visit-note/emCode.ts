import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EmCode, EncounterInfo, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeEmCode: DataComposer<{ allChartData: AllChartData }, EmCode> = ({ allChartData }) => {
  const { chartData } = allChartData;
  const emCode = chartData?.emCode?.display;
  return {
    emCode,
  };
};

export const createEmCodeSection = <TData extends { encounter?: EncounterInfo; emCode?: EmCode }>(): PdfSection<
  TData,
  EmCode
> => {
  return createConfiguredSection(null, () => ({
    title: 'E&M code',
    dataSelector: (data) => data.emCode,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.emCode,
    render: (client, data, styles) => {
      drawRegularText(client, styles, data.emCode, 'No E&M code provided.');
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
