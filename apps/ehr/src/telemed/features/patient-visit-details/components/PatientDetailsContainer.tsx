import { FC } from 'react';
import { getQuestionnaireResponseByLinkId } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { InformationCard } from './InformationCard';

export const PatientDetailsContainer: FC = () => {
  const { patient, questionnaireResponse } = getSelectors(useAppointmentStore, ['patient', 'questionnaireResponse']);

  const ethnicity = getQuestionnaireResponseByLinkId('patient-ethnicity', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const race = getQuestionnaireResponseByLinkId('patient-race', questionnaireResponse)?.answer?.[0]?.valueString;
  const pronouns = getQuestionnaireResponseByLinkId('patient-pronouns', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const pcpNumber = getQuestionnaireResponseByLinkId('pcp-number', questionnaireResponse)?.answer?.[0]?.valueString;
  const pcpAddress = getQuestionnaireResponseByLinkId('pcp-address', questionnaireResponse)?.answer?.[0]?.valueString;
  const pcpPractice = getQuestionnaireResponseByLinkId('pcp-practice', questionnaireResponse)?.answer?.[0]?.valueString;
  const pcpFirstName = getQuestionnaireResponseByLinkId('pcp-first', questionnaireResponse)?.answer?.[0]?.valueString;
  const pcpLastName = getQuestionnaireResponseByLinkId('pcp-last', questionnaireResponse)?.answer?.[0]?.valueString;
  const pcpFirstAndLastName = pcpFirstName && pcpLastName ? `${pcpLastName}, ${pcpFirstName}` : undefined;

  const howDidYouHearAboutUs = patient?.extension?.find(
    (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery'
  )?.valueString;
  const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const requireRelayService = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  return (
    <InformationCard
      title="Patient details"
      fields={[
        {
          label: "Patient's ethnicity",
          value: ethnicity,
        },
        {
          label: "Patient's race",
          value: race,
        },
        {
          label: 'Preferred pronouns',
          value: pronouns,
        },
        {
          label: 'PCP first and last name',
          value: pcpFirstAndLastName,
        },
        {
          label: 'PCP Practice name',
          value: pcpPractice,
        },
        {
          label: 'PCP address',
          value: pcpAddress,
        },
        {
          label: 'PCP phone number',
          value: pcpNumber,
        },
        {
          label: 'How did you hear about us?',
          value: howDidYouHearAboutUs,
        },
        {
          label: 'Preferred language',
          value: preferredLanguage,
        },
        {
          label: 'Do you require a Hearing Impaired Relay Service? (711)',
          value: requireRelayService,
        },
      ]}
    />
  );
};
