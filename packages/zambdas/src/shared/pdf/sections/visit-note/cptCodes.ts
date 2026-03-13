import { makeCptCodeDisplay } from 'utils';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { CptCodes, EncounterInfo, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeCptCodes: DataComposer<{ allChartData: AllChartData }, CptCodes> = ({ allChartData }) => {
  const { chartData } = allChartData;
  const cptCodes = chartData?.cptCodes?.map((cpt) => makeCptCodeDisplay(cpt));
  return {
    cptCodes,
  };
};

export const createCptCodesSection = <TData extends { encounter?: EncounterInfo; cptCodes?: CptCodes }>(): PdfSection<
  TData,
  CptCodes
> => {
  return createConfiguredSection(null, () => ({
    title: 'CPT codes',
    dataSelector: (data) => data.cptCodes,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.cptCodes?.length,
    render: (client, data, styles) => {
      data.cptCodes?.forEach((cptCode) => {
        drawRegularText(client, styles, cptCode);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
