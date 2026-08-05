import { convert } from 'html-to-text';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, RadiologyData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeRadiology: DataComposer<{ allChartData: AllChartData }, RadiologyData> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const allRadiologyOrders = additionalChartData?.radiologyOrders ?? [];

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

  const radiology = allRadiologyOrders
    .filter((order) => !!order.finalReport)
    .map((order) => ({
      name: order.studyType,
      performedBy: order.performedBy?.name,
      result: handleFinalReport(order.finalReport),
    }));

  const pendingOrderNames = allRadiologyOrders.filter((order) => !order.finalReport).map((order) => order.studyType);

  return { radiology, radiologyOrders: pendingOrderNames };
};

export const createRadiologySection = <TData extends { radiology?: RadiologyData }>(): PdfSection<
  TData,
  RadiologyData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Radiology',
    dataSelector: (data) => data.radiology,
    shouldRender: (sectionData) => !!sectionData.radiology?.length || !!sectionData.radiologyOrders?.length,
    render: (client, data, styles) => {
      if (data.radiologyOrders?.length) {
        client.drawText('Pending Results:', styles.textStyles.subHeader);
        data.radiologyOrders.forEach((name) => client.drawText(name, styles.textStyles.regularText));
        if (data.radiology?.length) {
          client.newLine(8);
        }
      }
      if (data.radiology?.length) {
        client.drawText('Results:', styles.textStyles.subHeader);
        data.radiology.forEach((radiology) => {
          client.drawText(radiology.name, styles.textStyles.regularText);
          if (radiology.performedBy)
            client.drawText(`Performed by: ${radiology.performedBy}`, styles.textStyles.regularText);
          if (radiology.result) client.drawText(`Final Read: ${radiology.result}`, styles.textStyles.regularText);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
