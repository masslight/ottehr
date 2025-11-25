import { Reference } from 'fhir/r4b';
import {
  COVERAGE_ADDITIONAL_INFORMATION_URL,
  genderMap,
  getCandidPlanTypeCodeFromCoverage,
  getFullName,
  getPayerId,
} from 'utils';
import { DataComposer } from '../pdf-common';
import { Insurance, InsuranceDataInput, InsuranceInfo, PdfSection } from '../types';

export const composeInsuranceData: DataComposer<InsuranceDataInput, InsuranceInfo> = ({ coverages, insuranceOrgs }) => {
  const { primary, secondary, primarySubscriber, secondarySubscriber } = coverages;

  let primaryInsurancePlanReference: Reference | undefined;
  let secondaryInsurancePlanReference: Reference | undefined;

  let primaryMemberId = '';
  let secondaryMemberId = '';

  let primaryPlanType: string | undefined;
  let secondaryPlanType: string | undefined;

  if (primary) {
    const payerId = primary.class?.[0].value;
    const org = insuranceOrgs.find((tempOrg) => getPayerId(tempOrg) === payerId);
    if (payerId && org) {
      primaryInsurancePlanReference = {
        reference: `Organization/${org.id}`,
        display: org.name,
      };
    }
  }

  if (secondary) {
    const payerId = secondary.class?.[0].value;
    const org = insuranceOrgs.find((tempOrg) => getPayerId(tempOrg) === payerId);
    if (payerId && org) {
      secondaryInsurancePlanReference = {
        reference: `Organization/${org.id}`,
        display: org.name,
      };
    }
  }

  if (primary) {
    primaryMemberId =
      primary.identifier?.find(
        (i) => i.type?.coding?.[0]?.code === 'MB' && i.assigner?.reference === primary.payor[0]?.reference
      )?.value ?? '';
  }
  if (secondary) {
    secondaryMemberId =
      secondary.identifier?.find(
        (i) => i.type?.coding?.[0]?.code === 'MB' && i.assigner?.reference === secondary.payor[0]?.reference
      )?.value ?? '';
  }

  if (primary) {
    primaryPlanType = getCandidPlanTypeCodeFromCoverage(primary);
  }
  if (secondary) {
    secondaryPlanType = getCandidPlanTypeCodeFromCoverage(secondary);
  }

  const primarySubscriberDoB = primarySubscriber?.birthDate ?? '';
  const primarySubscriberBirthSex = genderMap[primarySubscriber?.gender as keyof typeof genderMap] ?? '';
  let primarySubscriberFullName = '';
  const relationshipToInsured = primary?.relationship?.coding?.[0].display ?? '';
  const policyHolderAddress = primarySubscriber?.address?.[0];
  const policyHolderZip = policyHolderAddress?.postalCode ?? '';
  const policyHolderState = policyHolderAddress?.state ?? '';
  const policyHolderCity = policyHolderAddress?.city ?? '';
  const policyHolderAddressAdditionalLine = policyHolderAddress?.line?.[1] ?? '';
  const policyHolderAddressLine = policyHolderAddress?.line?.[0] ?? '';

  if (primarySubscriber) {
    primarySubscriberFullName = getFullName(primarySubscriber) ?? '';
  }

  const primaryAdditionalInformation =
    primary?.extension?.find((e: { url: string }) => e.url === COVERAGE_ADDITIONAL_INFORMATION_URL)?.valueString ?? '';

  const secondarySubscriberDoB = secondarySubscriber?.birthDate ?? '';
  const secondarySubscriberBirthSex = genderMap[secondarySubscriber?.gender as keyof typeof genderMap] ?? '';
  let secondarySubscriberFullName = '';
  const secondaryRelationshipToInsured = secondary?.relationship?.coding?.[0].display ?? '';
  const secondaryPolicyHolderAddress = secondarySubscriber?.address?.[0];
  const secondaryPolicyHolderZip = secondaryPolicyHolderAddress?.postalCode ?? '';
  const secondaryPolicyHolderState = secondaryPolicyHolderAddress?.state ?? '';
  const secondaryPolicyHolderCity = secondaryPolicyHolderAddress?.city ?? '';
  const secondaryPolicyHolderAddressAdditionalLine = secondaryPolicyHolderAddress?.line?.[1] ?? '';
  const secondaryPolicyHolderAddressLine = secondaryPolicyHolderAddress?.line?.[0] ?? '';
  if (secondarySubscriber) {
    secondarySubscriberFullName = getFullName(secondarySubscriber) ?? '';
  }

  const secondaryAdditionalInformation =
    secondary?.extension?.find((e: { url: string }) => e.url === COVERAGE_ADDITIONAL_INFORMATION_URL)?.valueString ??
    '';

  return {
    primary: {
      insuranceCarrier: primaryInsurancePlanReference?.display ?? '',
      planType: primaryPlanType,
      memberId: primaryMemberId,
      policyHoldersName: primarySubscriberFullName,
      policyHoldersDateOfBirth: primarySubscriberDoB,
      policyHoldersSex: primarySubscriberBirthSex,
      streetAddress: policyHolderAddressLine,
      addressLineOptional: policyHolderAddressAdditionalLine,
      city: policyHolderCity,
      state: policyHolderState,
      zip: policyHolderZip,
      relationship: relationshipToInsured,
      additionalInformation: primaryAdditionalInformation,
    },
    secondary: {
      insuranceCarrier: secondaryInsurancePlanReference?.display ?? '',
      planType: secondaryPlanType,
      memberId: secondaryMemberId,
      policyHoldersName: secondarySubscriberFullName,
      policyHoldersDateOfBirth: secondarySubscriberDoB,
      policyHoldersSex: secondarySubscriberBirthSex,
      streetAddress: secondaryPolicyHolderAddressLine,
      addressLineOptional: secondaryPolicyHolderAddressAdditionalLine,
      city: secondaryPolicyHolderCity,
      state: secondaryPolicyHolderState,
      zip: secondaryPolicyHolderZip,
      relationship: secondaryRelationshipToInsured,
      additionalInformation: secondaryAdditionalInformation,
    },
  };
};

const createInsuranceSection = <TData extends { insurances?: InsuranceInfo }>(
  title: string,
  dataSelector: (data: TData) => Insurance | undefined
): PdfSection<TData, Insurance> => ({
  title,
  dataSelector,
  shouldRender: (coverage) => !!coverage.insuranceCarrier,
  render: (client, data, styles) => {
    client.drawLabelValueRow(
      'Insurance Carrier',
      data.insuranceCarrier,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow('Member ID', data.memberId, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow(
      `Policy holder's name`,
      data.policyHoldersName,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      `Policy holder's date of birth`,
      data.policyHoldersDateOfBirth,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      `Policy holder's sex`,
      data.policyHoldersSex,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
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
    client.drawLabelValueRow(
      'Address line 2',
      data.addressLineOptional,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      'City, State, ZIP',
      `${data.city}, ${data.state}, ${data.zip}`,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      `Patient's relationship to insured`,
      data.relationship,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      `Additional insurance information`,
      data.additionalInformation,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        spacing: 16,
      }
    );
  },
});

export const createPrimaryInsuranceSection = <TData extends { insurances?: InsuranceInfo }>(): PdfSection<
  TData,
  Insurance
> => createInsuranceSection('Primary insurance information', (data) => data.insurances?.primary);

export const createSecondaryInsuranceSection = <TData extends { insurances?: InsuranceInfo }>(): PdfSection<
  TData,
  Insurance
> => createInsuranceSection('Secondary insurance information', (data) => data.insurances?.secondary);
