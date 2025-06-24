import { FC } from 'react';
import { getQuestionnaireResponseByLinkId, mdyStringFromISOString } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { InformationCard } from './InformationCard';

export const InsuranceContainer: FC = () => {
  const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);

  const insuranceCarrier = getQuestionnaireResponseByLinkId('insurance-carrier', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const memberId = getQuestionnaireResponseByLinkId('insurance-member-id', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const policyHolderFirstName = getQuestionnaireResponseByLinkId('policy-holder-last-name', questionnaireResponse)
    ?.answer?.[0]?.valueString;
  const policyHolderLastName = getQuestionnaireResponseByLinkId('policy-holder-first-name', questionnaireResponse)
    ?.answer?.[0]?.valueString;
  const policyHolderFirstAndLastName =
    policyHolderFirstName && policyHolderLastName ? `${policyHolderFirstName}, ${policyHolderLastName}` : undefined;
  const policyHolderDateOfBirth = getQuestionnaireResponseByLinkId('policy-holder-date-of-birth', questionnaireResponse)
    ?.answer?.[0]?.valueDate;
  const policyHolderBirthSex = getQuestionnaireResponseByLinkId('policy-holder-birth-sex', questionnaireResponse)
    ?.answer?.[0]?.valueString;
  const policyHolderAddress = getQuestionnaireResponseByLinkId('policy-holder-address', questionnaireResponse)
    ?.answer?.[0]?.valueString;
  const policyHolderCity = getQuestionnaireResponseByLinkId('policy-holder-city', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const policyHolderState = getQuestionnaireResponseByLinkId('policy-holder-state', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const policyHolderZip = getQuestionnaireResponseByLinkId('policy-holder-zip', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const policyHolderCityStateZip =
    policyHolderCity && policyHolderState && policyHolderZip
      ? `${policyHolderCity}, ${policyHolderState}, ${policyHolderZip}`
      : undefined;
  const patientRelationshipToInsured = getQuestionnaireResponseByLinkId(
    'patient-relationship-to-insured',
    questionnaireResponse
  )?.answer?.[0]?.valueString;

  return (
    <InformationCard
      title="Insurance information"
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
