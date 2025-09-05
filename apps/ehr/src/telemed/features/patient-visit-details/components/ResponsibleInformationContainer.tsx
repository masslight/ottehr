import { FC } from 'react';
import { getQuestionnaireResponseByLinkId, mdyStringFromISOString } from 'utils';
import { useAppointmentData } from '../../../state';
import { InformationCard } from './InformationCard';

export const ResponsibleInformationContainer: FC = () => {
  const { questionnaireResponse } = useAppointmentData();

  const relationship = getQuestionnaireResponseByLinkId('responsible-party-relationship', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const firstAndLastName = `
    ${getQuestionnaireResponseByLinkId('responsible-party-first-name', questionnaireResponse)?.answer?.[0]
      ?.valueString}, ${getQuestionnaireResponseByLinkId('responsible-party-last-name', questionnaireResponse)
      ?.answer?.[0]?.valueString}`;

  const dateOfBirth = getQuestionnaireResponseByLinkId('responsible-party-date-of-birth', questionnaireResponse)
    ?.answer?.[0]?.valueDate;

  const birthSex = getQuestionnaireResponseByLinkId('responsible-party-birth-sex', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const phone = getQuestionnaireResponseByLinkId('responsible-party-number', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const email = getQuestionnaireResponseByLinkId('responsible-party-email', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  return (
    <InformationCard
      title="Responsible party information"
      fields={[
        {
          label: 'Relationship',
          value: relationship,
        },
        {
          label: 'Full name',
          value: firstAndLastName,
        },
        {
          label: 'Date of birth',
          value: dateOfBirth && mdyStringFromISOString(dateOfBirth),
        },
        {
          label: 'Birth sex',
          value: birthSex,
        },
        {
          label: 'Phone',
          value: phone,
        },
        {
          label: 'Email',
          value: email,
        },
      ]}
    />
  );
};
