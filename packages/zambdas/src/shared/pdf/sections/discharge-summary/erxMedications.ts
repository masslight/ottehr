import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { mapErxMedicationsToDisplay, PrescribedMedicationDTO } from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { DischargeSummaryInput, ErxMedicationsData, PdfSection, pharmacyInfo } from '../../types';

const toPharmacyInfo = (pharmacy: ErxGetPharmacyResponse): pharmacyInfo => ({
  name: pharmacy.name,
  address: [pharmacy.address1, pharmacy.address2, pharmacy.city, pharmacy.state, pharmacy.zipCode]
    .filter(Boolean)
    .join(', '),
  phone: pharmacy.phone,
});

export const composeErxMedications: DataComposer<
  Pick<DischargeSummaryInput, 'allChartData' | 'appointmentPackage' | 'erxPharmacies'>,
  ErxMedicationsData
> = ({ allChartData, appointmentPackage, erxPharmacies }) => {
  const { additionalChartData } = allChartData;
  const { timezone } = appointmentPackage;
  const meds = additionalChartData?.prescribedMedications ?? [];

  const groups = new Map<string | undefined, PrescribedMedicationDTO[]>();
  for (const med of meds) {
    const key = med.pharmacyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(med);
  }

  const pharmacyGroups = Array.from(groups.entries()).map(([pharmacyId, groupMeds]) => ({
    pharmacy: pharmacyId && erxPharmacies?.[pharmacyId] ? toPharmacyInfo(erxPharmacies[pharmacyId]) : undefined,
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
