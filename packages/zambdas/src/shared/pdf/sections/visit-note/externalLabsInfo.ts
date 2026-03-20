import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { ExternalLabs, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';
import { renderLabsSection } from './renderLabsSection';

export const composeExternalLabs: DataComposer<{ allChartData: AllChartData }, ExternalLabs> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const externalLabResults = additionalChartData?.externalLabResults?.labOrderResults ?? [];
  const externalLabOrdersWithoutResults = additionalChartData?.externalLabResults?.resultsPending ?? [];

  return { externalLabResults, externalLabOrders: externalLabOrdersWithoutResults };
};

export const createExternalLabsSection = <TData extends { externalLabs?: ExternalLabs }>(): PdfSection<
  TData,
  ExternalLabs
> => {
  return createConfiguredSection(null, () => ({
    title: 'External Labs',
    dataSelector: (data) => data.externalLabs,
    shouldRender: (sectionData) => !!sectionData.externalLabResults?.length || !!sectionData.externalLabOrders?.length,
    render: (client, data, styles, assets) => {
      renderLabsSection(
        client,
        {
          orders: data.externalLabOrders,
          results: data.externalLabResults,
        },
        styles,
        assets,
        'external'
      );
    },
  }));
};
