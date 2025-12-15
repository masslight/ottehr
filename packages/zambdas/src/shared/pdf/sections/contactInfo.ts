import { formatPhoneNumberDisplay, PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL } from 'utils';
import { DataComposer } from '../pdf-common';
import { ContactInfo, PatientDataInput, PdfSection } from '../types';

export const composeContactData: DataComposer<PatientDataInput, ContactInfo> = ({ patient }) => {
  const patientAddress = patient.address?.[0];
  const streetAddress = patientAddress?.line?.[0] ?? '';
  const addressLineOptional = patientAddress?.line?.[1] ?? '';
  const city = patientAddress?.city ?? '';
  const state = patientAddress?.state ?? '';
  const zip = patientAddress?.postalCode ?? '';

  const patientMobile =
    formatPhoneNumberDisplay(
      patient?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value
    ) ?? '';
  const patientEmail = patient?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value ?? '';

  const patientPreferredCommunicationMethod =
    patient.extension?.find((e) => e.url === PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL)?.valueString ?? '';

  return {
    streetAddress,
    addressLineOptional,
    city,
    state,
    zip,
    patientMobile,
    patientEmail,
    patientPreferredCommunicationMethod,
  };
};

export const createContactInfoSection = <TData extends { contact?: ContactInfo }>(): PdfSection<
  TData,
  ContactInfo
> => ({
  title: 'Contact information',
  dataSelector: (data) => data.contact,
  render: (client, contactInfo, styles) => {
    client.drawLabelValueRow(
      'Street address',
      contactInfo.streetAddress,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      'Address line 2',
      contactInfo.addressLineOptional,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      'City, State, ZIP',
      `${contactInfo.city}, ${contactInfo.state}, ${contactInfo.zip}`,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow('Email', contactInfo.patientEmail, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow(
      'Mobile',
      contactInfo.patientMobile,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      'Preferred Communication Method',
      contactInfo.patientPreferredCommunicationMethod,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        spacing: 16,
      }
    );
  },
});
