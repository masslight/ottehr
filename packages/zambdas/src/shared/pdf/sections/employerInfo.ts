import { formatPhoneNumberDisplay } from 'utils';
import { DataComposer } from '../pdf-common';
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
> => ({
  title: 'Employer Information',
  dataSelector: (data) => data.employer,
  shouldRender: (employer) => !!employer.employerName,
  render: (client, employerInfo, styles) => {
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
    client.drawLabelValueRow(
      'City, State, ZIP',
      `${employerInfo.city}, ${employerInfo.state}, ${employerInfo.zip}`,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawText('Employer Contact', styles.textStyles.subHeader);
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
    client.drawLabelValueRow('Last name', employerInfo.lastName, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow('Title', employerInfo.title, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow('Email', employerInfo.email, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow('Mobile', employerInfo.phone, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow('Fax', employerInfo.fax, styles.textStyles.regular, styles.textStyles.regular, {
      spacing: 16,
    });
  },
});
