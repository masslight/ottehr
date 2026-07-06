import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { PrescribedMedicationDTO } from 'utils';
import { mapResourceByNameField } from '../../helpers/mappers';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, pharmacyInfo, Prescriptions } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

const toPharmacyInfo = (pharmacy: ErxGetPharmacyResponse): pharmacyInfo => ({
  name: pharmacy.name,
  address: [pharmacy.address1, pharmacy.address2, pharmacy.city, pharmacy.state, pharmacy.zipCode]
    .filter(Boolean)
    .join(', '),
  phone: pharmacy.phone,
});

export const composePrescriptions: DataComposer<
  { allChartData: AllChartData; erxPharmacies?: Record<string, ErxGetPharmacyResponse> },
  Prescriptions
> = ({ allChartData, erxPharmacies }) => {
  const meds = allChartData.additionalChartData?.prescribedMedications ?? [];

  const groups = new Map<string | undefined, PrescribedMedicationDTO[]>();
  for (const med of meds) {
    const key = med.pharmacyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(med);
  }

  const pharmacyGroups = Array.from(groups.entries()).map(([pharmacyId, groupMeds]) => ({
    pharmacy: pharmacyId && erxPharmacies?.[pharmacyId] ? toPharmacyInfo(erxPharmacies[pharmacyId]) : undefined,
    prescriptions: mapResourceByNameField(groupMeds),
  }));

  return { pharmacyGroups };
};

export const createPrescriptionsSection = <TData extends { prescriptions?: Prescriptions }>(): PdfSection<
  TData,
  Prescriptions
> => {
  return createConfiguredSection(null, () => ({
    title: 'Prescriptions',
    dataSelector: (data) => data.prescriptions,
    shouldRender: (sectionData) => sectionData.pharmacyGroups.some((g) => g.prescriptions.length > 0),
    render: (client, data, styles) => {
      data.pharmacyGroups.forEach((group) => {
        if (group.pharmacy) {
          const pharmacyValue = [group.pharmacy.name, group.pharmacy.address, group.pharmacy.phone]
            .filter(Boolean)
            .join(', ');
          client.drawTextSequential('Pharmacy: ', styles.textStyles.examBoldField);
          client.drawTextSequential(pharmacyValue, styles.textStyles.regularText);
        }
        group.prescriptions.forEach((prescription) => {
          client.drawText(prescription, styles.textStyles.regularText);
        });
      });

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
