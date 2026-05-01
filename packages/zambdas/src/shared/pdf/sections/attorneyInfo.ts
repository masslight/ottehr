import { ATTORNEY_FIRM_EXTENSION_URL, formatPhoneNumberDisplay } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { AttorneyDataInput, AttorneyInfo, PdfSection } from '../types';

export const composeAttorneyData: DataComposer<AttorneyDataInput, AttorneyInfo> = ({ attorneyRelatedPerson }) => {
  if (!attorneyRelatedPerson) {
    return {
      firm: '',
      firstName: '',
      lastName: '',
      email: '',
      mobile: '',
      fax: '',
    };
  }

  const firm =
    attorneyRelatedPerson.extension?.find((ext) => ext.url === ATTORNEY_FIRM_EXTENSION_URL)?.valueString ?? '';
  const firstName = attorneyRelatedPerson.name?.[0]?.given?.[0] ?? '';
  const lastName = attorneyRelatedPerson.name?.[0]?.family ?? '';

  const getPhoneDisplay = (system: string): string => {
    const value = attorneyRelatedPerson.telecom?.find((tel) => tel.system === system && tel.value)?.value;
    return value ? formatPhoneNumberDisplay(value) : '';
  };

  const email = attorneyRelatedPerson.telecom?.find((tel) => tel.system === 'email' && tel.value)?.value ?? '';
  const mobile = getPhoneDisplay('phone');
  const fax = getPhoneDisplay('fax');

  return {
    firm,
    firstName,
    lastName,
    email,
    mobile,
    fax,
  };
};

const hasAttorneyInfo = (info: AttorneyInfo): boolean =>
  !!(info.firm || info.firstName || info.lastName || info.email || info.mobile || info.fax);

export const createAttorneyInfoSection = <TData extends { attorney?: AttorneyInfo }>(): PdfSection<
  TData,
  AttorneyInfo
> => {
  return createConfiguredSection('attorneyInformation', (shouldShow) => ({
    title: 'Attorney for Motor Vehicle Accident',
    dataSelector: (data) => data.attorney,
    shouldRender: (attorney) => hasAttorneyInfo(attorney),
    render: (client, attorneyInfo, styles) => {
      // Each row is gated by `shouldShow` (so customer `hiddenFields` overrides
      // are honored) and by truthiness of the value (compact render: empty
      // optional fields are omitted, like the original behavior).
      if (shouldShow('attorney-mva-firm') && attorneyInfo.firm) {
        client.drawLabelValueRow('Firm', attorneyInfo.firm, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('attorney-mva-first-name') && attorneyInfo.firstName) {
        client.drawLabelValueRow(
          'First name',
          attorneyInfo.firstName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('attorney-mva-last-name') && attorneyInfo.lastName) {
        client.drawLabelValueRow(
          'Last name',
          attorneyInfo.lastName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('attorney-mva-email') && attorneyInfo.email) {
        client.drawLabelValueRow('Email', attorneyInfo.email, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('attorney-mva-mobile') && attorneyInfo.mobile) {
        client.drawLabelValueRow('Mobile', attorneyInfo.mobile, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('attorney-mva-fax') && attorneyInfo.fax) {
        client.drawLabelValueRow('Fax', attorneyInfo.fax, styles.textStyles.regular, styles.textStyles.regular, {
          spacing: 16,
        });
      }
    },
  }));
};
