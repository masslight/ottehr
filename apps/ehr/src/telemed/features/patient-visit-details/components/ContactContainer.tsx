import { FC } from 'react';
import { getQuestionnaireResponseByLinkId } from 'utils';
import CopyButton from '../../../../components/CopyButton';
import { useAppointmentData } from '../../../state';
import { InformationCard } from './InformationCard';

export const ContactContainer: FC = () => {
  const { questionnaireResponse } = useAppointmentData();

  const streetAddress = getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]
    .valueString;

  const streetAddressLine2 = getQuestionnaireResponseByLinkId('patient-street-address-2', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  const cityStateZipString = `
    ${getQuestionnaireResponseByLinkId('patient-city', questionnaireResponse)?.answer?.[0]
      .valueString}, ${getQuestionnaireResponseByLinkId('patient-state', questionnaireResponse)?.answer?.[0]
      .valueString}, ${getQuestionnaireResponseByLinkId('patient-zip', questionnaireResponse)?.answer?.[0]?.valueString}
  `;

  const fillingOutAs = getQuestionnaireResponseByLinkId('patient-filling-out-as', questionnaireResponse)?.answer?.[0]
    .valueString;

  const patientEmail = getQuestionnaireResponseByLinkId('patient-email', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const patientMobile = getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const guardianEmail = getQuestionnaireResponseByLinkId('guardian-email', questionnaireResponse)?.answer?.[0]
    .valueString;

  const guardianMobile = getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]
    ?.valueString;

  const sendMarketingMessages =
    getQuestionnaireResponseByLinkId('mobile-opt-in', questionnaireResponse)?.answer?.[0]?.valueString || 'No';

  return (
    <InformationCard
      title="Contact information"
      fields={[
        {
          label: 'Street address',
          value: streetAddress,
          button: <CopyButton text={streetAddress || ''} />,
        },
        {
          label: 'Address line 2',
          value: streetAddressLine2,
          button: <CopyButton text={streetAddressLine2 || ''} />,
        },
        {
          label: 'City, State, ZIP',
          value: cityStateZipString,
        },
        {
          label: 'I am filling out this info as',
          value: fillingOutAs,
        },
        {
          label: 'Patient email',
          value: patientEmail,
          button: <CopyButton text={patientEmail || ''} />,
        },
        {
          label: 'Patient mobile',
          value: patientMobile,
          button: <CopyButton text={patientMobile || ''} />,
        },
        {
          label: 'Parent/Guardian email',
          value: guardianEmail,
          button: <CopyButton text={guardianEmail || ''} />,
        },
        {
          label: 'Parent/Guardian mobile',
          value: guardianMobile,
          button: <CopyButton text={guardianMobile || ''} />,
        },
        {
          label: 'Send marketing messages',
          value: sendMarketingMessages,
        },
      ]}
    />
  );
};
