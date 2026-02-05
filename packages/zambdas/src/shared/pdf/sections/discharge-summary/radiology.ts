import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, RadiologyData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeRadiology: DataComposer<{ allChartData: AllChartData }, RadiologyData> = ({ allChartData }) => {
  const { radiologyData } = allChartData;

  const radiology = radiologyData?.orders.map((order) => ({
    name: order.studyType,
    result: order.result,
  }));
  return { radiology };
};

export const createRadiologySection = <TData extends { radiology?: RadiologyData }>(): PdfSection<
  TData,
  RadiologyData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Radiology',
    dataSelector: (data) => data.radiology,
    shouldRender: (sectionData) => !!sectionData.radiology?.length,
    render: (client, data, styles) => {
      data.radiology?.forEach((radiology) => {
        client.drawText(radiology.name, styles.textStyles.bold);
        if (radiology.result) client.drawText(`Final Read: ${radiology.result}`, styles.textStyles.regular);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
