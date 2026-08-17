import { convert } from 'html-to-text';
import type { RadiologyDTO } from 'utils/lib/types/api/radiology';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, RadiologyData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeRadiology: DataComposer<{ allChartData: AllChartData }, RadiologyData> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const chartDataRadiologyOrders = additionalChartData?.radiologyOrders ?? [];

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

  // External orders have no DiagnosticReport; a reviewed upload is their result.
  const isResulted = (order: RadiologyDTO): boolean =>
    !!order.finalReport || !!(order.external && order.externalResultReviewed);

  const radiology = chartDataRadiologyOrders.filter(isResulted).map((order) => ({
    name: order.studyType,
    performedBy: order.performedBy?.name,
    result: handleFinalReport(order.finalReport),
  }));

  const pendingRadiologyOrders = chartDataRadiologyOrders
    .filter((order) => !isResulted(order))
    .map((order) => order.studyType);

  return { radiology, pendingRadiologyOrders };
};

export const createRadiologySection = <TData extends { radiology?: RadiologyData }>(): PdfSection<
  TData,
  RadiologyData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Radiology',
    dataSelector: (data) => data.radiology,
    shouldRender: (sectionData) => !!sectionData.radiology?.length || !!sectionData.pendingRadiologyOrders?.length,
    render: (client, data, styles) => {
      if (data.pendingRadiologyOrders?.length) {
        client.drawText('Pending Results:', styles.textStyles.subHeader);
        data.pendingRadiologyOrders.forEach((name) => client.drawText(name, styles.textStyles.regularText));
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
