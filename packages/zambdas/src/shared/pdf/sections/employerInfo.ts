import { formatPhoneNumberDisplay } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { EmployerDataInput, EmployerInfo, PdfSection } from '../types';

export const composeEmployerData: DataComposer<EmployerDataInput, EmployerInfo> = ({ employer }) => {
  const employerName = employer?.name ?? '';
  const address = employer?.address?.[0];
  const streetAddress = address?.line?.[0] ?? '';
  const addressLineOptional = address?.line?.[1] ?? '';
  const city = address?.city ?? '';
  const state = address?.state ?? '';
  const zip = address?.postalCode ?? '';

  const contact = employer?.contact?.[0];

  const getTelecomValue = (system: string): string | undefined => {
    const contactValue = contact?.telecom?.find((tel) => tel.system === system && tel.value)?.value;
    const orgValue = employer?.telecom?.find((tel) => tel.system === system && tel.value)?.value;
    return contactValue ?? orgValue;
  };

  const firstName = contact?.name?.given?.[0] ?? '';
  const lastName = contact?.name?.family ?? '';
  const title = contact?.purpose?.text ?? '';

  const email = getTelecomValue('email') ?? '';
  const phone = formatPhoneNumberDisplay(getTelecomValue('phone'));
  const fax = formatPhoneNumberDisplay(getTelecomValue('fax'));

  return {
    employerName,
    streetAddress,
    addressLineOptional,
    city,
    state,
    zip,
    firstName,
    lastName,
    title,
    email,
    phone,
    fax,
  };
};

export const createEmployerInfoSection = <TData extends { employer?: EmployerInfo }>(): PdfSection<
  TData,
  EmployerInfo
> => {
  return createConfiguredSection('patientSummary', (shouldShow) => ({
    title: 'Employer Information',
    dataSelector: (data) => data.employer,
    shouldRender: (employer) => !!employer.employerName,
    render: (client, employerInfo, styles) => {
      if (shouldShow('employer-name')) {
        client.drawLabelValueRow(
          'Employer Name',
          employerInfo.employerName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('employer-address')) {
        client.drawLabelValueRow(
          'Street address',
          employerInfo.streetAddress,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('employer-address-2')) {
        client.drawLabelValueRow(
          'Address line 2',
          employerInfo.addressLineOptional,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('employer-city') && shouldShow('employer-state') && shouldShow('employer-zip')) {
        client.drawLabelValueRow(
          'City, State, ZIP',
          `${employerInfo.city}, ${employerInfo.state}, ${employerInfo.zip}`,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            dividerMargin: 8,
          }
        );
      }
      if (
        shouldShow('employer-contact-first-name') ||
        shouldShow('employer-contact-last-name') ||
        shouldShow('employer-contact-title') ||
        shouldShow('employer-contact-email') ||
        shouldShow('employer-contact-phone') ||
        shouldShow('employer-contact-fax')
      ) {
        client.drawText('Employer Contact', styles.textStyles.subHeader);
      }
      if (shouldShow('employer-contact-first-name')) {
        client.drawLabelValueRow(
          'First name',
          employerInfo.firstName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('employer-contact-last-name')) {
        client.drawLabelValueRow(
          'Last name',
          employerInfo.lastName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('employer-contact-title')) {
        client.drawLabelValueRow('Title', employerInfo.title, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('employer-contact-email')) {
        client.drawLabelValueRow('Email', employerInfo.email, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('employer-contact-phone')) {
        client.drawLabelValueRow('Mobile', employerInfo.phone, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('employer-contact-fax')) {
        client.drawLabelValueRow('Fax', employerInfo.fax, styles.textStyles.regular, styles.textStyles.regular, {
          spacing: 16,
        });
      }
    },
  }));
};
