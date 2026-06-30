import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { mapErxMedicationsToDisplay } from 'utils';
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
  Pick<DischargeSummaryInput, 'allChartData' | 'appointmentPackage' | 'erxPharmacy'>,
  ErxMedicationsData
> = ({ allChartData, appointmentPackage, erxPharmacy }) => {
  const { additionalChartData } = allChartData;
  const { timezone } = appointmentPackage;
  const medications = additionalChartData?.prescribedMedications
    ? mapErxMedicationsToDisplay(additionalChartData?.prescribedMedications, timezone)
    : [];
  return { medications, pharmacy: erxPharmacy ? toPharmacyInfo(erxPharmacy) : undefined };
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
      if (data.pharmacy) {
        const pharmacyValue = [data.pharmacy.name, data.pharmacy.address, data.pharmacy.phone]
          .filter(Boolean)
          .join(', ');
        client.drawTextSequential('Pharmacy: ', { ...styles.textStyles.bold, newLineAfter: false });
        client.drawTextSequential(pharmacyValue, styles.textStyles.regularText);
      }
      data.medications?.forEach((rx) => {
        client.drawText(`${rx.name}`, styles.textStyles.bold);
        if (rx.instructions) client.drawText(rx.instructions, styles.textStyles.regular);
        if (rx.date) client.drawText(rx.date, styles.textStyles.regular);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
