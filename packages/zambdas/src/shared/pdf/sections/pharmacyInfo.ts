import { Organization } from 'fhir/r4b';
import { PHONE_NOT_ON_FILE } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { PdfSection, pharmacyInfo } from '../types';

export const composePharmacyData: DataComposer<Organization | undefined, pharmacyInfo> = (pharmacy) => {
  const name = pharmacy?.name ?? '';
  const address = pharmacy?.address?.[0].text ?? '';
  const phone = pharmacy?.telecom?.find((c) => c.system === 'phone')?.value ?? '';

  return {
    name,
    address,
    phone,
  };
};

export const createPharmacyFormsSection = <TData extends { pharmacy?: pharmacyInfo }>(): PdfSection<
  TData,
  pharmacyInfo
> => {
  return createConfiguredSection('preferredPharmacy', (shouldShow) => ({
    title: 'Preferred pharmacy',
    dataSelector: (data) => data.pharmacy,
    render: (client, data, styles) => {
      if (shouldShow('pharmacy-name')) {
        client.drawLabelValueRow('Pharmacy name', data.name, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      const shouldShowPhone = shouldShow('pharmacy-phone');
      if (shouldShow('pharmacy-address')) {
        client.drawLabelValueRow(
          `Pharmacy address`,
          data.address,
          styles.textStyles.regular,
          styles.textStyles.regular,
          shouldShowPhone
            ? {
                drawDivider: true,
                dividerMargin: 8,
              }
            : {
                spacing: 16,
              }
        );
      }
      if (shouldShowPhone) {
        client.drawLabelValueRow(`Pharmacy phone`, data.phone, styles.textStyles.regular, styles.textStyles.regular, {
          defaultValue: PHONE_NOT_ON_FILE,
          spacing: 16,
        });
      }
    },
  }));
};
