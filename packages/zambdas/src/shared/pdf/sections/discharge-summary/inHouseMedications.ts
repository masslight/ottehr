import { mapMedicationsToDisplay } from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { DischargeSummaryInput, InHouseMedicationsDataForDischargeSummary, PdfSection } from '../../types';

export const composeInHouseMedicationsForDischargeSummary: DataComposer<
  DischargeSummaryInput,
  InHouseMedicationsDataForDischargeSummary
> = ({ allChartData, appointmentPackage }) => {
  const { medicationOrders } = allChartData;
  const { timezone } = appointmentPackage;
  const inHouseMedications = medicationOrders ? mapMedicationsToDisplay(medicationOrders, timezone) : [];

  return { inHouseMedications };
};

export const createInHouseMedicationsSectionForDischargeSummary = <
  TData extends { inHouseMedications?: InHouseMedicationsDataForDischargeSummary },
>(): PdfSection<TData, InHouseMedicationsDataForDischargeSummary> => {
  return createConfiguredSection(null, () => ({
    title: 'In-House Medications',
    dataSelector: (data) => data.inHouseMedications,
    shouldRender: (sectionData) => !!sectionData.inHouseMedications?.length,
    render: (client, data, styles) => {
      data.inHouseMedications.forEach((medication) => {
        client.drawText(
          `${medication.name}${medication.dose ? ' - ' + medication.dose : ''}${
            medication.route ? ' / ' + medication.route : ''
          }`,
          styles.textStyles.bold
        );
        if (medication.date) client.drawText(medication.date, styles.textStyles.regular);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
