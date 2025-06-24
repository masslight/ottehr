import { FC } from 'react';
import { getQuestionnaireResponseByLinkId, mdyStringFromISOString } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { InformationCard } from './InformationCard';

export const ResponsibleInformationContainer: FC = () => {
  const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);

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
      ]}
    />
  );
};
