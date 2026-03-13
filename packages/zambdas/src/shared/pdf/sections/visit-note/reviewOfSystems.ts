import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, PdfSection, ReviewOfSystems } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeReviewOfSystems: DataComposer<{ allChartData: AllChartData }, ReviewOfSystems> = ({
  allChartData,
}) => {
  const { chartData } = allChartData;
  const reviewOfSystems = chartData.ros?.text;
  return {
    reviewOfSystems,
  };
};

export const createReviewOfSystemsSection = <
  TData extends {
    encounter?: EncounterInfo;
    reviewOfSystems?: ReviewOfSystems;
  },
>(): PdfSection<TData, ReviewOfSystems> => {
  return createConfiguredSection(null, () => ({
    title: 'Review of Systems',
    dataSelector: (data) => data.reviewOfSystems,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.reviewOfSystems,
    render: (client, data, styles) => {
      drawRegularText(client, styles, data.reviewOfSystems);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
