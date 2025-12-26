import { formatPhoneNumberDisplay, getFirstName, getLastName, getMiddleName } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { EmergencyContactDataInput, EmergencyContactInfo, PdfSection } from '../types';

export const composeEmergencyContactData: DataComposer<EmergencyContactDataInput, EmergencyContactInfo> = ({
  emergencyContactResource,
}) => {
  const emergencyContactAddress = emergencyContactResource?.address?.[0];
  const streetAddress = emergencyContactAddress?.line?.[0] ?? '';
  const addressLineOptional = emergencyContactAddress?.line?.[1] ?? '';
  const city = emergencyContactAddress?.city ?? '';
  const state = emergencyContactAddress?.state ?? '';
  const zip = emergencyContactAddress?.postalCode ?? '';

  const phone = formatPhoneNumberDisplay(
    emergencyContactResource?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value ?? ''
  );

  let firstName = '';
  let middleName = '';
  let lastName = '';
  if (emergencyContactResource) {
    firstName = getFirstName(emergencyContactResource) ?? '';
    middleName = getMiddleName(emergencyContactResource) ?? '';
    lastName = getLastName(emergencyContactResource) ?? '';
  }

  let relationship = '';
  if (emergencyContactResource) {
    const relationCode = emergencyContactResource?.relationship;
    if (relationCode?.[0]) {
      const cc = relationCode[0];
      const coding = cc?.coding?.[0];

      if (coding && coding.display) {
        relationship = coding.display;
      }
    }
  }

  return { relationship, firstName, middleName, lastName, phone, streetAddress, addressLineOptional, city, state, zip };
};

export const createEmergencyContactInfoSection = <
  TData extends { emergencyContact?: EmergencyContactInfo },
>(): PdfSection<TData, EmergencyContactInfo> => {
  return createConfiguredSection('emergencyContact', (shouldShow) => ({
    title: 'Emergency contact information',
    dataSelector: (data) => data.emergencyContact,
    render: (client, contactInfo, styles) => {
      if (shouldShow('emergency-contact-relationship')) {
        client.drawLabelValueRow(
          'Relationship to the patient',
          contactInfo.relationship,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('emergency-contact-first-name')) {
        client.drawLabelValueRow(
          'First name',
          contactInfo.firstName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('emergency-contact-middle-name')) {
        client.drawLabelValueRow(
          'Middle name',
          contactInfo.middleName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('emergency-contact-last-name')) {
        client.drawLabelValueRow(
          'Last name',
          contactInfo.lastName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('emergency-contact-number')) {
        client.drawLabelValueRow('Phone', contactInfo.phone, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('emergency-contact-address')) {
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
      }
      if (shouldShow('emergency-contact-address-2')) {
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
      }
      if (
        shouldShow('emergency-contact-city') &&
        shouldShow('emergency-contact-state') &&
        shouldShow('emergency-contact-zip')
      ) {
        client.drawLabelValueRow(
          'City, State, ZIP',
          `${contactInfo.city}, ${contactInfo.state}, ${contactInfo.zip}`,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            spacing: 16,
          }
        );
      }
    },
  }));
};
