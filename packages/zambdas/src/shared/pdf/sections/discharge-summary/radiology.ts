import { convert } from 'html-to-text';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, RadiologyData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeRadiology: DataComposer<{ allChartData: AllChartData }, RadiologyData> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const radiologyOrders = additionalChartData?.radiologyOrders;

  const handleFinalReport = (finalReport: string | undefined): string => {
    let result = '';

    if (!finalReport) return result;

    try {
      result = convert(atob(finalReport));
    } catch {
      result = finalReport;
    }

    return result;
  };

  const radiology = radiologyOrders?.map((order) => ({
    name: order.studyType,
    result: handleFinalReport(order.finalReport),
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
        client.drawText(radiology.name, styles.textStyles.regularText);
        if (radiology.result) client.drawText(`Final Read: ${radiology.result}`, styles.textStyles.regularText);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
