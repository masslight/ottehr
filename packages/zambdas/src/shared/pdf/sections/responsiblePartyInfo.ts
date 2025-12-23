import { RelatedPerson } from 'fhir/r4b';
import { capitalize } from 'lodash-es';
import { getFullName, standardizePhoneNumber } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { PdfSection, ResponsiblePartyInfo, ResponsiblePartyInput } from '../types';

export const composeResponsiblePartyData: DataComposer<ResponsiblePartyInput, ResponsiblePartyInfo> = ({
  guarantorResource,
}) => {
  const phone =
    standardizePhoneNumber(
      guarantorResource?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value
    ) ?? '';
  const email =
    guarantorResource?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value ?? '';
  let sex = '';
  if (guarantorResource?.gender) {
    const genderString = guarantorResource?.gender === 'other' ? 'Intersex' : guarantorResource?.gender;
    sex = capitalize(genderString);
  }
  const dob = guarantorResource?.birthDate ?? '';
  let fullName = '';
  if (guarantorResource) {
    fullName = getFullName(guarantorResource) ?? '';
  }
  let relationship = '';
  if (guarantorResource && guarantorResource.resourceType === 'Patient') {
    relationship = 'Self';
  } else if (guarantorResource) {
    relationship = (guarantorResource as RelatedPerson)?.relationship?.[0].coding?.[0].display ?? '';
  }

  const guarantorAddress = guarantorResource?.address?.[0];
  const streetAddress = guarantorAddress?.line?.[0] ?? '';
  const addressLineOptional = guarantorAddress?.line?.[1] ?? '';
  const city = guarantorAddress?.city ?? '';
  const state = guarantorAddress?.state ?? '';
  const zip = guarantorAddress?.postalCode ?? '';

  return {
    relationship,
    fullName,
    dob,
    sex,
    phone,
    email,
    streetAddress,
    addressLineOptional,
    state,
    city,
    zip,
  };
};

export const createResponsiblePartySection = <TData extends { responsibleParty?: ResponsiblePartyInfo }>(): PdfSection<
  TData,
  ResponsiblePartyInfo
> => {
  return createConfiguredSection('responsibleParty', (shouldShow) => ({
    title: 'Responsible party information',
    dataSelector: (data) => data.responsibleParty,
    render: (client, data, styles) => {
      if (shouldShow('responsible-party-relationship')) {
        client.drawLabelValueRow(
          'Relationship to the patient',
          data.relationship,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('responsible-party-first-name') || shouldShow('responsible-party-last-name')) {
        client.drawLabelValueRow('Full name', data.fullName, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('responsible-party-date-of-birth')) {
        client.drawLabelValueRow('Date of birth', data.dob, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('responsible-party-birth-sex')) {
        client.drawLabelValueRow('Birth sex', data.sex, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('responsible-party-number')) {
        client.drawLabelValueRow('Phone', data.phone, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('responsible-party-email')) {
        client.drawLabelValueRow('Email', data.email, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('responsible-party-address')) {
        client.drawLabelValueRow(
          'Street address',
          data.streetAddress,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('responsible-party-address-2')) {
        client.drawLabelValueRow(
          `Address line 2`,
          data.addressLineOptional,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (
        shouldShow('responsible-party-city') &&
        shouldShow('responsible-party-state') &&
        shouldShow('responsible-party-zip')
      ) {
        client.drawLabelValueRow(
          `City, State, ZIP`,
          `${data.city}, ${data.state}, ${data.zip}`,
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
