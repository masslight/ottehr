import { mapErxMedicationsToDisplay } from 'utils';
import { groupPrescriptionsByPharmacy } from '../../helpers/pharmacy';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { DischargeSummaryInput, ErxMedicationsData, PdfSection } from '../../types';

export const composeErxMedications: DataComposer<
  Pick<DischargeSummaryInput, 'allChartData' | 'appointmentPackage' | 'erxPharmacies'>,
  ErxMedicationsData
> = ({ allChartData, appointmentPackage, erxPharmacies }) => {
  const meds = allChartData.additionalChartData?.prescribedMedications ?? [];
  const { timezone } = appointmentPackage;
  const pharmacyGroups = groupPrescriptionsByPharmacy(meds, erxPharmacies).map(({ pharmacy, meds: groupMeds }) => ({
    pharmacy,
    medications: mapErxMedicationsToDisplay(groupMeds, timezone),
  }));
  return { pharmacyGroups };
};

export const createErxMedicationsSection = <TData extends { erxMedications?: ErxMedicationsData }>(): PdfSection<
  TData,
  ErxMedicationsData
> => {
  return createConfiguredSection(null, () => ({
    title: 'eRX',
    dataSelector: (data) => data.erxMedications,
    shouldRender: (sectionData) => sectionData.pharmacyGroups.some((g) => g.medications.length > 0),
    render: (client, data, styles) => {
      data.pharmacyGroups.forEach((group) => {
        if (group.pharmacy) {
          const pharmacyValue = [group.pharmacy.name, group.pharmacy.address, group.pharmacy.phone]
            .filter(Boolean)
            .join(', ');
          client.drawTextSequential('Pharmacy: ', { ...styles.textStyles.bold, newLineAfter: false });
          client.drawTextSequential(pharmacyValue, styles.textStyles.regularText);
        }
        group.medications.forEach((rx) => {
          client.drawText(`${rx.name}`, styles.textStyles.bold);
          if (rx.instructions) client.drawText(rx.instructions, styles.textStyles.regular);
          if (rx.date) client.drawText(rx.date, styles.textStyles.regular);
        });
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
