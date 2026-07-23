import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { mapResourceByNameField } from '../../helpers/mappers';
import { groupPrescriptionsByPharmacy } from '../../helpers/pharmacy';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, Prescriptions } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composePrescriptions: DataComposer<
  { allChartData: AllChartData; erxPharmacies?: Record<string, ErxGetPharmacyResponse> },
  Prescriptions
> = ({ allChartData, erxPharmacies }) => {
  const meds = allChartData.additionalChartData?.prescribedMedications ?? [];
  const pharmacyGroups = groupPrescriptionsByPharmacy(meds, erxPharmacies).map(({ pharmacy, meds: groupMeds }) => ({
    pharmacy,
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
