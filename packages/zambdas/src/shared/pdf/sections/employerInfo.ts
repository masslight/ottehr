import { Identifier } from 'fhir/r4b';
import { formatPhoneNumberDisplay, getPayerId } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { EmployerDataInput, EmployerInfo, PdfSection } from '../types';

export const composeEmployerData: DataComposer<EmployerDataInput, EmployerInfo> = ({
  employer,
  workersCompCoverage,
  insuranceOrgs,
}) => {
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

  // Mirrors `composeInsuranceData`: resolve carrier name by matching the Coverage's
  // `class[0].value` (payer id) against the same field on the cached insurance Orgs.
  let workersCompInsuranceCarrier = '';
  let workersCompMemberId = '';
  if (workersCompCoverage) {
    const payerId = workersCompCoverage.class?.[0]?.value;
    const carrierOrg = payerId ? insuranceOrgs?.find((org) => getPayerId(org) === payerId) : undefined;
    workersCompInsuranceCarrier = carrierOrg?.name ?? '';
    workersCompMemberId =
      workersCompCoverage.identifier?.find(
        (i: Identifier) =>
          i.type?.coding?.[0]?.code === 'MB' && i.assigner?.reference === workersCompCoverage.payor?.[0]?.reference
      )?.value ??
      workersCompCoverage.subscriberId ??
      '';
  }

  return {
    workersCompInsuranceCarrier,
    workersCompMemberId,
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

const hasEmployerInfo = (info: EmployerInfo): boolean =>
  !!(
    info.workersCompInsuranceCarrier ||
    info.workersCompMemberId ||
    info.employerName ||
    info.streetAddress ||
    info.addressLineOptional ||
    info.city ||
    info.state ||
    info.zip ||
    info.firstName ||
    info.lastName ||
    info.title ||
    info.email ||
    info.phone ||
    info.fax
  );

export const createEmployerInfoSection = <TData extends { employer?: EmployerInfo }>(): PdfSection<
  TData,
  EmployerInfo
> => {
  return createConfiguredSection('employerInformation', (shouldShow) => ({
    // Title mirrors `PATIENT_RECORD_CONFIG.FormFields.employerInformation.title`,
    // matching the EHR's `EmployerInformationContainer`.
    title: "Worker's Compensation Information",
    dataSelector: (data) => data.employer,
    // Any-of: section is shown when any WC/employer field is populated, mirroring
    // the EHR container which always renders the section once its trigger fires
    // (service-category = workers-comp).
    shouldRender: (employer) => hasEmployerInfo(employer),
    render: (client, employerInfo, styles) => {
      if (shouldShow('workers-comp-insurance-name')) {
        client.drawLabelValueRow(
          'Insurance carrier',
          employerInfo.workersCompInsuranceCarrier,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('workers-comp-insurance-member-id')) {
        client.drawLabelValueRow(
          'Member ID',
          employerInfo.workersCompMemberId,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
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
            spacing: 16,
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
