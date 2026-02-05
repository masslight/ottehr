import { mapErxMedicationsToDisplay } from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { DischargeSummaryInput, ErxMedicationsData, PdfSection } from '../../types';

export const composeErxMedications: DataComposer<DischargeSummaryInput, ErxMedicationsData> = ({
  allChartData,
  appointmentPackage,
}) => {
  const { additionalChartData } = allChartData;
  const { timezone } = appointmentPackage;
  const medications = additionalChartData?.prescribedMedications
    ? mapErxMedicationsToDisplay(additionalChartData?.prescribedMedications, timezone)
    : [];
  return { medications };
};

export const createErxMedicationsSection = <TData extends { erxMedications?: ErxMedicationsData }>(): PdfSection<
  TData,
  ErxMedicationsData
> => {
  return createConfiguredSection(null, () => ({
    title: 'eRX',
    dataSelector: (data) => data.erxMedications,
    shouldRender: (sectionData) => !!sectionData.medications?.length,
    render: (client, data, styles) => {
      data.medications?.forEach((rx) => {
        client.drawText(`${rx.name}`, styles.textStyles.bold);
        if (rx.instructions) client.drawText(rx.instructions, styles.textStyles.regular);
        if (rx.date) client.drawText(rx.date, styles.textStyles.regular);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
