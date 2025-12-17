import { Organization } from 'fhir/r4b';
import { DataComposer } from '../pdf-common';
import { PdfSection, pharmacyInfo } from '../types';

export const composePharmacyData: DataComposer<Organization | undefined, pharmacyInfo> = (pharmacy) => {
  const name = pharmacy?.name ?? '';
  const address = pharmacy?.address?.[0].text ?? '';

  return {
    name,
    address,
  };
};

export const createPharmacyFormsSection = <TData extends { pharmacy?: pharmacyInfo }>(): PdfSection<
  TData,
  pharmacyInfo
> => ({
  title: 'Preferred pharmacy',
  dataSelector: (data) => data.pharmacy,
  render: (client, data, styles) => {
    client.drawLabelValueRow('Pharmacy name', data.name, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow(`Pharmacy address`, data.address, styles.textStyles.regular, styles.textStyles.regular, {
      spacing: 16,
    });
  },
});
