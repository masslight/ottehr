import { FC } from 'react';
import { getQuestionnaireResponseByLinkId, mdyStringFromISOString } from 'utils';
import { useAppointmentData } from '../../../state';
import { InformationCard } from './InformationCard';

export const SecondaryInsuranceContainer: FC = () => {
  const { questionnaireResponse } = useAppointmentData();

  const insuranceCarrier = getQuestionnaireResponseByLinkId('insurance-carrier-2', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const memberId = getQuestionnaireResponseByLinkId('insurance-member-id-2', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const policyHolderFirstName = getQuestionnaireResponseByLinkId('policy-holder-last-name-2', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const policyHolderLastName = getQuestionnaireResponseByLinkId('policy-holder-first-name-2', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const policyHolderFirstAndLastName =
    policyHolderFirstName && policyHolderLastName ? `${policyHolderFirstName}, ${policyHolderLastName}` : undefined;

  const policyHolderDateOfBirth = getQuestionnaireResponseByLinkId(
    'policy-holder-date-of-birth-2',
    questionnaireResponse
  )?.answer?.[0]?.valueDate;

  const policyHolderBirthSex = getQuestionnaireResponseByLinkId('policy-holder-birth-sex-2', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const policyHolderAddress = getQuestionnaireResponseByLinkId('policy-holder-address-2', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const policyHolderCity = getQuestionnaireResponseByLinkId('policy-holder-city-2', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const policyHolderState = getQuestionnaireResponseByLinkId('policy-holder-state-2', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const policyHolderZip = getQuestionnaireResponseByLinkId('policy-holder-zip-2', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const policyHolderCityStateZip =
    policyHolderCity && policyHolderState && policyHolderZip
      ? `${policyHolderCity}, ${policyHolderState}, ${policyHolderZip}`
      : undefined;

  const patientRelationshipToInsured = getQuestionnaireResponseByLinkId(
    'patient-relationship-to-insured-2',
    questionnaireResponse
  )?.answer?.[0]?.valueString;

  return (
    <InformationCard
      title="Secondary insurance information"
      fields={[
        {
          label: 'Insurance Carrier',
          value: insuranceCarrier,
        },
        {
          label: 'Member ID',
          value: memberId,
        },
        {
          label: "Policy holder's name",
          value: policyHolderFirstAndLastName,
        },
        {
          label: "Policy holder's date of birth",
          value: policyHolderDateOfBirth && mdyStringFromISOString(policyHolderDateOfBirth),
        },
        {
          label: "Policy holder's sex",
          value: policyHolderBirthSex,
        },
        {
          label: 'Street address',
          value: policyHolderAddress,
        },
        {
          label: 'City, State, ZIP',
          value: policyHolderCityStateZip,
        },
        {
          label: "Patient's relationship to insured",
          value: patientRelationshipToInsured,
        },
      ]}
    />
  );
};
