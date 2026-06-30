import { ErxGetPharmacyResponse } from '@oystehr/sdk';
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
  { allChartData: AllChartData; erxPharmacy?: ErxGetPharmacyResponse },
  Prescriptions
> = ({ allChartData, erxPharmacy }) => {
  const { additionalChartData } = allChartData;
  const prescriptions = additionalChartData?.prescribedMedications
    ? mapResourceByNameField(additionalChartData.prescribedMedications)
    : [];
  return { prescriptions, pharmacy: erxPharmacy ? toPharmacyInfo(erxPharmacy) : undefined };
};

export const createPrescriptionsSection = <TData extends { prescriptions?: Prescriptions }>(): PdfSection<
  TData,
  Prescriptions
> => {
  return createConfiguredSection(null, () => ({
    title: 'Prescriptions',
    dataSelector: (data) => data.prescriptions,
    shouldRender: (sectionData) => !!sectionData.prescriptions?.length,
    render: (client, data, styles) => {
      if (data.pharmacy) {
        const pharmacyValue = [data.pharmacy.name, data.pharmacy.address, data.pharmacy.phone]
          .filter(Boolean)
          .join(', ');
        client.drawTextSequential('Pharmacy: ', styles.textStyles.examBoldField);
        client.drawTextSequential(pharmacyValue, styles.textStyles.regularText);
      }

      data.prescriptions.forEach((prescription) => {
        client.drawText(prescription, styles.textStyles.regularText);
      });

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
