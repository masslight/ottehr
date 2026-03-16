import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { InHouseLabs, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';
import { renderLabsSection } from './renderLabsSection';

export const composeInHouseLabs: DataComposer<{ allChartData: AllChartData }, InHouseLabs> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const inHouseLabResults = additionalChartData?.inHouseLabResults?.labOrderResults ?? [];

  const inHouseLabOrdersWithoutResults = additionalChartData?.inHouseLabResults?.resultsPending ?? [];

  return { inHouseLabResults, inHouseLabOrders: inHouseLabOrdersWithoutResults };
};

export const createInHouseLabsSection = <TData extends { inHouseLabs?: InHouseLabs }>(): PdfSection<
  TData,
  InHouseLabs
> => {
  return createConfiguredSection(null, () => ({
    title: 'In-House Labs',
    dataSelector: (data) => data.inHouseLabs,
    shouldRender: (sectionData) => !!sectionData.inHouseLabResults?.length || !!sectionData.inHouseLabOrders?.length,
    render: (client, data, styles, assets) => {
      renderLabsSection(
        client,
        {
          orders: data.inHouseLabOrders,
          results: data.inHouseLabResults,
        },
        styles,
        assets,
        'inhouse'
      );
    },
  }));
};
